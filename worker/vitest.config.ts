import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'src/tree/campaigns/**/*.test.ts'],
    exclude: ['node_modules'],
    watch: false,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['node_modules', 'src/__tests__'],
    },
  },
});
