import { describe, expect, it } from 'vitest'
import { openFolderCommand } from '../src/open-external.ts'

describe('openFolderCommand', () => {
  it('uses open on macOS', () => {
    expect(openFolderCommand('/work/src', 'darwin')).toEqual({ command: 'open', args: ['/work/src'] })
  })

  it('uses explorer.exe on Windows', () => {
    expect(openFolderCommand('C:\\work', 'win32')).toEqual({ command: 'explorer.exe', args: ['C:\\work'] })
  })

  it('uses xdg-open on Linux', () => {
    expect(openFolderCommand('/work', 'linux')).toEqual({ command: 'xdg-open', args: ['/work'] })
  })
})
