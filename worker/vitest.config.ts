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
      'worker': fileURLToPath(new URL('.', import.meta.url)),
      '@/lib/client-session': fileURLToPath(new URL('../src/lib/client-session.ts', import.meta.url)),
      '@/lib/api-client': fileURLToPath(new URL('../src/lib/api-client.ts', import.meta.url)),
      '@/lib/offline-db': fileURLToPath(new URL('../src/lib/offline-db.ts', import.meta.url)),
      '@/lib/menu-drink-images': fileURLToPath(new URL('../src/lib/menu-drink-images.ts', import.meta.url)),
      '@/lib/menu-item': fileURLToPath(new URL('../src/lib/menu-item.ts', import.meta.url)),
      '@/hooks': fileURLToPath(new URL('../src/hooks', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/middleware': fileURLToPath(new URL('./src/middleware', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@/routes': fileURLToPath(new URL('./src/routes', import.meta.url)),
      '@/types': fileURLToPath(new URL('./types', import.meta.url)),
    },
  },
});
