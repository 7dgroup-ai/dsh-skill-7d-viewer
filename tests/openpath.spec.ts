import { describe, expect, it } from 'vitest'
import { wrapOpenPath, type OpenPathService } from '../src/client/openpath.ts'

function service(): OpenPathService & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async openPath(path: string): Promise<void> {
      calls.push(path)
    },
  }
}

describe('wrapOpenPath', () => {
  it('reroutes openPath into the viewer when takeover is enabled', async () => {
    const workspaces = service()
    const opened: Array<{ path: string; sessionId: string }> = []
    const unwrap = wrapOpenPath(workspaces, {
      takeoverEnabled: () => true,
      currentSessionId: () => 's1',
      openInViewer: (path, sessionId) => { opened.push({ path, sessionId }) },
    })
    await workspaces.openPath('/tmp/a.txt')
    expect(opened).toEqual([{ path: '/tmp/a.txt', sessionId: 's1' }])
    expect(workspaces.calls).toEqual([])
    unwrap()
  })

  it('falls through to the original when takeover is declined', async () => {
    const workspaces = service()
    const unwrap = wrapOpenPath(workspaces, {
      takeoverEnabled: () => false,
      currentSessionId: () => 's1',
      openInViewer: () => {},
    })
    await workspaces.openPath('/tmp/a.txt')
    expect(workspaces.calls).toEqual(['/tmp/a.txt'])
    unwrap()
  })

  it('falls through when there is no current session', async () => {
    const workspaces = service()
    const unwrap = wrapOpenPath(workspaces, {
      takeoverEnabled: () => true,
      currentSessionId: () => undefined,
      openInViewer: () => {},
    })
    await workspaces.openPath('/tmp/a.txt')
    expect(workspaces.calls).toEqual(['/tmp/a.txt'])
    unwrap()
  })

  it('restores the original method on dispose', async () => {
    const workspaces = service()
    const unwrap = wrapOpenPath(workspaces, {
      takeoverEnabled: () => true,
      currentSessionId: () => 's1',
      openInViewer: () => {},
    })
    unwrap()
    await workspaces.openPath('/tmp/a.txt')
    expect(workspaces.calls).toEqual(['/tmp/a.txt'])
  })
})
