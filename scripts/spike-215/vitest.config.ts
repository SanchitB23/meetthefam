// Vitest config for spike-215 scripts — runs independently of the main app config.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/spike-215/__tests__/**/*.test.ts'],
  },
})
