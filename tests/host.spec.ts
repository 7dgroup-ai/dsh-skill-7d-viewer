import { describe, expect, it } from 'vitest'
import { isWithin, mediaTypeForPath } from '../src/index.ts'

describe('mediaTypeForPath', () => {
  it('maps known image extensions', () => {
    expect(mediaTypeForPath('/a/photo.png')).toBe('image/png')
    expect(mediaTypeForPath('x.jpg')).toBe('image/jpeg')
  })

  it('falls back to octet-stream for unknowns', () => {
    expect(mediaTypeForPath('file.unknown')).toBe('application/octet-stream')
  })
})

describe('isWithin', () => {
  it('accepts the root itself and descendants', () => {
    expect(isWithin('/work', '/work')).toBe(true)
    expect(isWithin('/work', '/work/src/a.ts')).toBe(true)
  })

  it('rejects paths escaping the root', () => {
    expect(isWithin('/work', '/work/../secret')).toBe(false)
    expect(isWithin('/work', '/etc/passwd')).toBe(false)
  })

  it('rejects a sibling prefix (not a startsWith match)', () => {
    expect(isWithin('/work', '/work-other/x')).toBe(false)
  })
})
