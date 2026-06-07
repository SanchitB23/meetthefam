// playwright.config.ts
// SPIKE #215 — minimal config for the export-capture matrix. Controlled:
// single worker, no parallelism, generous per-test timeout so an OOM/hang is
// killed rather than wedging the machine. Run one browser at a time via
// `--project=<name>`. DELETE with the spike.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './scripts/spike-215',
  testMatch: 'capture-runner.spec.ts',
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
