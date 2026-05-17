import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/harmonies/**/*.ts'],
      exclude: ['lib/harmonies/**/*.test.ts', 'lib/harmonies/**/*.spec.ts'],
    },
  },
});
