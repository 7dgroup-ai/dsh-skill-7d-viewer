/**
 * Shared data vocabulary for the file viewer.
 * @module dsh-skill-7d-viewer/client/types
 */

/** Response of the host's /viewer/read route. */
export type ReadResult =
  | { kind: 'text'; content: string; truncated: boolean; size: number }
  | { kind: 'binary'; size: number; truncated: boolean; head?: string }
