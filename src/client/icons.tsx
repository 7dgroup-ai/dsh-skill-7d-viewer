/**
 * A small bookmark-ribbon glyph. The primitives icon set has no bookmark/star,
 * so the plugin ships its own; it follows the same 16px inline-SVG convention
 * and inherits `currentColor` so it participates in the surrounding theme.
 * @module dsh-skill-7d-viewer/client/icons
 */

/** A 16px bookmark ribbon; `filled` paints the fill, otherwise it is an outline. */
export function BookmarkRibbonIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
