import { beforeEach, describe, expect, it } from 'vitest'
import { BookmarkController, BookmarkManager } from '../src/client/store.ts'
import type { Bookmark } from '../src/client/types.ts'

/** Install an in-memory localStorage stub and return its backing map. */
function installStorage(): Map<string, string> {
  const map = new Map<string, string>()
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  return map
}

function bookmark(messageId: string): Bookmark {
  return { messageId, anchorKey: `k:${messageId}`, excerpt: 'hello', createdAt: 1, note: '' }
}

beforeEach(() => {
  installStorage()
})

describe('BookmarkController', () => {
  it('starts empty', () => {
    const controller = new BookmarkController('session-a')
    expect(controller.getSnapshot().bookmarks).toEqual([])
  })

  it('adds a bookmark and reports bookmarked state', () => {
    const controller = new BookmarkController('session-a')
    controller.add(bookmark('m1'))
    expect(controller.isBookmarked('m1')).toBe(true)
    expect(controller.getSnapshot().bookmarks).toHaveLength(1)
  })

  it('adding the same message twice is a no-op', () => {
    const controller = new BookmarkController('session-a')
    controller.add(bookmark('m1'))
    controller.add(bookmark('m1'))
    expect(controller.getSnapshot().bookmarks).toHaveLength(1)
  })

  it('removes a bookmark', () => {
    const controller = new BookmarkController('session-a')
    controller.add(bookmark('m1'))
    controller.remove('m1')
    expect(controller.isBookmarked('m1')).toBe(false)
    expect(controller.getSnapshot().bookmarks).toEqual([])
  })

  it('replaces a note without touching other fields', () => {
    const controller = new BookmarkController('session-a')
    controller.add(bookmark('m1'))
    controller.setNote('m1', 'remember this')
    const saved = controller.getSnapshot().bookmarks[0]
    expect(saved.note).toBe('remember this')
    expect(saved.messageId).toBe('m1')
  })

  it('persists across controller instances for the same session', () => {
    const first = new BookmarkController('session-a')
    first.add(bookmark('m1'))
    const second = new BookmarkController('session-a')
    expect(second.getSnapshot().bookmarks).toHaveLength(1)
    expect(second.isBookmarked('m1')).toBe(true)
  })

  it('isolates bookmarks per session', () => {
    const a = new BookmarkController('session-a')
    const b = new BookmarkController('session-b')
    a.add(bookmark('m1'))
    expect(b.getSnapshot().bookmarks).toEqual([])
  })

  it('notifies subscribers on change and unsubscribes cleanly', () => {
    const controller = new BookmarkController('session-a')
    const seen: number[] = []
    const unsubscribe = controller.subscribe(() => { seen.push(controller.getSnapshot().bookmarks.length) })
    controller.add(bookmark('m1'))
    controller.add(bookmark('m2'))
    unsubscribe()
    controller.add(bookmark('m3'))
    expect(seen).toEqual([1, 2])
  })

  it('degrades to empty on corrupted persisted data', () => {
    const storage = installStorage()
    storage.set('dsh-skill-7d-viewer:session-a', '{not json')
    const controller = new BookmarkController('session-a')
    expect(controller.getSnapshot().bookmarks).toEqual([])
  })
})

describe('BookmarkManager', () => {
  it('shares one controller per session id', () => {
    const manager = new BookmarkManager()
    expect(manager.for('session-a')).toBe(manager.for('session-a'))
    expect(manager.for('session-a')).not.toBe(manager.for('session-b'))
    manager.dispose()
  })
})
