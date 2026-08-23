/**
 * Locale dictionaries for the bookmark plugin. The namespace string is also
 * the `LocaleNamespaceMap` key merged below; `t()` inside components is typed
 * against {@link BookmarkKey}.
 * @module dsh-skill-7d-viewer/client/locales
 */

/** Locale namespace id; kept in sync with the `locale:` field on every slot entry. */
export const NS = 'bookmark' as const

/** The dictionary keys (typed union of zh + en keys). */
export type BookmarkKey = keyof typeof en

/** English dictionary. */
export const en = {
  add: 'Bookmark',
  remove: 'Remove bookmark',
  panelTitle: 'Bookmarks',
  panelOpen: 'Open bookmarks',
  empty: 'No bookmarks yet',
  emptyHint: 'Bookmark an assistant reply to pin it here',
  jump: 'Jump to message',
  copy: 'Copy excerpt',
  delete: 'Delete',
  notePlaceholder: 'Add a note…',
  copied: 'Copied',
} as const

/** Simplified Chinese dictionary. */
export const zh: Record<BookmarkKey, string> = {
  add: '收藏',
  remove: '取消收藏',
  panelTitle: '书签',
  panelOpen: '打开书签',
  empty: '还没有书签',
  emptyHint: '在助手回复上点击收藏，即可固定到这里',
  jump: '跳转到消息',
  copy: '复制摘要',
  delete: '删除',
  notePlaceholder: '添加备注…',
  copied: '已复制',
}
