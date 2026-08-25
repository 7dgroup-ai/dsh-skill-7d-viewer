import { describe, expect, it } from 'vitest'
import { buildFileTree, type FileTreeNode } from '../src/client/file-tree.ts'

function names(node: FileTreeNode): string[] {
  return node.children.map(child => child.name)
}

describe('buildFileTree', () => {
  it('roots the tree at the cwd basename', () => {
    const root = buildFileTree(
      [{ turn: 1, path: '/work/src/a.ts' }],
      '/work',
    )
    expect(root.name).toBe('work')
    expect(root.type).toBe('folder')
  })

  it('builds nested folders and files', () => {
    const root = buildFileTree(
      [
        { turn: 1, path: '/work/src/index.ts' },
        { turn: 1, path: '/work/src/lib/util.ts' },
        { turn: 2, path: '/work/README.md' },
      ],
      '/work',
    )
    expect(names(root)).toEqual(['src', 'README.md'])
    const src = root.children.find(child => child.name === 'src')!
    expect(names(src)).toEqual(['lib', 'index.ts'])
    const lib = src.children.find(child => child.name === 'lib')!
    expect(names(lib)).toEqual(['util.ts'])
  })

  it('sorts folders before files, then by name', () => {
    const root = buildFileTree(
      [
        { turn: 1, path: '/work/z.txt' },
        { turn: 1, path: '/work/a/b.ts' },
        { turn: 1, path: '/work/a.md' },
      ],
      '/work',
    )
    expect(names(root)).toEqual(['a', 'a.md', 'z.txt'])
  })

  it('deduplicates shared folders', () => {
    const root = buildFileTree(
      [
        { turn: 1, path: '/work/dir/x.ts' },
        { turn: 1, path: '/work/dir/y.ts' },
      ],
      '/work',
    )
    expect(root.children).toHaveLength(1)
    expect(root.children[0].children).toHaveLength(2)
  })
})
