/**
 * Terminal session table. Preferred backend is node-pty (a real PTY: cursor
 * positioning, colors, interactive programs). On environments where node-pty
 * cannot spawn (e.g. prebuilt binaries failing `posix_spawnp failed` on very
 * new macOS/Node), it falls back to a plain `child_process` shell piped over
 * the WebSocket — less faithful (no raw-mode programs, no prompt), but it runs
 * commands and streams output. Both backends expose one {@link TerminalProc}.
 * @module dsh-skill-7d-viewer/pty-manager
 */
import { spawn as spawnChild, type ChildProcess } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

/** The one terminal surface the WebSocket route drives. */
export interface TerminalProc {
  onData(callback: (data: string) => void): { dispose(): void }
  onExit(callback: (event: { exitCode: number }) => void): { dispose(): void }
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

/** One live terminal. */
export interface PtyHandle {
  key: string
  sessionId: string
  tab: string
  cwd: string
  pty: TerminalProc
  /** Output accumulated since spawn (bounded; head dropped when over the limit). */
  transcript: string
  exited: boolean
}

/** Per-terminal transcript bound (bytes kept for replay). */
const TRANSCRIPT_LIMIT = 1 << 20

/** Dispose registration helper. */
function disposableOf(dispose: () => void): { dispose(): void } {
  return { dispose }
}

/**
 * Restore the executable bit pnpm strips from node-pty's prebuilt
 * spawn-helper (the macOS helper that forks and sets up the pty). Without it
 * every spawn fails with `posix_spawnp failed`. Idempotent.
 */
export function ensureSpawnHelper(): void {
  if (process.platform === 'win32') return
  try {
    const require = createRequire(import.meta.url)
    const entry = require.resolve('node-pty')
    const packageRoot = dirname(dirname(entry))
    const candidates = [
      join(packageRoot, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
      join(packageRoot, 'build', 'Release', 'spawn-helper'),
    ]
    for (const helper of candidates) {
      if (existsSync(helper)) chmodSync(helper, 0o755)
    }
  } catch {
    // Resolution or chmod failure: the terminal surfaces its own spawn error.
  }
}

/** A plain child_process shell piped as a terminal (node-pty fallback). */
class ChildProcessShell implements TerminalProc {
  private readonly outputListeners = new Set<(data: string) => void>()
  private readonly exitListeners = new Set<(event: { exitCode: number }) => void>()
  private readonly child: ChildProcess
  exited = false

  constructor(shell: string, cwd: string) {
    this.child = spawnChild(shell, ['-l'], { cwd, env: { ...process.env, TERM: 'xterm-256color' } })
    this.child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      for (const listener of [...this.outputListeners]) listener(text)
    })
    this.child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      for (const listener of [...this.outputListeners]) listener(text)
    })
    this.child.on('error', () => {
      this.exited = true
      for (const listener of [...this.exitListeners]) listener({ exitCode: 1 })
    })
    this.child.on('exit', (code) => {
      this.exited = true
      for (const listener of [...this.exitListeners]) listener({ exitCode: code ?? 0 })
    })
  }

  onData(callback: (data: string) => void): { dispose(): void } {
    this.outputListeners.add(callback)
    return disposableOf(() => this.outputListeners.delete(callback))
  }

  onExit(callback: (event: { exitCode: number }) => void): { dispose(): void } {
    this.exitListeners.add(callback)
    return disposableOf(() => this.exitListeners.delete(callback))
  }

  write(data: string): void {
    this.child.stdin?.write(data)
  }

  resize(): void {
    // No PTY to resize; a plain pipe stays fixed.
  }

  kill(): void {
    this.child.kill()
  }
}

/** The terminal registry. */
export class PtyManager {
  private readonly sessions = new Map<string, PtyHandle>()
  private readonly pendingCloses = new Map<string, ReturnType<typeof setTimeout>>()
  /** node-pty failed to spawn; future opens use the child_process fallback. */
  private ptyBroken = false

  constructor(private readonly maxPerSession: number) {}

  /** Live terminal keys of one session. */
  keysOf(sessionId: string): string[] {
    const keys: string[] = []
    for (const handle of this.sessions.values()) if (handle.sessionId === sessionId) keys.push(handle.key)
    return keys
  }

  /**
   * Open (or reuse) a terminal for a session/tab key. An exited handle is
   * replaced with a fresh spawn; a live one is reused (transcript preserved).
   * On node-pty failure this falls back to a child_process shell.
   * @param sessionId - owning session.
   * @param tab - client-generated tab id.
   * @param cwd - the shell's working directory.
   * @param shell - the shell executable (e.g. $SHELL).
   * @param pty - the loaded node-pty module (or undefined when broken).
   * @returns the handle (created or reused).
   */
  open(sessionId: string, tab: string, cwd: string, shell: string, pty?: typeof import('node-pty')): PtyHandle {
    const key = `${sessionId}:${tab}`
    const existing = this.sessions.get(key)
    if (existing !== undefined && !existing.exited) return existing
    this.ensureQuota(sessionId)
    let proc: TerminalProc
    if (!this.ptyBroken && pty !== undefined) {
      try {
        proc = pty.spawn(shell, ['-l'], { name: 'xterm-256color', cols: 80, rows: 24, cwd })
      } catch {
        this.ptyBroken = true
        proc = new ChildProcessShell(shell, cwd)
      }
    } else {
      proc = new ChildProcessShell(shell, cwd)
    }
    const handle: PtyHandle = { key, sessionId, tab, cwd, pty: proc, transcript: '', exited: false }
    proc.onData((data) => {
      handle.transcript = (handle.transcript + data).slice(-TRANSCRIPT_LIMIT)
    })
    proc.onExit(() => { handle.exited = true })
    this.sessions.set(key, handle)
    return handle
  }

  /** Resize one terminal. */
  resize(sessionId: string, tab: string, cols: number, rows: number): void {
    this.sessions.get(`${sessionId}:${tab}`)?.pty.resize(clampCols(cols), clampRows(rows))
  }

  /** Kill one terminal immediately. */
  kill(sessionId: string, tab: string): void {
    this.killKey(`${sessionId}:${tab}`)
  }

  /** Schedule a graceful close (reconnect grace) for one terminal. */
  scheduleClose(sessionId: string, tab: string, graceMs: number): void {
    const key = `${sessionId}:${tab}`
    const existing = this.pendingCloses.get(key)
    if (existing !== undefined) clearTimeout(existing)
    this.pendingCloses.set(key, setTimeout(() => { this.killKey(key) }, graceMs))
  }

  /** Cancel a pending graceful close (a reconnect reopened the terminal). */
  cancelClose(sessionId: string, tab: string): void {
    const key = `${sessionId}:${tab}`
    const pending = this.pendingCloses.get(key)
    if (pending !== undefined) {
      clearTimeout(pending)
      this.pendingCloses.delete(key)
    }
  }

  /** Kill every terminal (plugin teardown). */
  killAll(): void {
    for (const pending of this.pendingCloses.values()) clearTimeout(pending)
    this.pendingCloses.clear()
    for (const handle of this.sessions.values()) handle.pty.kill()
    this.sessions.clear()
  }

  /** Drop the oldest live terminal of a session when the quota is reached. */
  private ensureQuota(sessionId: string): void {
    const handles = [...this.sessions.values()]
      .filter(handle => handle.sessionId === sessionId)
      .sort((a, b) => (a.key < b.key ? -1 : 1))
    while (handles.length >= this.maxPerSession) {
      const oldest = handles.shift()
      if (oldest === undefined) break
      this.killKey(oldest.key)
    }
  }

  private killKey(key: string): void {
    const handle = this.sessions.get(key)
    if (handle !== undefined) {
      handle.pty.kill()
      this.sessions.delete(key)
    }
    const pending = this.pendingCloses.get(key)
    if (pending !== undefined) {
      clearTimeout(pending)
      this.pendingCloses.delete(key)
    }
  }
}

function clampCols(cols: number): number {
  return Math.max(2, Math.min(500, Math.round(cols)))
}

function clampRows(rows: number): number {
  return Math.max(2, Math.min(200, Math.round(rows)))
}
