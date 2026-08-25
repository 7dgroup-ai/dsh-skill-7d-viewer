/**
 * Open a folder in the OS file manager (Finder on macOS). The browser renderer
 * cannot do this itself, so the tree's "reveal" button fans out through a host
 * route and spawns the platform opener with an argv array (no shell
 * interpolation). The command builder is pure — the platform is injectable —
 * so it is unit-testable without spawning anything.
 * @module dsh-skill-7d-viewer/open-external
 */
import { spawn } from 'node:child_process'

/** One platform opener invocation (argv array — never a shell string). */
export interface ExternalCommand {
  command: string
  args: string[]
}

/** Open a folder in the OS file manager. */
export function openFolderCommand(path: string, platform: NodeJS.Platform = process.platform): ExternalCommand {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: [path] }
    case 'win32':
      return { command: 'explorer.exe', args: [path] }
    default:
      return { command: 'xdg-open', args: [path] }
  }
}

/**
 * Launch the platform opener for one folder and return immediately (detached,
 * no stdio). Spawn failures are swallowed — the OS dialog about a missing
 * handler is the user-visible outcome either way.
 * @param path - the absolute folder path.
 * @returns started (the launch is fire-and-forget).
 */
export function launchFolder(path: string): { started: true } {
  const spec = openFolderCommand(path)
  const child = spawn(spec.command, spec.args, { detached: true, stdio: 'ignore' })
  child.on('error', () => { /* opener missing/denied: handled by the OS */ })
  child.unref()
  return { started: true }
}
