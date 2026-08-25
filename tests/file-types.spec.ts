import { describe, expect, it } from 'vitest'
import { isImagePath, isMarkdownPath } from '../src/client/file-types.ts'

describe('isImagePath', () => {
  it('recognizes common image extensions case-insensitively', () => {
    expect(isImagePath('/a/b/photo.PNG')).toBe(true)
    expect(isImagePath('img.jpg')).toBe(true)
    expect(isImagePath('x.SVG')).toBe(true)
  })

  it('returns false for non-image files', () => {
    expect(isImagePath('readme.md')).toBe(false)
    expect(isImagePath('main.ts')).toBe(false)
    expect(isImagePath('no-extension')).toBe(false)
  })
})

describe('isMarkdownPath', () => {
  it('recognizes markdown extensions case-insensitively', () => {
    expect(isMarkdownPath('readme.md')).toBe(true)
    expect(isMarkdownPath('note.MARKDOWN')).toBe(true)
  })

  it('returns false for non-markdown files', () => {
    expect(isMarkdownPath('main.ts')).toBe(false)
    expect(isMarkdownPath('image.png')).toBe(false)
  })
})
