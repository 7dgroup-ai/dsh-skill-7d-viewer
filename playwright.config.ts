/**
 * Playwright config for the headless-render smoke lane (tests/e2e).
 *
 * This lane does NOT spawn the server itself: `scripts/e2e-mount.sh` boots a
 * real `dsh web` instance (with the npm-packed plugin mounted through the
 * official `dsh plugin add` channel) and injects the base URL through
 * `DSH_E2E_URL`. The spec renders that URL in headless Chromium and proves the
 * plugin mounts, persists bookmarks across a reload, and jumps back to an
 * anchor — without crashing the shell.
 *
 * Specs are named `*.e2e.ts` (not `*.spec.ts`) so vitest's default include
 * never collects them.
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  retries: 0,
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
