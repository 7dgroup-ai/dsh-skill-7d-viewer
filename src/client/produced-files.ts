/**
 * Pure derivation of one conversation's produced files from finalized nodes —
 * a structural replica of ui-deliverables' produced-files logic (the mutation
 * tools' `locations` by render intent: a diff card or a generic edit card;
 * reads/deletes/failures produce nothing). Kept dependency-free so it is
 * unit-testable.
 * @module dsh-skill-7d-viewer/client/produced-files
 */

/** One produced file, attributed to the turn that wrote it. */
export interface ProducedFile {
  turn: number
  path: string
}

/** Paths a tool-result view reports as produced, by render intent. */
export function producedPaths(view: unknown): readonly string[] {
  if (view === null || typeof view !== 'object') return []
  const record = view as { card?: unknown; kind?: unknown; locations?: unknown }
  const isEdit = record.card === 'diff' || (record.card === 'generic' && record.kind === 'edit')
  if (!isEdit) return []
  if (!Array.isArray(record.locations)) return []
  const paths: string[] = []
  for (const location of record.locations) {
    if (location !== null && typeof location === 'object' && typeof (location as { path?: unknown }).path === 'string') {
      paths.push((location as { path: string }).path)
    }
  }
  return paths
}

/**
 * All produced files across the conversation, grouped by turn, in first-seen
 * order with duplicates removed. Each tool-result inherits the turn of the
 * preceding node (user messages reset it).
 * @param nodes - snapshot surface nodes in order (structural, unknown-safe).
 * @returns produced files with their owning turn.
 */
export function producedFilesByTurn(nodes: readonly unknown[]): ProducedFile[] {
  const result: ProducedFile[] = []
  const seen = new Set<string>()
  let turn = 0
  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue
    const record = node as { kind?: unknown; isError?: unknown; callView?: unknown; turn?: unknown }
    if (record.kind === 'tool-result') {
      if (record.isError === true) continue
      for (const path of producedPaths(record.callView)) {
        if (seen.has(path)) continue
        seen.add(path)
        result.push({ turn, path })
      }
      continue
    }
    if (typeof record.turn === 'number') turn = record.turn
  }
  return result
}

/** Whether a path is absolute (POSIX root, drive letter, or UNC share). */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/')
    || /^[A-Za-z]:[\\/]/.test(path)
    || path.startsWith('\\\\')
}

/** Resolve a (possibly relative) produced path against the session cwd. */
export function resolveViewerPath(cwd: string | undefined, path: string): string {
  if (isAbsolutePath(path)) return path
  const base = cwd ?? ''
  if (base === '') return path
  const separator = base.includes('\\') ? '\\' : '/'
  return `${base.replace(/[\\/]+$/, '')}${separator}${path}`
}
