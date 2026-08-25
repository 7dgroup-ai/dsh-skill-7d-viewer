/**
 * dsh-skill-7d-viewer host half: two fenced routes that read files for the
 * browser viewer — `/viewer/read` (text JSON, with binary detection) and
 * `/viewer/media` (binary bytes for images). Every route passes the same
 * browser-trust fence as the /api gateway (Host-header loopback or the web
 * runtime's trustedHosts), and every path is confined to the session's
 * authoritative working directory.
 *
 * @module dsh-skill-7d-viewer
 */
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Config, resolveViewerConfig, type ResolvedViewerConfig, type ViewerConfig } from './config.ts'
import { launchFolder } from './open-external.ts'
import { isTrustedApiRequest } from './trust-fence.ts'

export { Config }
export type { ViewerConfig, ResolvedViewerConfig }

/** Plugin identity for cordis.yml rows. */
export const name = 'skill-7d-viewer'

/** Services required before mounting: the webserver routes and the session store. */
export const inject = ['webServer', 'sessions', 'webRuntime']

/** Structural request face the routes read (subset of node IncomingMessage). */
interface ViewerRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
  [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>
}

/** Structural response face the routes write (subset of node ServerResponse). */
interface ViewerResponse {
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

/** One registered prefix route. */
interface ViewerRoute {
  kind: 'prefix'
  path: string
  handler: (req: ViewerRequest, res: ViewerResponse) => void | Promise<void>
}

/** The webServer service face this plugin uses. */
interface ViewerWebServer {
  register(route: ViewerRoute): () => void
}

/** The host session store face (authoritative cwd per session). */
interface ViewerSessionStore {
  get(sessionId: string): { header: { cwd: string | undefined } } | undefined
}

/** The web runtime face (bind-derived trusted hosts). */
interface ViewerWebRuntime {
  trustedHosts: readonly string[]
}

/** Plugin context narrowed to the three injected services. */
type ViewerContext = Context & {
  webServer: ViewerWebServer
  sessions: ViewerSessionStore
  webRuntime: ViewerWebRuntime
}

/** Content types for the media route, by extension. */
const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
}

/** Content type served by /viewer/media (binary-safe fallback for unknowns). */
export function mediaTypeForPath(path: string): string {
  return MEDIA_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/** Whether one absolute path is inside (or equal to) the session root. */
export function isWithin(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path))
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** Resolve a session's authoritative working directory (process cwd fallback). */
function sessionCwd(ctx: ViewerContext, sessionId: string, clientCwd?: string): string {
  const headerCwd = ctx.sessions.get(sessionId)?.header.cwd
  if (headerCwd !== undefined && headerCwd !== '') return headerCwd
  if (clientCwd !== undefined && clientCwd !== '') return resolve(clientCwd)
  return process.cwd()
}

/** How many leading bytes a binary read returns for client-side sniffing. */
const READ_HEAD_LIMIT = 4096

/** Text read of a file with a size cap; binary detection via a NUL probe. */
async function readText(path: string, readLimit: number): Promise<{
  content: string
  truncated: boolean
  binary: boolean
  size: number
  head?: string
}> {
  const info = await stat(path)
  const size = info.size
  const truncated = size > readLimit
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(Math.min(size, readLimit))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const slice = buffer.subarray(0, bytesRead)
    const binary = slice.includes(0)
    const head = binary
      ? slice.subarray(0, Math.min(slice.length, READ_HEAD_LIMIT)).toString('base64')
      : undefined
    return { content: binary ? '' : slice.toString('utf8'), truncated, binary, size, head }
  } finally {
    await handle.close()
  }
}

function writeJson(res: ViewerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
  res.end(JSON.stringify(body))
}

function writeError(res: ViewerResponse, status: number, message: string): void {
  writeJson(res, status, { ok: false, error: message })
}

/** Read and parse a JSON request body (size-capped). */
async function readJsonBody(req: ViewerRequest): Promise<Record<string, unknown>> {
  const chunks: string[] = []
  let total = 0
  for await (const chunk of req) {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    chunks.push(text)
    total += text.length
    if (total > 1024 * 1024) throw new Error('request body too large')
  }
  if (chunks.length === 0) return {}
  const parsed: unknown = JSON.parse(chunks.join(''))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be a JSON object')
  return parsed as Record<string, unknown>
}

/**
 * Plugin body: mount the fenced read + media routes.
 * @param ctx - host plugin context (webServer, sessions, webRuntime).
 * @param config - deployment-provided limits; the Loader validates against
 * {@link Config} and fills defaults, direct callers get them from
 * {@link resolveViewerConfig}.
 */
export function apply(ctx: ViewerContext, config?: ViewerConfig): void {
  const resolved = resolveViewerConfig(config)
  const fence = (req: ViewerRequest): boolean => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)

  // ── Text read route ─────────────────────────────────────────────────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/viewer/read',
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end()
        return
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const sessionId = url.searchParams.get('sessionId')
        const raw = url.searchParams.get('path')
        if (sessionId === null || raw === null) {
          writeError(res, 400, 'sessionId and path are required')
          return
        }
        const cwd = sessionCwd(ctx, sessionId, url.searchParams.get('cwd') ?? undefined)
        const path = resolve(raw)
        if (!isWithin(cwd, path)) {
          writeError(res, 403, 'path outside the session working directory')
          return
        }
        const info = await stat(path)
        if (!info.isFile()) {
          writeError(res, 400, 'not a file')
          return
        }
        const read = await readText(path, resolved.readLimit)
        if (read.binary) {
          writeJson(res, 200, { kind: 'binary', size: read.size, truncated: read.truncated, head: read.head })
        } else {
          writeJson(res, 200, { kind: 'text', content: read.content, truncated: read.truncated, size: read.size })
        }
      } catch (error) {
        writeError(res, 400, error instanceof Error ? error.message : String(error))
      }
    },
  }), 'dsh-skill-7d-viewer: /viewer/read route')

  // ── Media route (images) ────────────────────────────────────────────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/viewer/media',
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end()
        return
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const sessionId = url.searchParams.get('sessionId')
        const raw = url.searchParams.get('path')
        if (sessionId === null || raw === null) {
          writeError(res, 400, 'sessionId and path are required')
          return
        }
        const cwd = sessionCwd(ctx, sessionId, url.searchParams.get('cwd') ?? undefined)
        const path = resolve(raw)
        if (!isWithin(cwd, path)) {
          writeError(res, 403, 'path outside the session working directory')
          return
        }
        const info = await stat(path)
        if (!info.isFile() || info.size > resolved.mediaLimit) {
          writeError(res, 400, 'not a file or too large')
          return
        }
        const body = await readFile(path)
        const headers: Record<string, string> = {
          'content-type': mediaTypeForPath(path),
          'cache-control': 'no-cache',
        }
        if (url.searchParams.get('download') === '1') {
          headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(basename(path))}`
        }
        res.writeHead(200, headers)
        res.end(body)
      } catch (error) {
        writeError(res, 400, error instanceof Error ? error.message : String(error))
      }
    },
  }), 'dsh-skill-7d-viewer: /viewer/media route')

  // ── Write route (save edits) ─────────────────────────────────────────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/viewer/write',
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end()
        return
      }
      try {
        const body = await readJsonBody(req)
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        const raw = typeof body.path === 'string' ? body.path : ''
        const content = typeof body.content === 'string' ? body.content : ''
        if (sessionId === '' || raw === '') {
          writeError(res, 400, 'sessionId and path are required')
          return
        }
        if (Buffer.byteLength(content, 'utf8') > resolved.writeLimit) {
          writeError(res, 400, 'content too large')
          return
        }
        const cwd = sessionCwd(ctx, sessionId, typeof body.cwd === 'string' ? body.cwd : undefined)
        const path = resolve(raw)
        if (!isWithin(cwd, path)) {
          writeError(res, 403, 'path outside the session working directory')
          return
        }
        // Atomic replace: write a sibling temp file then rename over the target.
        const tmp = `${path}.dsh-viewer-tmp-${process.pid}`
        try {
          await mkdir(dirname(path), { recursive: true })
          await writeFile(tmp, content, 'utf8')
          await rename(tmp, path)
        } catch (error) {
          await rm(tmp, { force: true }).catch(() => {})
          throw error
        }
        writeJson(res, 200, { ok: true })
      } catch (error) {
        writeError(res, 400, error instanceof Error ? error.message : String(error))
      }
    },
  }), 'dsh-skill-7d-viewer: /viewer/write route')

  // ── Reveal route (open a folder in the OS file manager) ─────────────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/viewer/reveal',
    handler: (req, res) => {
      if (!fence(req)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end()
        return
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const sessionId = url.searchParams.get('sessionId')
        const raw = url.searchParams.get('path')
        if (sessionId === null || raw === null) {
          writeError(res, 400, 'sessionId and path are required')
          return
        }
        const cwd = sessionCwd(ctx, sessionId, url.searchParams.get('cwd') ?? undefined)
        const path = resolve(raw)
        if (!isWithin(cwd, path)) {
          writeError(res, 403, 'path outside the session working directory')
          return
        }
        launchFolder(path)
        writeJson(res, 200, { ok: true })
      } catch (error) {
        writeError(res, 400, error instanceof Error ? error.message : String(error))
      }
    },
  }), 'dsh-skill-7d-viewer: /viewer/reveal route')
}
