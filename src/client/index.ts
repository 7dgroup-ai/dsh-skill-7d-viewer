/**
 * dsh-skill-7d-viewer client half: intercepts the chat's file-open funnel and
 * reroutes it into a right sidebar viewer, with a per-turn produced-file list.
 * It subscribes to the current session's conversation snapshot to derive the
 * file list, mounts the sidebar into a body portal, and tears down on disposal.
 * @module dsh-skill-7d-viewer/client
 */

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale service's Context augmentation (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { Sidebar } from './Sidebar.tsx'
import { attachLocale } from './locales.ts'
import { wrapOpenPath } from './openpath.ts'
import { producedFilesByTurn, resolveViewerPath } from './produced-files.ts'
import { ViewerStore } from './sidebar-store.ts'

/** Required client services for locale + interception + session snapshot. */
export const inject = ['sessions', 'workspaces', 'locale']

/**
 * Client plugin body.
 * @param ctx - client root context (sessions, workspaces, locale).
 */
export function apply(ctx: ClientContext): void {
  // Activation marker for e2e: proves the client half composed and mounted.
  document.documentElement.setAttribute('data-dsh-viewer-active', '')

  attachLocale(ctx.locale)

  const store = new ViewerStore()

  // Wire the produced-file list to the current session's conversation snapshot.
  let faceUnsub: (() => void) | undefined
  const syncSession = (): void => {
    faceUnsub?.()
    faceUnsub = undefined
    const list = ctx.sessions.list.getSnapshot()
    const current = list.current
    if (current === undefined) {
      store.setSession('', '', [])
      return
    }
    const cwd = list.byId[current]?.cwd ?? ''
    const face = ctx.sessions.binding(current)?.session
    if (face === undefined) {
      store.setSession(current, cwd, [])
      return
    }
    const derive = (): void => {
      const files = producedFilesByTurn(face.getSnapshot().nodes)
        .map(file => ({ turn: file.turn, path: resolveViewerPath(cwd, file.path) }))
      store.setSession(current, cwd, files)
    }
    faceUnsub = face.subscribe(derive)
    derive()
  }
  const offList = ctx.sessions.list.subscribe(syncSession)
  syncSession()

  const unwrap = wrapOpenPath(ctx.workspaces, {
    takeoverEnabled: () => true,
    currentSessionId: () => ctx.sessions.list.getSnapshot().current,
    openInViewer: (path, sessionId) => {
      const cwd = ctx.sessions.list.getSnapshot().byId[sessionId as SessionId]?.cwd
      store.openSidebar()
      store.openFile(resolveViewerPath(cwd, path))
    },
  })

  const container = document.createElement('div')
  container.setAttribute('data-dsh-viewer-root', '')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(createElement(Sidebar, { store }))

  ctx.effect(() => () => {
    offList()
    faceUnsub?.()
    unwrap()
    store.dispose()
    root.unmount()
    container.remove()
    attachLocale(undefined)
  }, 'dsh-skill-7d-viewer: teardown')
}
