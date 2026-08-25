/**
 * Client-side file classification: which binary files render as images, and
 * which text files get a markdown source/preview toggle.
 * @module dsh-skill-7d-viewer/client/file-types
 */

/** Extensions the viewer renders as <img>. */
const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif',
])

/** Extensions treated as markdown (source/preview toggle). */
const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.mdown'])

/** Whether a path's extension is an image the viewer can inline. */
export function isImagePath(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXTS.has(path.slice(dot).toLowerCase())
}

/** Whether a path's extension is markdown. */
export function isMarkdownPath(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot < 0) return false
  return MARKDOWN_EXTS.has(path.slice(dot).toLowerCase())
}
