import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    define: {
      'process.env.NODE_ENV': JSON.stringify('test'),
    },
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/__tests__/**/*.test.ts',
    ],
    exclude: ['node_modules'],
    watch: false,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['node_modules', 'src/__tests__'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/middleware': fileURLToPath(new URL('./src/middleware', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@/routes': fileURLToPath(new URL('./src/routes', import.meta.url)),
      '@/types': fileURLToPath(new URL('./types', import.meta.url)),
    },
  },
});
