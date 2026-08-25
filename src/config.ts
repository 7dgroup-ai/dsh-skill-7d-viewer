/**
 * Serializable configuration and defaults for the viewer host half. Loader
 * schema validation normally fills defaults; {@link resolveViewerConfig}
 * applies the same defaults for direct callers that bypass the Loader.
 * @module dsh-skill-7d-viewer/config
 */
import z from 'schemastery'

/** Tunable viewer host limits (every field optional; defaults fill in). */
export interface ViewerConfig {
  /** Read cap of one text file (bytes); larger files return truncated. */
  readLimit?: number
  /** Media route cap (bytes); larger binaries are refused. */
  mediaLimit?: number
  /** Write cap of one file save (bytes); larger writes are refused. */
  writeLimit?: number
}

/** Schemastery schema for the plugin configuration. */
export const Config: z<ViewerConfig> = z.object({
  readLimit: z.number().step(1).min(1).default(512 * 1024),
  mediaLimit: z.number().step(1).min(1).default(20 * 1024 * 1024),
  writeLimit: z.number().step(1).min(1).default(5 * 1024 * 1024),
})

/** Fully defaulted viewer host settings. */
export interface ResolvedViewerConfig {
  readLimit: number
  mediaLimit: number
  writeLimit: number
}

/**
 * Apply direct-call defaults after Loader schema validation has normally run.
 * @param config - deployment-provided viewer host settings.
 * @returns complete settings consumed by the host half.
 */
export function resolveViewerConfig(config: ViewerConfig | undefined): ResolvedViewerConfig {
  return {
    readLimit: config?.readLimit ?? 512 * 1024,
    mediaLimit: config?.mediaLimit ?? 20 * 1024 * 1024,
    writeLimit: config?.writeLimit ?? 5 * 1024 * 1024,
  }
}
