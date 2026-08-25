/**
 * Syntax highlighting for the code viewer: file extension → CodeMirror
 * language mapping. The key derivation is pure; the factories pull in the
 * CodeMirror language packages (bundled into the client).
 * @module dsh-skill-7d-viewer/client/lang
 */
import { Language, LanguageSupport } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { sql } from '@codemirror/lang-sql'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { go } from '@codemirror/lang-go'

/** Language key for an extension, or null for plain text. */
export function languageKeyForExt(ext: string): string | null {
  switch (ext) {
    case 'js': case 'mjs': case 'cjs': case 'jsx': return 'js'
    case 'ts': case 'mts': case 'cts': case 'tsx': return 'ts'
    case 'json': case 'jsonc': return 'json'
    case 'md': case 'markdown': return 'md'
    case 'py': case 'pyw': return 'python'
    case 'html': case 'htm': return 'html'
    case 'css': return 'css'
    case 'xml': case 'xsl': return 'xml'
    case 'yaml': case 'yml': return 'yaml'
    case 'sql': return 'sql'
    case 'java': return 'java'
    case 'c': case 'h': return 'c'
    case 'cc': case 'cpp': case 'cxx': case 'hpp': case 'hh': case 'hxx': return 'cpp'
    case 'rs': return 'rust'
    case 'go': return 'go'
    default: return null
  }
}

const FACTORIES: Record<string, () => Language | LanguageSupport> = {
  js: () => javascript({ jsx: true }),
  ts: () => javascript({ typescript: true }),
  json: () => json(),
  md: () => markdown(),
  python: () => python(),
  html: () => html(),
  css: () => css(),
  xml: () => xml(),
  yaml: () => yaml(),
  sql: () => sql(),
  java: () => java(),
  c: () => cpp(),
  cpp: () => cpp(),
  rust: () => rust(),
  go: () => go(),
}

/** The CodeMirror language support for a path, or null for plain text. */
export function languageForPath(path: string): Language | LanguageSupport | null {
  const dot = path.lastIndexOf('.')
  const ext = dot < 0 ? '' : path.slice(dot + 1).toLowerCase()
  const key = languageKeyForExt(ext)
  return key === null ? null : FACTORIES[key]!()
}
