/**
 * dsh-skill-7d-viewer client half: registers the zh/en dictionaries and
 * contributes two slot entries — a per-message bookmark toggle inside each
 * finalized assistant message, and a session-header bookmarks panel. Both
 * entries share one per-session controller (created lazily, never at module
 * scope) so their state stays in lockstep and tears down on fiber disposal.
 * @module dsh-skill-7d-viewer/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale service's Context augmentation (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { BookmarkAction } from './BookmarkAction.tsx'
import { BookmarksButton } from './BookmarksButton.tsx'
import { en, NS, zh } from './locales.ts'
import { BookmarkManager } from './store.ts'
import type { Bookmark } from './types.ts'

/** Required client services for locale registration and slot contribution. */
export const inject = ['sessions', 'slots', 'locale']

/**
 * Client plugin body.
 * @param ctx - client root context (slots, sessions, locale).
 */
export function apply(ctx: ClientContext): void {
  // Dictionaries follow the DSH i18n system and switch live with the host language.
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-skill-7d-viewer: dictionaries')

  // One manager per activation; the two entries below share its controllers.
  const manager = new BookmarkManager()

  const faceFor = (sessionId: string) => {
    const controller = manager.for(sessionId)
    return {
      hooks: { bookmarks: controller },
      add: (bookmark: Bookmark) => controller.add(bookmark),
      remove: (messageId: string) => controller.remove(messageId),
      setNote: (messageId: string, note: string) => controller.setNote(messageId, note),
    }
  }

  // Per-message bookmark toggle.
  ctx.slots.inject('conversation.chat.assistant-actions', () => {
    const dispose = ctx.slots.register({
      name: 'conversation.chat.assistant-actions',
      id: 'bookmark',
      order: 20,
      locale: NS,
      inject: faceFor,
    }, BookmarkAction)
    return dispose
  })

  // Session-header bookmarks panel.
  ctx.slots.inject('conversation.session.header.actions', () => {
    const dispose = ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'bookmarks',
      order: 30,
      locale: NS,
      inject: faceFor,
    }, BookmarksButton)
    return dispose
  })

  ctx.effect(() => () => manager.dispose(), 'dsh-skill-7d-viewer: teardown')
}
