/**
 * Per-message bookmark toggle, rendered inside each finalized assistant
 * message's IconActions row. The click resolves the message's visible prose
 * and chat-node anchor from the live conversation snapshot, then adds or
 * removes the bookmark through the injected verbs.
 * @module dsh-skill-7d-viewer/client/BookmarkAction
 */

import { useCallback } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { assistantText, findAssistantNode } from './conversation.ts'
import { BookmarkRibbonIcon } from './icons.tsx'
import type { BookmarkActionProps } from './slots.ts'
import css from './bookmarks.module.css'

/** Cap on the stored excerpt, long enough to be useful without bloating storage. */
const EXCERPT_LIMIT = 200

/**
 * One message's bookmark control.
 * @param props - the owner's message identity, the injected verbs, and the live bookmark source.
 * @returns a ghost icon button toggling the bookmark.
 */
export function BookmarkAction({
  messageId, useSession, useBookmarks, add, remove, t,
}: BookmarkActionProps) {
  // Stable chat-node reference (or undefined when the message is out of window).
  const node = useSession(snapshot => findAssistantNode(snapshot, messageId))
  const bookmarked = useBookmarks(
    snapshot => snapshot.bookmarks.some(bookmark => bookmark.messageId === messageId),
  )

  const toggle = useCallback(() => {
    if (bookmarked) {
      remove(messageId)
      return
    }
    const excerpt = node?.data === undefined ? '' : assistantText(node.data.blocks ?? [])
    add({
      messageId,
      anchorKey: node?.key ?? '',
      excerpt: excerpt.slice(0, EXCERPT_LIMIT),
      createdAt: Date.now(),
      note: '',
    })
  }, [bookmarked, messageId, node, add, remove])

  return (
    <Tooltip label={bookmarked ? t('remove') : t('add')} side="top">
      <button
        type="button"
        className={bookmarked ? `${css.iconButton} ${css.iconButtonActive}` : css.iconButton}
        onClick={toggle}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? t('remove') : t('add')}
      >
        <BookmarkRibbonIcon filled={bookmarked} />
      </button>
    </Tooltip>
  )
}
