/**
 * The right sidebar viewer: a Finder-style folder/file tree of produced files
 * and a viewer pane for the selected file. Code renders in CodeMirror (syntax
 * highlighting + save); markdown adds a source/preview toggle; images render
 * inline. Pushes the main column via the `--dsh-viewer-width` variable.
 * @module dsh-skill-7d-viewer/client/Sidebar
 */

import { useCallback, useEffect, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import {
  IconCheckOutline16, IconChevronDownOutline14, IconChevronLeftOutline14, IconChevronRightOutline14,
  IconCloseOutline16, IconEditOutline16, IconFolderClose16, IconFolderOpen16, IconRightUpOutline14,
  IconSparkle16, MarkdownText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { CodeEditor } from './CodeEditor.tsx'
import { buildFileTree, type FileTreeNode } from './file-tree.ts'
import { t } from './locales.ts'
import type { ViewerStore } from './sidebar-store.ts'
import css from './sidebar.module.css'
import './layout.css'

/** Last path segment for display (browser-safe, no node:path). */
function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? path : path.slice(idx + 1)
}

/** One tree row (folder or file). */
function TreeItem({ node, depth, expanded, onToggle, onOpen, onReveal }: {
  node: FileTreeNode
  depth: number
  expanded: ReadonlySet<string>
  onToggle: (path: string) => void
  onOpen: (path: string) => void
  onReveal: (path: string) => void
}) {
  if (node.type === 'folder') {
    const open = expanded.has(node.path)
    return (
      <div>
        <div className={css.treeRow} style={{ paddingLeft: 4 + depth * 14 }}>
          <button type="button" className={css.treeRowMain} onClick={() => onToggle(node.path)}>
            {open ? <IconChevronDownOutline14 className={css.treeChevron} /> : <IconChevronRightOutline14 className={css.treeChevron} />}
            {open ? <IconFolderOpen16 className={css.treeIcon} /> : <IconFolderClose16 className={css.treeIcon} />}
            <span className={css.treeName}>{node.name}</span>
          </button>
          <button
            type="button"
            className={css.treeReveal}
            onClick={() => onReveal(node.path)}
            aria-label={t('reveal')}
            title={t('reveal')}
          >
            <IconRightUpOutline14 />
          </button>
        </div>
        {open && node.children.map(child => (
          <TreeItem key={child.path} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onOpen={onOpen} onReveal={onReveal} />
        ))}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={css.treeRow}
      style={{ paddingLeft: 4 + depth * 14 + 34 }}
      title={node.path}
      onClick={() => onOpen(node.path)}
    >
      <span className={css.treeName}>{node.name}</span>
    </button>
  )
}

/** The produced-file tree (Finder-like). */
function FileTree({ root, onOpen, onReveal }: { root: FileTreeNode; onOpen: (path: string) => void; onReveal: (path: string) => void }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set([root.path]))
  const toggle = (path: string): void => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }
  return (
    <div className={css.tree}>
      <TreeItem node={root} depth={0} expanded={expanded} onToggle={toggle} onOpen={onOpen} onReveal={onReveal} />
    </div>
  )
}

/** The viewer pane for the selected file. */
function ViewerPane({ store }: { store: ViewerStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const markdown = store.isMarkdown()
  const showSource = !markdown || state.markdownMode === 'source'

  return (
    <div className={css.viewer}>
      <div className={css.viewerHeader}>
        <button type="button" className={css.iconButton} onClick={() => store.closeFile()} aria-label={t('back')} title={t('back')}>
          <IconChevronLeftOutline14 />
        </button>
        <span className={css.viewerTitle} title={state.selectedPath ?? ''}>{basename(state.selectedPath ?? '')}</span>
        <div className={css.viewerActions}>
          {markdown && (
            <button
              type="button"
              className={showSource ? `${css.iconButton} ${css.iconButtonActive}` : css.iconButton}
              onClick={() => store.setMarkdownMode('source')}
              aria-label={t('source')}
              title={t('source')}
            >
              <IconEditOutline16 />
            </button>
          )}
          {markdown && (
            <button
              type="button"
              className={!showSource ? `${css.iconButton} ${css.iconButtonActive}` : css.iconButton}
              onClick={() => store.setMarkdownMode('preview')}
              aria-label={t('preview')}
              title={t('preview')}
            >
              <IconSparkle16 />
            </button>
          )}
          {(state.status === 'text') && (
            <button
              type="button"
              className={css.saveButton}
              disabled={!store.isDirty() || state.saving || state.truncated}
              onClick={() => { void store.save() }}
            >
              <IconCheckOutline16 />
              {state.saving ? t('saving') : t('save')}
            </button>
          )}
        </div>
      </div>
      <div className={css.viewerBody}>
        {state.status === 'loading' && <div className={css.placeholder}>{t('loading')}</div>}
        {state.status === 'text' && showSource && (
          <div className={css.textWrap}>
            <CodeEditor
              content={state.content}
              path={state.selectedPath ?? ''}
              readOnly={state.truncated}
              onChange={text => store.setContent(text)}
              onSave={() => { void store.save() }}
            />
            {state.truncated && <div className={css.truncated}>{t('truncated')}</div>}
          </div>
        )}
        {state.status === 'text' && !showSource && (
          <div className={css.preview}>
            <MarkdownText text={state.content} />
          </div>
        )}
        {state.status === 'image' && <img className={css.image} src={store.mediaUrl()} alt={basename(state.selectedPath ?? '')} />}
        {state.status === 'binary' && <div className={css.placeholder}>{t('binary')}</div>}
        {state.status === 'error' && <div className={css.placeholder}>{`${t('error')}: ${state.error}`}</div>}
      </div>
    </div>
  )
}

/**
 * Render the sidebar viewer.
 * @param store - the viewer store driving open/close + content.
 * @returns the sidebar panel (always open) with a file tree + viewer.
 */
export function Sidebar({ store }: { store: ViewerStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const root = buildFileTree(state.files, store.getCwd())

  // Push the main column by the viewer width (layout.css maps the variable).
  useEffect(() => {
    document.documentElement.style.setProperty('--dsh-viewer-width', `${state.width}px`)
  }, [state.width])

  // Drag the left edge to resize (drag left = wider).
  const onResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = state.width
    const onMove = (move: PointerEvent): void => {
      store.setWidth(startWidth + (startX - move.clientX))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [state.width, store])

  // Drag the file-list / content divider (drag right = wider list).
  const onListResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = state.listWidth
    const onMove = (move: PointerEvent): void => {
      store.setListWidth(startWidth + (move.clientX - startX))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [state.listWidth, store])

  return (
    <aside className={css.sidebar} data-dsh-viewer-sidebar="" aria-label={t('title')}>
      <div className={css.resizeHandle} onPointerDown={onResizeStart} aria-hidden="true" />
      <div className={css.header}>
        <span className={css.title}>{t('title')}</span>
        <button type="button" className={css.iconButton} onClick={() => store.toggleSidebar()} aria-label={t('collapse')} title={t('collapse')}>
          <IconCloseOutline16 />
        </button>
      </div>
      <div className={css.body}>
        <div className={css.listPane} style={{ width: state.listWidth }}>
          <div className={css.listTitle}>{t('files')}</div>
          {state.files.length === 0
            ? <div className={css.empty}>{t('noFiles')}</div>
            : <FileTree root={root} onOpen={path => store.openFile(path)} onReveal={path => { void store.reveal(path) }} />}
        </div>
        <div className={css.listResizeHandle} onPointerDown={onListResizeStart} aria-hidden="true" />
        <div className={css.contentPane}>
          {state.selectedPath === null
            ? <div className={css.empty}>{t('selectFile')}</div>
            : <ViewerPane store={store} />}
        </div>
      </div>
    </aside>
  )
}
