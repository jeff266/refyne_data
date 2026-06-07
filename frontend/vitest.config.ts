import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local for tests
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.spec.ts', 'tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: [
      // Exclude integration tests that require real DB connection (now fixed and passing with DB)
      // Run explicitly with: npm test -- trial-counter when DB is available
      'tests/billing/trial-counter.test.ts',

      // Exclude all E2E tests (Puppeteer, Playwright) - require running app + test accounts
      // Run explicitly with: npm test -- e2e or npm test -- arrangements-v2-preflight
      'tests/e2e/**',
      'tests/arrangements-v2-preflight.test.ts',
      'tests/waterfall-builder.test.ts',
    ],
    env: {
      // Dummy API keys for tests that mock external API calls but validate key presence
      GRAPHIQ_API_KEY: 'test-graphiq-key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/harmonies/**/*.ts'],
      exclude: ['lib/harmonies/**/*.test.ts', 'lib/harmonies/**/*.spec.ts'],
    },
  },
});
