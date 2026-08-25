/**
 * Thin client over the host's /viewer routes. Requests carry the session id and
 * path; the host confines reads/writes to the session cwd and fences every
 * route.
 * @module dsh-skill-7d-viewer/client/api
 */

import type { ReadResult } from './types.ts'

/** Read one file as text JSON (or a binary marker). */
export async function readFile(sessionId: string, path: string, cwd?: string): Promise<ReadResult> {
  const url = new URL('/viewer/read', window.location.origin)
  url.searchParams.set('sessionId', sessionId)
  url.searchParams.set('path', path)
  if (cwd !== undefined && cwd !== '') url.searchParams.set('cwd', cwd)
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) {
    let message = `request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (typeof body.error === 'string') message = body.error
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
  return (await response.json()) as ReadResult
}

/** Save one file's text content. */
export async function writeFile(sessionId: string, path: string, content: string, cwd?: string): Promise<void> {
  const url = new URL('/viewer/write', window.location.origin)
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      path,
      content,
      ...(cwd !== undefined && cwd !== '' ? { cwd } : {}),
    }),
  })
  if (!response.ok) {
    let message = `save failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (typeof body.error === 'string') message = body.error
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
}

/** URL that serves one file's bytes (images). */
export function mediaUrl(sessionId: string, path: string, cwd?: string): string {
  const url = new URL('/viewer/media', window.location.origin)
  url.searchParams.set('sessionId', sessionId)
  url.searchParams.set('path', path)
  if (cwd !== undefined && cwd !== '') url.searchParams.set('cwd', cwd)
  return url.toString()
}

/** Open a folder in the OS file manager (Finder on macOS). */
export async function revealFolder(sessionId: string, path: string, cwd?: string): Promise<void> {
  const url = new URL('/viewer/reveal', window.location.origin)
  url.searchParams.set('sessionId', sessionId)
  url.searchParams.set('path', path)
  if (cwd !== undefined && cwd !== '') url.searchParams.set('cwd', cwd)
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) {
    let message = `reveal failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (typeof body.error === 'string') message = body.error
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
}
