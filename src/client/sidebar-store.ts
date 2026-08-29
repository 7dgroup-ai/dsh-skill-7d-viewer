/**
 * The sidebar viewer's state store: a bare observable (getSnapshot/subscribe)
 * holding the sidebar open flag, the produced-file list, and the currently
 * opened file's content / edit draft / markdown mode. React-free so it is
 * unit-testable; a load-generation counter discards stale reads.
 * @module dsh-skill-7d-viewer/client/sidebar-store
 */

import { mediaUrl, readFile, revealFolder, writeFile } from './api.ts'
import { isImagePath, isMarkdownPath } from './file-types.ts'
import type { ProducedFile } from './produced-files.ts'

/** Markdown display mode. */
export type MarkdownMode = 'source' | 'preview'

/** The resolved display status of the open file. */
export type ViewerStatus = 'loading' | 'text' | 'image' | 'binary' | 'error'

/** The observable state the sidebar renders from. */
export interface ViewerState {
  sidebarOpen: boolean
  width: number
  listWidth: number
  files: ProducedFile[]
  selectedPath: string | null
  terminalTab: string | null
  status: ViewerStatus
  content: string
  savedContent: string
  truncated: boolean
  size: number
  error: string
  markdownMode: MarkdownMode
  saving: boolean
}

/** Sidebar width bounds and defaults. */
export const VIEWER_MIN_WIDTH = 280
const VIEWER_DEFAULT_WIDTH = 380
const WIDTH_STORAGE_KEY = 'dsh-skill-7d-viewer:width'
/** Keep at least this many pixels for the main conversation column. */
const VIEWER_MIN_GUTTER = 160

/** The widest the sidebar may be: all but a gutter of the viewport. */
function maxWidth(): number {
  if (typeof window === 'undefined') return 1600
  return Math.max(VIEWER_MIN_WIDTH, window.innerWidth - VIEWER_MIN_GUTTER)
}

/** Clamp a raw width into the valid range. */
function clampWidth(value: number): number {
  return Math.min(maxWidth(), Math.max(VIEWER_MIN_WIDTH, Math.round(value)))
}

/** Load the persisted sidebar width (clamped; default when absent/invalid). */
function loadWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
    if (raw === null) return VIEWER_DEFAULT_WIDTH
    const value = Number(raw)
    if (!Number.isFinite(value)) return VIEWER_DEFAULT_WIDTH
    return clampWidth(value)
  } catch {
    return VIEWER_DEFAULT_WIDTH
  }
}

/** File-list column width bounds and defaults. */
export const LIST_MIN_WIDTH = 140
const LIST_DEFAULT_WIDTH = 200
const LIST_WIDTH_STORAGE_KEY = 'dsh-skill-7d-viewer:list-width'
/** Keep at least this many pixels for the content pane. */
const LIST_MIN_CONTENT_GUTTER = 160

/** Load the persisted file-list width (clamped; default when absent/invalid). */
function loadListWidth(): number {
  try {
    const raw = localStorage.getItem(LIST_WIDTH_STORAGE_KEY)
    if (raw === null) return LIST_DEFAULT_WIDTH
    const value = Number(raw)
    if (!Number.isFinite(value)) return LIST_DEFAULT_WIDTH
    return Math.max(LIST_MIN_WIDTH, Math.round(value))
  } catch {
    return LIST_DEFAULT_WIDTH
  }
}

const INITIAL_STATE: ViewerState = {
  sidebarOpen: true,
  width: loadWidth(),
  listWidth: loadListWidth(),
  files: [],
  selectedPath: null,
  terminalTab: null,
  status: 'loading',
  content: '',
  savedContent: '',
  truncated: false,
  size: 0,
  error: '',
  markdownMode: 'source',
  saving: false,
}

/**
 * One sidebar viewer's state. Created per activation, never at module scope.
 */
export class ViewerStore {
  private state: ViewerState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private loadSeq = 0
  private terminalSeq = 0
  private sessionId = ''
  private cwd = ''

  getSnapshot = (): ViewerState => this.state

  /** The current session working directory (for tree building). */
  getCwd(): string {
    return this.cwd
  }

  /** The current session id. */
  getSessionId(): string {
    return this.sessionId
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Set the session context + produced files; a session switch resets the viewer. */
  setSession(sessionId: string, cwd: string, files: ProducedFile[]): void {
    const sessionChanged = this.sessionId !== sessionId
    this.sessionId = sessionId
    this.cwd = cwd
    if (sessionChanged) {
      this.commit({ ...INITIAL_STATE, sidebarOpen: this.state.sidebarOpen, width: this.state.width, listWidth: this.state.listWidth, files })
    } else {
      this.commit({ ...this.state, files })
    }
  }

  toggleSidebar(): void {
    this.commit({ ...this.state, sidebarOpen: !this.state.sidebarOpen })
  }

  openSidebar(): void {
    this.commit({ ...this.state, sidebarOpen: true })
  }

  /** Open a new terminal (replacing the file view). */
  openTerminal(): void {
    const tab = `terminal-${++this.terminalSeq}`
    this.commit({ ...this.state, terminalTab: tab, selectedPath: null })
  }

  /** Close the open terminal (back to the file view). */
  closeTerminal(): void {
    this.commit({ ...this.state, terminalTab: null })
  }

  /** Set the sidebar width (clamped to the viewport) and persist it. */
  setWidth(width: number): void {
    const clamped = clampWidth(width)
    if (clamped === this.state.width) return
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped))
    } catch {
      /* best-effort persistence */
    }
    this.commit({ ...this.state, width: clamped })
  }

  /** Set the file-list column width (clamped to leave content room) and persist it. */
  setListWidth(width: number): void {
    const max = Math.max(LIST_MIN_WIDTH, this.state.width - LIST_MIN_CONTENT_GUTTER)
    const clamped = Math.min(max, Math.max(LIST_MIN_WIDTH, Math.round(width)))
    if (clamped === this.state.listWidth) return
    try {
      localStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(clamped))
    } catch {
      /* best-effort persistence */
    }
    this.commit({ ...this.state, listWidth: clamped })
  }

  openFile(path: string): void {
    const seq = ++this.loadSeq
    this.commit({
      ...this.state,
      selectedPath: path,
      terminalTab: null,
      status: 'loading',
      content: '',
      savedContent: '',
      error: '',
      markdownMode: 'source',
    })
    void this.load(seq, path)
  }

  closeFile(): void {
    this.loadSeq++
    this.commit({ ...this.state, selectedPath: null, status: 'loading', content: '', savedContent: '', error: '' })
  }

  setContent(content: string): void {
    this.commit({ ...this.state, content })
  }

  setMarkdownMode(markdownMode: MarkdownMode): void {
    this.commit({ ...this.state, markdownMode })
  }

  isDirty(): boolean {
    return this.state.content !== this.state.savedContent
  }

  isMarkdown(): boolean {
    return this.state.selectedPath !== null && isMarkdownPath(this.state.selectedPath)
  }

  mediaUrl(): string {
    return mediaUrl(this.sessionId, this.state.selectedPath ?? '', this.cwd)
  }

  async save(): Promise<void> {
    if (this.state.selectedPath === null) return
    this.commit({ ...this.state, saving: true })
    try {
      await writeFile(this.sessionId, this.state.selectedPath, this.state.content, this.cwd)
      this.commit({ ...this.state, saving: false, savedContent: this.state.content })
    } catch (error) {
      this.commit({ ...this.state, saving: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  /** Open a folder in the OS file manager (Finder on macOS). */
  async reveal(path: string): Promise<void> {
    await revealFolder(this.sessionId, path, this.cwd)
  }

  dispose(): void {
    this.listeners.clear()
  }

  private async load(seq: number, path: string): Promise<void> {
    try {
      const result = await readFile(this.sessionId, path, this.cwd)
      if (seq !== this.loadSeq) return
      if (result.kind === 'text') {
        this.commit({
          ...this.state,
          status: 'text',
          content: result.content,
          savedContent: result.content,
          truncated: result.truncated,
          size: result.size,
        })
      } else {
        this.commit({
          ...this.state,
          status: isImagePath(path) ? 'image' : 'binary',
          truncated: result.truncated,
          size: result.size,
        })
      }
    } catch (error) {
      if (seq !== this.loadSeq) return
      this.commit({ ...this.state, status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  private commit(next: ViewerState): void {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}
