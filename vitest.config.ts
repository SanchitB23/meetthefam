import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    // Mirror the `@/*` -> `src/*` alias from tsconfig.json so test files can
    // import Server Actions and other src modules the same way the app does.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/__tests__/**/*.test.{ts,tsx}',
      'src/lib/**/*.test.{ts,tsx}',
      'scripts/**/__tests__/**/*.test.ts',
    ],
    // Registers `afterEach(cleanup)` for @testing-library/react so jsdom
    // renders don't leak across tests in the same file (see vitest.setup.ts
    // / #133). Without it, screen.getByRole matches stale elements.
    setupFiles: ['./vitest.setup.ts'],
  },
})
