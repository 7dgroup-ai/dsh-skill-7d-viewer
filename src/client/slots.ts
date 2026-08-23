/**
 * Slot-entry prop contracts for the bookmark plugin. The two slots are
 * declared by ui-conversation, so this file only contributes the entries and
 * their injected faces (mirroring ui-message-feedback's shape). The
 * `LocaleNamespaceMap` merge registers the plugin's dictionary namespace so
 * `PropsLocale<'bookmark'>` types the `t` seat.
 * @module dsh-skill-7d-viewer/client/slots
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-conversation's SlotMap merge so the slot names below resolve.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS, type BookmarkKey } from './locales.ts'
import type { Bookmark, BookmarkObservable } from './types.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'bookmark': BookmarkKey
  }
}

/** Injected business face shared by the per-message action and the header panel. */
export interface BookmarkInjected {
  /** Live per-session state source; the framework binds it into `useBookmarks`. */
  hooks: { bookmarks: BookmarkObservable }
  /** Save a bookmark (idempotent per message). */
  add: (bookmark: Bookmark) => void
  /** Remove one bookmark by message id. */
  remove: (messageId: string) => void
  /** Replace one bookmark's note. */
  setNote: (messageId: string, note: string) => void
}

/** Full props of the per-message bookmark toggle entry. */
export type BookmarkActionProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<BookmarkInjected>
  & PropsLocale<typeof NS>

/** Full props of the session-header bookmarks entry. */
export type BookmarksButtonProps =
  PropsRuntime<'conversation.session.header.actions'>
  & InjectFace<BookmarkInjected>
  & PropsLocale<typeof NS>
