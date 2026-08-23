/**
 * Headless-render smoke lane: prove the npm-packed plugin mounts into a real
 * `dsh web` instance and that bookmark persistence + jump-back work end to end.
 *
 * The server is booted by `scripts/e2e-mount.sh` (the plugin mounted through
 * the official `dsh plugin add` channel), which injects the base URL via
 * `DSH_E2E_URL`. This spec:
 *
 *  1. seeds one workspace + one session through the host's unary RPC surface
 *     (`workspace.create` / `session.create`);
 *  2. loads the page and asserts the plugin's `[data-dsh-bookmarks-trigger]`
 *     header mount with no page errors;
 *  3. writes a bookmark into the plugin's localStorage key, reloads, and
 *     asserts the panel renders it (persistence path);
 *  4. plants a synthetic `data-chat-anchor-key` element, spies on
 *     `Element.prototype.scrollIntoView`, clicks jump, and asserts the anchor
 *     was scrolled to (jump-back path).
 */
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test'

const BASE_URL = process.env.DSH_E2E_URL
if (!BASE_URL) {
  throw new Error('DSH_E2E_URL is not set — boot a DSH web instance with the plugin mounted (see scripts/e2e-mount.sh)')
}

/** Workspace the lane seeds against (isolated from other lanes). */
const WORKSPACE_PATH = process.env.DSH_E2E_WORKSPACE ?? join(tmpdir(), 'dsh-e2e-bookmarks-workspace')

/** The plugin's localStorage key prefix (must match src/client/store.ts). */
const STORAGE_PREFIX = 'dsh-skill-7d-viewer:'

let api: APIRequestContext
let sessionId = ''

/** Seed one workspace + one session through the host RPC surface. */
async function seedSession(): Promise<void> {
  mkdirSync(WORKSPACE_PATH, { recursive: true })
  const workspace = await api.post(`${BASE_URL}/api/workspace.create`, {
    data: {
      type: 'client-request',
      rpcId: 'e2e-bookmarks-ws',
      method: 'workspace.create',
      payload: { path: WORKSPACE_PATH },
    },
  })
  expect(workspace.ok(), `workspace.create: ${workspace.status()}`).toBe(true)
  const workspaceBody = (await workspace.json()) as {
    result: { ok: true; value: { workspace: { workspaceId: string } } } | { ok: false; error: unknown }
  }
  expect(workspaceBody.result.ok).toBe(true)
  const workspaceId = (workspaceBody.result as { value: { workspace: { workspaceId: string } } }).value.workspace.workspaceId

  const session = await api.post(`${BASE_URL}/api/session.create`, {
    data: {
      type: 'client-request',
      rpcId: 'e2e-bookmarks-session',
      method: 'session.create',
      payload: { workspaceId },
    },
  })
  expect(session.ok(), `session.create: ${session.status()}`).toBe(true)
  const sessionBody = (await session.json()) as {
    result: { ok: true; value: { sessionId: string } } | { ok: false; error: unknown }
  }
  expect(sessionBody.result.ok).toBe(true)
  sessionId = (sessionBody.result as { value: { sessionId: string } }).value.sessionId
}

/** Dismiss keyless-boot onboarding takeovers (Continue / Configure later). */
async function dismissOnboarding(page: Page): Promise<void> {
  try {
    await expect
      .poll(() => page.getByRole('button', { name: /^(Continue|Configure later)$/ }).count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
  } catch {
    return // no onboarding takeovers appeared
  }
  for (let round = 0; round < 6; round++) {
    for (const name of ['Continue', 'Configure later']) {
      const button = page.getByRole('button', { name, exact: true }).first()
      if ((await button.count()) === 0) continue
      try {
        await button.click({ timeout: 3_000 })
        await page.waitForTimeout(500)
      } catch {
        // Masked by the takeover stacked above; retried next round.
      }
    }
  }
}

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: BASE_URL })
  await seedSession()
})

test.afterAll(async () => {
  await api?.dispose()
})

test('plugin mounts, bookmarks persist across reload, and jump-back scrolls to the anchor', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(String(error)))

  // 1. Load the shell and assert the plugin's header mount.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#root > *')).not.toHaveCount(0, { timeout: 90_000 })
  await dismissOnboarding(page)
  const trigger = page.locator('[data-dsh-bookmarks-trigger]')
  await expect(trigger).toBeAttached({ timeout: 90_000 })

  // 2. Persistence: write a bookmark into the plugin's localStorage key,
  //    reload, and assert the panel renders it (and the count badge updates).
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      bookmarks: [{
        messageId: 'e2e-message',
        anchorKey: 'e2e-anchor',
        excerpt: 'hello from e2e',
        createdAt: Date.now(),
        note: '',
      }],
    }))
  }, STORAGE_PREFIX + sessionId)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await dismissOnboarding(page)
  await expect(page.locator('[data-dsh-bookmarks-trigger]')).toBeAttached({ timeout: 90_000 })
  await page.locator('[data-dsh-bookmarks-trigger]').click()
  const panel = page.locator('[data-dsh-bookmarks-panel]')
  await expect(panel).toBeAttached()
  await expect(panel.getByText('hello from e2e')).toBeVisible()

  // 3. Jump-back: plant a synthetic anchor, spy on scrollIntoView, click jump.
  await page.evaluate(() => {
    const anchor = document.createElement('div')
    anchor.setAttribute('data-chat-anchor-key', 'e2e-anchor')
    anchor.textContent = 'anchor'
    document.body.appendChild(anchor)
    const calls: string[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element['scrollIntoView']>) {
      calls.push(this.getAttribute('data-chat-anchor-key') ?? '')
      return original.apply(this, args)
    }
    ;(window as unknown as { __scrollIntoViewCalls: string[] }).__scrollIntoViewCalls = calls
  })
  await page.locator('[data-dsh-bookmark-jump]').click()
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __scrollIntoViewCalls: string[] }).__scrollIntoViewCalls))
    .toContain('e2e-anchor')

  // 4. No crash markers across the whole lane.
  expect(pageErrors).toEqual([])
})
