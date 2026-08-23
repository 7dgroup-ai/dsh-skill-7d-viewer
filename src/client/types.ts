/**
 * Shared data vocabulary for the bookmark plugin.
 * @module dsh-skill-7d-viewer/client/types
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/** One saved bookmark pointing at a finalized assistant message. */
export interface Bookmark {
  /** Stable assistant message identity (from the assistant-actions owner prop). */
  messageId: string
  /** The engine-owned chat node key used as the DOM scroll anchor (`data-chat-anchor-key`). */
  anchorKey: string
  /** Plain-text excerpt captured at bookmark time, for the list row. */
  excerpt: string
  /** Unix epoch ms when the bookmark was created. */
  createdAt: number
  /** Optional user note. */
  note: string
}

/** The observable state one session's bookmark controller exposes. */
export interface BookmarkStoreState {
  bookmarks: readonly Bookmark[]
}

/** The bare snapshot-source face the slot framework binds into a `useBookmarks` hook. */
export type BookmarkObservable = HostObservable<BookmarkStoreState>
