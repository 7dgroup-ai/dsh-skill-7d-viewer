/**
 * A real terminal pane: xterm.js driven by a WebSocket to the host's
 * /viewer/ws/terminal upgrade, which connects to a node-pty shell. The
 * transcript is replayed on (re)connect, so a page refresh reattaches the
 * same shell. Resize frames and raw input go out on the socket.
 * @module dsh-skill-7d-viewer/client/TerminalView
 */

import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import css from './sidebar.module.css'

/**
 * Render one terminal.
 * @param sessionId - the session whose terminal scope this is.
 * @param cwd - the working directory the shell spawns in.
 * @param tab - the client-generated tab id (the host keys the pty on it).
 */
export function TerminalView({ sessionId, cwd, tab }: { sessionId: string; cwd: string; tab: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: { background: 'transparent' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()

    const wsUrl = new URL('/viewer/ws/terminal', window.location.origin)
    wsUrl.searchParams.set('sessionId', sessionId)
    wsUrl.searchParams.set('tab', tab)
    wsUrl.searchParams.set('cwd', cwd)
    wsUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(wsUrl.toString())

    ws.onmessage = event => term.write(event.data as string)
    ws.onclose = () => term.write('\r\n[disconnected]\r\n')
    const dataSub = term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    const sendResize = (): void => {
      fit.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }
    const resizeObserver = new ResizeObserver(sendResize)
    resizeObserver.observe(host)
    sendResize()

    return () => {
      resizeObserver.disconnect()
      dataSub.dispose()
      term.dispose()
      ws.close()
    }
  }, [sessionId, cwd, tab])

  return <div ref={hostRef} className={css.terminalHost} />
}
