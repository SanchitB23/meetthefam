// scripts/spike-215/capture-runner.spec.ts
// SPIKE #215 — drives the export-probe across sizes; records client-capture
// metrics + a headless screenshot ("server path" proxy). Controlled run:
//   SPIKE_SIZES=25,50 pnpm exec playwright test --project=chromium
// Omit SPIKE_SIZES to run the full curve (25/50/100/150/200).
import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Tree IDs from `pnpm spike:seed` (Task 4).
const TREE_IDS: Record<number, string> = {
  25: 'fadea4d7-d1ee-4d8a-80a3-825e0dcadbd6',
  50: '728e3473-1b5a-442c-a02c-9822aef0a489',
  100: '5752d824-00da-4013-93b7-70b921f22a2e',
  150: '820c74ac-f23d-49b6-a820-5d4bc224b5e3',
  200: 'f68a90f6-18cd-49b2-81f5-1130c9909f53',
}

// Optional size filter so the controller can run ascending, one at a time.
const FILTER = process.env.SPIKE_SIZES
  ? new Set(process.env.SPIKE_SIZES.split(',').map((s) => Number(s.trim())))
  : null

mkdirSync('scripts/spike-215/results', { recursive: true })

for (const [sizeStr, treeId] of Object.entries(TREE_IDS)) {
  const size = Number(sizeStr)
  test(`capture ${size}`, async ({ page, browserName }) => {
    test.skip(FILTER !== null && !FILTER.has(size), 'filtered out by SPIKE_SIZES')

    await page.goto(`/spike/export-probe?tree=${treeId}`)
    await page.waitForSelector('svg.main_svg', { timeout: 30_000 })
    await page.waitForTimeout(2500) // settle layout + photo loads

    // Client path: click PNG, read the metric the probe stashed on window.
    await page.getByTestId('cap-png').click()
    const handle = await page.waitForFunction(
      () => (window as unknown as { __spikeMetrics?: unknown[] }).__spikeMetrics?.at(-1),
      { timeout: 120_000 },
    )
    const client = await handle.jsonValue()

    // "Server/headless" path proxy: Playwright screenshot of the SVG element.
    const t0 = Date.now()
    let headless: { ok: boolean; bytes: number; ms: number; error?: string }
    try {
      const shot = await page.locator('svg.main_svg').screenshot({ timeout: 60_000 })
      headless = { ok: true, bytes: shot.length, ms: Date.now() - t0 }
    } catch (e) {
      headless = { ok: false, bytes: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) }
    }

    const row = { size, browser: browserName, client, headless }
    writeFileSync(
      `scripts/spike-215/results/${browserName}-${size}.json`,
      JSON.stringify(row, null, 2),
    )
    console.log('SPIKE_RESULT ' + JSON.stringify(row))
    expect(true).toBe(true) // records data; does not gate
  })
}
