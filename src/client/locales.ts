/**
 * Minimal zh/en copy for the sidebar viewer. The sidebar mounts its own React
 * root outside the slot system's locale seat, so `attachLocale` holds the DSH
 * locale service (`ctx.locale`) in a module-level holder and `t()` resolves the
 * active locale from it.
 * @module dsh-skill-7d-viewer/client/locales
 */

/** Simplified Chinese dictionary. */
export const zh = {
  title: '7D-Viewer',
  expand: '展开查看器',
  collapse: '收起查看器',
  close: '关闭',
  back: '返回文件列表',
  files: '生成的文件',
  noFiles: '暂无生成的文件',
  selectFile: '选择一个文件查看',
  producedFiles: '生成文件',
  workspace: '工作区',
  terminal: '终端',
  reveal: '在 Finder 中打开',
  turn: '第 {n} 轮',
  source: '源码',
  preview: '预览',
  save: '保存',
  saving: '保存中…',
  saved: '已保存',
  loading: '加载中…',
  binary: '二进制文件，无法预览',
  truncated: '文件过大，仅显示前一部分',
  error: '加载失败',
} as const

/** English dictionary. */
export const en: Record<CopyKey, string> = {
  title: '7D-Viewer',
  expand: 'Expand viewer',
  collapse: 'Collapse viewer',
  close: 'Close',
  back: 'Back to files',
  files: 'Produced files',
  noFiles: 'No files yet',
  selectFile: 'Select a file to view',
  producedFiles: 'Produced',
  workspace: 'Workspace',
  terminal: 'Terminal',
  reveal: 'Reveal in Finder',
  turn: 'Turn {n}',
  source: 'Source',
  preview: 'Preview',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved',
  loading: 'Loading…',
  binary: 'Binary file — cannot preview',
  truncated: 'File too large — showing a prefix',
  error: 'Failed to load',
}

/** The dictionary keys (typed union of zh + en keys). */
export type CopyKey = keyof typeof zh

/** The locale service face the sidebar reads (a subset of the DSH locale service). */
interface LocaleFace {
  getSnapshot(): { active: string }
}

let localeService: LocaleFace | undefined

/** Attach (or detach, with undefined) the DSH locale service. */
export function attachLocale(service: LocaleFace | undefined): void {
  localeService = service
}

/** The active locale id ('zh' | 'en' | browser fallback). */
function activeLocale(): string {
  return localeService?.getSnapshot().active
    ?? (typeof navigator !== 'undefined' ? navigator.language : '')
    ?? 'en'
}

/** Translate a copy key in the active locale (zh → zh, else en). */
export function t(key: CopyKey, params?: Record<string, string | number>): string {
  const dict = activeLocale().toLowerCase().startsWith('zh') ? zh : en
  let text: string = dict[key]
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}
