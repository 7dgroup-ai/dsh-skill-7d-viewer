/**
 * Per-session bookmark store. Bookmarks persist to `localStorage` keyed by
 * session id, so they survive a page refresh while staying isolated per
 * conversation. Storage is best-effort: a full or blocked `localStorage`
 * (private mode) degrades to in-memory state without throwing.
 *
 * The controller exposes the bare `getSnapshot`/`subscribe` pair the slot
 * framework expects from a `HostObservable`, so the render machinery binds it
 * into a `useBookmarks` selector hook. No React import lives here.
 * @module dsh-skill-7d-viewer/client/store
 */

import type { Bookmark, BookmarkStoreState } from './types.ts'

/** `localStorage` key prefix; one key per session id. */
const STORAGE_PREFIX = 'dsh-skill-7d-viewer:'

function storageKey(sessionId: string): string {
  return STORAGE_PREFIX + sessionId
}

/** Whether an unknown value is one stored bookmark. */
function isBookmark(value: unknown): value is Bookmark {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.messageId === 'string'
    && typeof record.anchorKey === 'string'
    && typeof record.excerpt === 'string'
    && typeof record.createdAt === 'number'
    && typeof record.note === 'string'
}

/** Whether an unknown value is a stored bookmark state. */
function isState(value: unknown): value is BookmarkStoreState {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.bookmarks) && record.bookmarks.every(isBookmark)
}

/** Load a session's bookmarks, returning the empty state on any parse/validation failure. */
function load(sessionId: string): BookmarkStoreState {
  try {
    const raw = localStorage.getItem(storageKey(sessionId))
    if (raw === null) return { bookmarks: [] }
    const parsed: unknown = JSON.parse(raw)
    return isState(parsed) ? parsed : { bookmarks: [] }
  } catch {
    return { bookmarks: [] }
  }
}

/** Persist a session's bookmarks, swallowing storage failures (best-effort). */
function save(sessionId: string, state: BookmarkStoreState): void {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(state))
  } catch {
    // Storage full or unavailable: keep the in-memory state for this page life.
  }
}

/**
 * One session's bookmark controller. Holds the immutable state snapshot and a
 * listener set; every mutation commits a fresh snapshot and notifies listeners.
 */
export class BookmarkController {
  private state: BookmarkStoreState
  private readonly listeners = new Set<() => void>()

  constructor(private readonly sessionId: string) {
    this.state = load(sessionId)
  }

  /** The current state snapshot (stable reference until the next commit). */
  getSnapshot = (): BookmarkStoreState => this.state

  /** Subscribe to state changes; the returned disposer unsubscribes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Whether a message is already bookmarked in this session. */
  isBookmarked(messageId: string): boolean {
    return this.state.bookmarks.some(bookmark => bookmark.messageId === messageId)
  }

  /** Add a bookmark; an existing bookmark for the same message is a no-op. */
  add(bookmark: Bookmark): void {
    if (this.isBookmarked(bookmark.messageId)) return
    this.commit({ bookmarks: [...this.state.bookmarks, bookmark] })
  }

  /** Remove a bookmark by message id; a missing bookmark is a no-op. */
  remove(messageId: string): void {
    const bookmarks = this.state.bookmarks.filter(bookmark => bookmark.messageId !== messageId)
    if (bookmarks.length === this.state.bookmarks.length) return
    this.commit({ bookmarks })
  }

  /** Replace one bookmark's note. */
  setNote(messageId: string, note: string): void {
    const bookmarks = this.state.bookmarks.map(
      bookmark => bookmark.messageId === messageId ? { ...bookmark, note } : bookmark,
    )
    this.commit({ bookmarks })
  }

  /** Drop all listeners (called on plugin teardown). */
  dispose(): void {
    this.listeners.clear()
  }

  private commit(next: BookmarkStoreState): void {
    this.state = next
    save(this.sessionId, next)
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Per-session controller manager. One controller per session id, created
 * lazily and shared across the two slot entries (per-message action + header
 * panel) so both read the same live state. Created inside `apply()`, never at
 * module scope.
 */
export class BookmarkManager {
  private readonly controllers = new Map<string, BookmarkController>()

  /** The controller for one session, created on first access. */
  for(sessionId: string): BookmarkController {
    let controller = this.controllers.get(sessionId)
    if (controller === undefined) {
      controller = new BookmarkController(sessionId)
      this.controllers.set(sessionId, controller)
    }
    return controller
  }

  /** Dispose every controller (called on plugin teardown). */
  dispose(): void {
    for (const controller of this.controllers.values()) controller.dispose()
    this.controllers.clear()
  }
}
