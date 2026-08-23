/**
 * dsh-skill-7d-viewer host half. This is a pure browser UI plugin: the host
 * apply is an intentional no-op that exists only so the plugin appears in the
 * profile cordis tree and its client half is discovered through the
 * package.json `dsh.client` declaration. All behavior lives in
 * `src/client/index.ts`.
 * @module dsh-skill-7d-viewer
 */

/** Plugin identity for cordis.yml rows. */
export const name = 'skill-7d-viewer'

/** Host services this plugin requires — none, the host half does nothing. */
export const inject = [] as const

/** Host plugin body — no host-side behavior for this pure UI plugin. */
export function apply(): void {}
