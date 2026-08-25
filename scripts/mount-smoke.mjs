/**
 * Standalone mount smoke: load a running DSH web (DSH_E2E_URL or
 * http://127.0.0.1:3080), dismiss onboarding, and assert the plugin activated
 * (`html[data-dsh-viewer-active]` marker set by apply()) with no page errors.
 * Non-intrusive: no session seeding, no localStorage writes.
 */
import { chromium } from '@playwright/test'

const url = process.env.DSH_E2E_URL ?? 'http://127.0.0.1:3080'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(String(error)))

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#root > *', { timeout: 90_000 })

  // Dismiss keyless-boot onboarding (Continue / Configure later), if present.
  for (let round = 0; round < 6; round++) {
    for (const name of ['Continue', 'Configure later']) {
      const button = page.getByRole('button', { name, exact: true }).first()
      if ((await button.count()) === 0) continue
      try {
        await button.click({ timeout: 3_000 })
        await page.waitForTimeout(500)
      } catch {
        /* masked by a takeover stacked above; retried next round */
      }
    }
  }

  // Primary: activation marker (apply() ran, regardless of session state).
  await page.waitForSelector('html[data-dsh-viewer-active]', { timeout: 60_000 })
  console.log('PASS: plugin activated (html[data-dsh-viewer-active] present)')

  if (errors.length > 0) {
    console.log('FAIL: page errors present:')
    for (const error of errors) console.log('  - ' + error)
    process.exitCode = 1
  } else {
    console.log('PASS: no page errors')
    console.log('MOUNT SMOKE: ALL PASS')
  }
} catch (error) {
  console.log('FAIL:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await browser.close()
}
