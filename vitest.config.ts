import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Pure unit tests for now: pure functions in lib/. No DOM, no jsdom.
    // When we add component or API-route tests, add `environment: 'jsdom'`
    // (or 'happy-dom') to a separate config or per-file pragma.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      // Mirror the tsconfig path alias so imports like `@/lib/labor` work
      // identically in tests and in the app.
      '@': path.resolve(__dirname, '.'),
    },
  },
})