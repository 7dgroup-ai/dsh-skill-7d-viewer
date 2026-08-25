/**
 * CodeMirror 6 theme pieces for the code viewer. The editor surface (caret,
 * gutter) rides the DSH theme tokens so it blends with the panel; the syntax
 * token colors use a one-dark-family palette. Syntax highlighting is provided
 * through `@lezer/highlight` tags so language extensions color their tokens.
 * @module dsh-skill-7d-viewer/client/cm-theme
 */
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

/** Token-driven editor surface (colors come from the DSH theme). */
export const cmSurfaceTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: 'var(--dsw-alias-label-primary)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    caretColor: 'var(--dsw-alias-label-primary)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--dsw-alias-label-tertiary)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  '.cm-selectionBackground, .cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(128, 128, 128, 0.22)',
  },
})

/** one-dark-family syntax palette. */
const highlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.bool, color: '#d19a66' },
  { tag: tags.atom, color: '#d19a66' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.className, color: '#e5c07b' },
  { tag: tags.propertyName, color: '#e06c75' },
  { tag: tags.function(tags.variableName), color: '#61afef' },
  { tag: tags.variableName, color: '#e06c75' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.tagName, color: '#e06c75' },
  { tag: tags.attributeName, color: '#d19a66' },
  { tag: tags.heading, color: '#e06c75', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: '#61afef', textDecoration: 'underline' },
  { tag: tags.invalid, color: '#ffffff', fontWeight: 'bold' },
])

/** The shared CodeMirror extensions (surface + syntax highlighting). */
export const cmExtensions = [cmSurfaceTheme, syntaxHighlighting(highlightStyle)]
