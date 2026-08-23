/**
 * Session-header bookmarks entry: a trigger button with a live count and an
 * absolutely-positioned panel listing the session's bookmarks. Each row
 * supports jumping back to the message (scroll to its chat anchor), copying
 * the excerpt, editing a note, and deleting. Follows the ui-jobs popover
 * pattern: the surface stays inside the trigger's root so outside-pointer
 * dismissal keeps working without a portal.
 * @module dsh-skill-7d-viewer/client/BookmarksButton
 */

import { useRef, useState, type KeyboardEvent } from 'react'
import {
  IconCopyOutline16, IconLinkOutline16, IconListPenOutline16, IconTrashOutline16,
  useDismissOnOutsidePointer, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { Bookmark } from './types.ts'
import type { BookmarksButtonProps } from './slots.ts'
import css from './bookmarks.module.css'

/** Relative timestamp in the browser's own locale (no plugin dictionary needed). */
function formatRelative(timestamp: number): string {
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000)
  const abs = Math.abs(deltaSeconds)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (abs < 60) return rtf.format(deltaSeconds, 'second')
  if (abs < 3600) return rtf.format(Math.round(deltaSeconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(deltaSeconds / 3600), 'hour')
  return rtf.format(Math.round(deltaSeconds / 86_400), 'day')
}

/** Cap the on-screen count badge. */
function displayCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/** One bookmark row: excerpt, meta, note editor, and the three actions. */
function BookmarkRow({
  bookmark, jump, remove, setNote, t,
}: {
  bookmark: Bookmark
  jump: (bookmark: Bookmark) => void
  remove: (messageId: string) => void
  setNote: (messageId: string, note: string) => void
  t: (key: 'jump' | 'copy' | 'delete' | 'notePlaceholder') => string
}) {
  const noteRef = useRef<HTMLInputElement>(null)
  const commitNote = (): void => {
    const value = noteRef.current?.value.trim() ?? ''
    setNote(bookmark.messageId, value)
  }
  return (
    <li className={css.item}>
      <button type="button" className={css.itemExcerpt} onClick={() => { jump(bookmark) }} title={t('jump')}>
        {bookmark.excerpt === '' ? '…' : bookmark.excerpt}
      </button>
      <div className={css.itemMeta}>
        <span className={css.itemTime}>{formatRelative(bookmark.createdAt)}</span>
        <input
          ref={noteRef}
          className={css.noteInput}
          type="text"
          defaultValue={bookmark.note}
          placeholder={t('notePlaceholder')}
          aria-label={t('notePlaceholder')}
          onBlur={commitNote}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              noteRef.current?.blur()
            }
          }}
        />
      </div>
      <div className={css.itemActions}>
        <button type="button" className={css.action} data-dsh-bookmark-jump="" onClick={() => { jump(bookmark) }} aria-label={t('jump')} title={t('jump')}>
          <IconLinkOutline16 />
        </button>
        <button
          type="button"
          className={css.action}
          onClick={() => { void writeClipboard(bookmark.excerpt) }}
          aria-label={t('copy')}
          title={t('copy')}
        >
          <IconCopyOutline16 />
        </button>
        <button type="button" className={css.action} onClick={() => { remove(bookmark.messageId) }} aria-label={t('delete')} title={t('delete')}>
          <IconTrashOutline16 />
        </button>
      </div>
    </li>
  )
}

/**
 * Session-header bookmarks control.
 * @param props - runtime slot currency, the injected verbs, and the live bookmark source.
 * @returns the trigger and its panel.
 */
export function BookmarksButton({ useBookmarks, remove, setNote, t }: BookmarksButtonProps) {
  const bookmarks = useBookmarks(snapshot => snapshot.bookmarks)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useDismissOnOutsidePointer(rootRef, open, setOpen)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    setOpen(false)
    triggerRef.current?.focus()
  }

  const jump = (bookmark: Bookmark): void => {
    if (bookmark.anchorKey !== '') {
      const row = document.querySelector<HTMLElement>(
        `[data-chat-anchor-key="${CSS.escape(bookmark.anchorKey)}"]`,
      )
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        data-dsh-bookmarks-trigger=""
        aria-expanded={open}
        aria-label={t('panelOpen')}
        onClick={() => { setOpen(current => !current) }}
      >
        <IconListPenOutline16 />
        {bookmarks.length > 0
          ? <span className={css.count}>{displayCount(bookmarks.length)}</span>
          : null}
      </button>
      {open
        ? (
          <div className={css.panel} data-dsh-bookmarks-panel="" role="dialog" aria-label={t('panelTitle')}>
            <div className={css.panelTitle}>{t('panelTitle')}</div>
            {bookmarks.length === 0
              ? (
                <div className={css.empty}>
                  <div className={css.emptyTitle}>{t('empty')}</div>
                  <div className={css.emptyHint}>{t('emptyHint')}</div>
                </div>
              )
              : (
                <ul className={css.list}>
                  {bookmarks.map(bookmark => (
                    <BookmarkRow
                      key={bookmark.messageId}
                      bookmark={bookmark}
                      jump={jump}
                      remove={remove}
                      setNote={setNote}
                      t={t}
                    />
                  ))}
                </ul>
              )}
          </div>
        )
        : null}
    </div>
  )
}
