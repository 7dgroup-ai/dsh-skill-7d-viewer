/**
 * Headless-render smoke lane: prove the npm-packed plugin mounts into a real
 * `dsh web` instance and activates without crashing the shell.
 *
 * The server is booted by `scripts/e2e-mount.sh` (the plugin mounted through
 * the official `dsh plugin add` channel), which injects the base URL via
 * `DSH_E2E_URL`. This spec seeds one workspace + one session through the host's
 * unary RPC surface, loads the page, and asserts the plugin's activation marker
 * (`html[data-dsh-viewer-active]`, set by the client `apply()` once the
 * bundle composes and mounts) with no page errors.
 *
 * The viewer overlay itself only opens when a file reference is clicked; the
 * interception, path confinement, and file classification are covered by the
 * unit tests instead (openpath.spec.ts, host.spec.ts, file-types.spec.ts).
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

let api: APIRequestContext

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

  const workspaceId = ((await workspace.json()) as {
    result: { ok: true; value: { workspace: { workspaceId: string } } }
  }).result.value.workspace.workspaceId

  const session = await api.post(`${BASE_URL}/api/session.create`, {
    data: {
      type: 'client-request',
      rpcId: 'e2e-bookmarks-session',
      method: 'session.create',
      payload: { workspaceId },
    },
  })
  expect(session.ok(), `session.create: ${session.status()}`).toBe(true)
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

test('plugin mounts and activates in a real dsh web without crashing', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(String(error)))

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#root > *')).not.toHaveCount(0, { timeout: 90_000 })
  await dismissOnboarding(page)

  // The client half composes, mounts, and runs apply(), which stamps this marker.
  await expect(page.locator('html[data-dsh-viewer-active]')).toBeAttached({ timeout: 90_000 })

  expect(pageErrors).toEqual([])
})
