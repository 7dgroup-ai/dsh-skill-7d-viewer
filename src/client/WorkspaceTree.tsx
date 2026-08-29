/**
 * The full workspace file tree for the sidebar. Unlike the produced-file tree
 * (built client-side from the conversation snapshot), this lazy-loads every
 * directory from the host's /viewer/tree route, so the user can browse the
 * entire session working directory. Folders load their children on expand.
 * @module dsh-skill-7d-viewer/client/WorkspaceTree
 */

import { useCallback, useEffect, useState } from 'react'
import {
  IconChevronDownOutline14, IconChevronRightOutline14, IconFolderClose16, IconFolderOpen16, IconRightUpOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { listDirectory, type TreeEntry } from './api.ts'
import { t } from './locales.ts'
import css from './sidebar.module.css'

/** Last path segment for display. */
function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? path : path.slice(idx + 1)
}

/** One file row. */
function FileNode({ entry, depth, onOpen }: {
  entry: TreeEntry
  depth: number
  onOpen: (path: string) => void
}) {
  return (
    <button
      type="button"
      className={css.treeRow}
      style={{ paddingLeft: 4 + depth * 14 + 34 }}
      title={entry.path}
      onClick={() => onOpen(entry.path)}
    >
      <span className={css.treeName}>{entry.name}</span>
    </button>
  )
}

/** One folder row that lazy-loads its children on expand. */
function FolderNode({ entry, depth, sessionId, cwd, onOpen, onReveal, defaultOpen = false }: {
  entry: TreeEntry
  depth: number
  sessionId: string
  cwd: string
  onOpen: (path: string) => void
  onReveal: (path: string) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [entries, setEntries] = useState<TreeEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    if (entries !== null) return
    setLoading(true)
    try {
      setEntries(await listDirectory(sessionId, entry.path, cwd))
    } catch {
      setEntries([])
    }
    setLoading(false)
  }, [entries, sessionId, entry.path, cwd])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return (
    <div>
      <div className={css.treeRow} style={{ paddingLeft: 4 + depth * 14 }}>
        <button type="button" className={css.treeRowMain} onClick={() => setOpen(current => !current)}>
          {open ? <IconChevronDownOutline14 className={css.treeChevron} /> : <IconChevronRightOutline14 className={css.treeChevron} />}
          {open ? <IconFolderOpen16 className={css.treeIcon} /> : <IconFolderClose16 className={css.treeIcon} />}
          <span className={css.treeName}>{entry.name}</span>
        </button>
        <button
          type="button"
          className={css.treeReveal}
          onClick={() => onReveal(entry.path)}
          aria-label={t('reveal')}
          title={t('reveal')}
        >
          <IconRightUpOutline14 />
        </button>
      </div>
      {open && (loading
        ? <div className={css.treeLoading} style={{ paddingLeft: 4 + (depth + 1) * 14 + 34 }}>…</div>
        : (entries ?? []).map(child => child.type === 'folder'
          ? <FolderNode key={child.path} entry={child} depth={depth + 1} sessionId={sessionId} cwd={cwd} onOpen={onOpen} onReveal={onReveal} />
          : <FileNode key={child.path} entry={child} depth={depth + 1} onOpen={onOpen} />))}
    </div>
  )
}

/**
 * The workspace explorer, rooted at the session cwd and expanded by default.
 * @param cwd - the session working directory.
 * @param sessionId - the session id (for the host list route).
 * @param onOpen - open one file in the viewer.
 * @param onReveal - reveal a folder in the OS file manager.
 */
export function WorkspaceTree({ cwd, sessionId, onOpen, onReveal }: {
  cwd: string
  sessionId: string
  onOpen: (path: string) => void
  onReveal: (path: string) => void
}) {
  return (
    <div className={css.tree}>
      <FolderNode
        entry={{ name: basename(cwd), path: cwd, type: 'folder' }}
        depth={0}
        sessionId={sessionId}
        cwd={cwd}
        onOpen={onOpen}
        onReveal={onReveal}
        defaultOpen
      />
    </div>
  )
}
