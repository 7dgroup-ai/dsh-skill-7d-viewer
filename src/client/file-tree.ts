/**
 * Build a Finder-style folder/file tree from the produced files. The session
 * cwd is the root; nested paths become folders. Dependency-free so it is
 * unit-testable.
 * @module dsh-skill-7d-viewer/client/file-tree
 */
import type { ProducedFile } from './produced-files.ts'

/** One tree node (a folder or a file). */
export interface FileTreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children: FileTreeNode[]
  turn?: number
}

/** Last path segment. */
function basename(path: string): string {
  const segs = path.split('/').filter(Boolean)
  return segs.length === 0 ? path : segs[segs.length - 1]
}

/**
 * Build a tree of the produced files, rooted at the session cwd. Files outside
 * the cwd are attached at the root with their full path. Folders sort before
 * files, then by name.
 * @param files - produced files (absolute paths).
 * @param cwd - the session working directory.
 * @returns a single root node (the cwd folder) whose children are the tree.
 */
export function buildFileTree(files: readonly ProducedFile[], cwd: string): FileTreeNode {
  const rootPath = cwd.replace(/\/+$/, '')
  const root: FileTreeNode = { name: basename(rootPath), path: rootPath, type: 'folder', children: [] }
  const byPath = new Map<string, FileTreeNode>([[rootPath, root]])

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const prefix = rootPath + '/'
    if (!file.path.startsWith(prefix)) {
      root.children.push({ name: file.path, path: file.path, type: 'file', children: [], turn: file.turn })
      continue
    }
    const segs = file.path.slice(prefix.length).split('/').filter(Boolean)
    if (segs.length === 0) continue
    let current = root
    let dir = rootPath
    for (let i = 0; i < segs.length; i++) {
      dir = dir + '/' + segs[i]
      const isFile = i === segs.length - 1
      let child = byPath.get(dir)
      if (child === undefined) {
        child = { name: segs[i], path: dir, type: isFile ? 'file' : 'folder', children: [] }
        byPath.set(dir, child)
        current.children.push(child)
      }
      if (isFile) child.turn = file.turn
      current = child
    }
  }

  const order = (nodes: FileTreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) order(node.children)
  }
  order(root.children)
  return root
}
