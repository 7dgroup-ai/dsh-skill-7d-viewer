/**
 * The code viewer: a CodeMirror 6 editor with syntax highlighting
 * (extension-keyed), line numbers, line wrapping, and Ctrl/Cmd+S save. It is
 * mounted once per file; edits flow out through `onChange`, never through a
 * re-render, so the cursor and undo history survive typing.
 * @module dsh-skill-7d-viewer/client/CodeEditor
 */

import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { cmExtensions } from './cm-theme.ts'
import { languageForPath } from './lang.ts'
import css from './sidebar.module.css'

/**
 * One file's editor.
 * @param content - the initial document (the loaded file text).
 * @param path - the file path (drives the language extension + remount key).
 * @param onChange - invoked with the full document on every edit.
 * @param onSave - invoked on Ctrl/Cmd+S.
 * @param readOnly - when true the editor is non-editable (truncated files).
 */
export function CodeEditor({ content, path, onChange, onSave, readOnly = false }: {
  content: string
  path: string
  onChange: (text: string) => void
  onSave: () => void
  readOnly?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  onChangeRef.current = onChange
  onSaveRef.current = onSave

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const language = languageForPath(path)
    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        history(),
        EditorState.tabSize.of(2),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'false' }),
        ...cmExtensions,
        ...(language !== null ? [language] : []),
        ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        keymap.of([
          { key: 'Mod-s', preventDefault: true, run: () => { onSaveRef.current(); return true } },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
      ],
    })
    const view = new EditorView({ state, parent: host })
    return () => {
      view.destroy()
    }
    // Mount once per file; `content` is only the initial document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly])

  return <div ref={hostRef} className={css.editorHost} />
}
