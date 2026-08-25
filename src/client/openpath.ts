/**
 * Interception of the chat's file-open funnel. The client runtime's
 * `ctx.workspaces.openPath` is the SINGLE door every chat-side file open goes
 * through (ui-conversation resolves the path against the session cwd and calls
 * it). Wrapping that one method reroutes those opens into the viewer overlay
 * instead of the Host OS — no DSH modification needed.
 *
 * The wrapper is dependency-free by design (no React / ui-primitives), so the
 * takeover logic is unit-testable.
 * @module dsh-skill-7d-viewer/client/openpath
 */

/** The one service method the wrapper replaces (mirror of the runtime IWorkspaces). */
export interface OpenPathService {
  openPath(path: string): Promise<void>
}

/** Per-call decisions the wrapper needs (wired to the store + ctx in the client half). */
export interface OpenPathInterceptDeps {
  /** Whether to take over this call (declined calls fall through to the Host). */
  takeoverEnabled(): boolean
  /** The session whose scope the viewer loads the file in (current session). */
  currentSessionId(): string | undefined
  /** Route the open into the viewer overlay. */
  openInViewer(path: string, sessionId: string): void
}

/**
 * Wrap `workspaces.openPath`: intercepted calls open the file in the viewer
 * overlay instead of the Host OS and resolve as success (the original's
 * callers ignore the result); anything that declines falls through untouched.
 * @param workspaces - the client workspaces service to wrap.
 * @param deps - per-call takeover decisions.
 * @returns the disposer restoring the original method (HMR-safe).
 */
export function wrapOpenPath(workspaces: OpenPathService, deps: OpenPathInterceptDeps): () => void {
  const original = workspaces.openPath
  workspaces.openPath = (path: string): Promise<void> => {
    if (deps.takeoverEnabled()) {
      const sessionId = deps.currentSessionId()
      if (sessionId !== undefined) {
        deps.openInViewer(path, sessionId)
        return Promise.resolve()
      }
    }
    return original.call(workspaces, path)
  }
  return () => {
    workspaces.openPath = original
  }
}
