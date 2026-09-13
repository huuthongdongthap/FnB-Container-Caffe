import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/middleware': fileURLToPath(new URL('./worker/src/middleware', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./worker/src/lib', import.meta.url)),
      '@aura/domain-customer': fileURLToPath(new URL('./packages/domain/customer/index.ts', import.meta.url)),
      '@aura/domain-crm': fileURLToPath(new URL('./packages/domain/crm/index.ts', import.meta.url)),
      'worker/src/middleware/logger': fileURLToPath(new URL('./worker/src/middleware/logger.ts', import.meta.url)),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts', './tests/vitest-setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/**/*.test.{js,ts}',
      'worker/src/**/*.test.ts',
      'packages/**/*.test.ts',
    ],
    css: true,
  },
});
