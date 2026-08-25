import { describe, expect, it } from 'vitest'
import {
  isAbsolutePath, producedFilesByTurn, producedPaths, resolveViewerPath,
} from '../src/client/produced-files.ts'

describe('producedPaths', () => {
  it('returns edit/diff locations', () => {
    expect(producedPaths({ card: 'diff', locations: [{ path: 'a.ts' }, { path: 'b.ts' }] })).toEqual(['a.ts', 'b.ts'])
    expect(producedPaths({ card: 'generic', kind: 'edit', locations: [{ path: 'x.md' }] })).toEqual(['x.md'])
  })

  it('ignores non-edit intents and malformed locations', () => {
    expect(producedPaths({ card: 'generic', kind: 'read', locations: [{ path: 'x' }] })).toEqual([])
    expect(producedPaths({ card: 'diff', locations: [{ path: 1 }, 'x'] })).toEqual([])
    expect(producedPaths(null)).toEqual([])
  })
})

describe('producedFilesByTurn', () => {
  it('collects produced files, deduped, with the owning turn', () => {
    const nodes = [
      { kind: 'user', turn: 0 },
      { kind: 'assistant', turn: 1, seq: 1 },
      { kind: 'tool-result', callView: { card: 'diff', locations: [{ path: 'a.ts' }] }, turn: 1 },
      { kind: 'tool-result', callView: { card: 'diff', locations: [{ path: 'a.ts' }] }, turn: 1 },
      { kind: 'assistant', turn: 2, seq: 2 },
      { kind: 'tool-result', callView: { card: 'generic', kind: 'edit', locations: [{ path: 'b.md' }] }, turn: 2 },
    ]
    expect(producedFilesByTurn(nodes)).toEqual([
      { turn: 1, path: 'a.ts' },
      { turn: 2, path: 'b.md' },
    ])
  })

  it('skips errored tool results', () => {
    const nodes = [
      { kind: 'tool-result', isError: true, callView: { card: 'diff', locations: [{ path: 'a.ts' }] }, turn: 1 },
    ]
    expect(producedFilesByTurn(nodes)).toEqual([])
  })
})

describe('path helpers', () => {
  it('detects absolute paths', () => {
    expect(isAbsolutePath('/a/b')).toBe(true)
    expect(isAbsolutePath('C:\\a\\b')).toBe(true)
    expect(isAbsolutePath('\\\\server\\share')).toBe(true)
    expect(isAbsolutePath('relative/path')).toBe(false)
  })

  it('resolves relative paths against the cwd', () => {
    expect(resolveViewerPath('/work', 'a.ts')).toBe('/work/a.ts')
    expect(resolveViewerPath('/work/', 'a.ts')).toBe('/work/a.ts')
    expect(resolveViewerPath('/work', '/abs/a.ts')).toBe('/abs/a.ts')
    expect(resolveViewerPath(undefined, 'a.ts')).toBe('a.ts')
  })
})
