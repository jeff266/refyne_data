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
    include: ['lib/**/*.test.ts', 'lib/**/*.spec.ts'],
    env: {
      // Load from .env.local for local development tests
      // This ensures provider API keys are available during testing
    },
    envDir: __dirname,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/harmonies/**/*.ts'],
      exclude: ['lib/harmonies/**/*.test.ts', 'lib/harmonies/**/*.spec.ts'],
    },
  },
});
