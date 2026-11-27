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
      '@aura/domain-catalog': fileURLToPath(new URL('../packages/domain/catalog/index.ts', import.meta.url)),
      '@aura/domain-audit': fileURLToPath(new URL('../packages/domain/audit/index.ts', import.meta.url)),
      '@aura/domain-notification': fileURLToPath(new URL('../packages/domain/notification/index.ts', import.meta.url)),
      '@aura/domain-integration': fileURLToPath(new URL('../packages/domain/integration/index.ts', import.meta.url)),
      '@aura/domain-observability': fileURLToPath(new URL('../packages/domain/observability/index.ts', import.meta.url)),
      '@aura/domain-deployment': fileURLToPath(new URL('../packages/domain/deployment/index.ts', import.meta.url)),
      '@aura/domain-security': fileURLToPath(new URL('../packages/domain/security/index.ts', import.meta.url)),
      '@aura/domain-continuity': fileURLToPath(new URL('../packages/domain/continuity/index.ts', import.meta.url)),
      '@aura/domain-migration': fileURLToPath(new URL('../packages/domain/migration/index.ts', import.meta.url)),
      '@aura/domain-customer': fileURLToPath(new URL('../packages/domain/customer/index.ts', import.meta.url)),
      '@aura/domain-crm': fileURLToPath(new URL('../packages/domain/crm/index.ts', import.meta.url)),
      '@aura/domain-order': fileURLToPath(new URL('../packages/domain/order/index.ts', import.meta.url)),
      '@aura/domain-table': fileURLToPath(new URL('../packages/domain/table/index.ts', import.meta.url)),
      '@aura/domain-payment': fileURLToPath(new URL('../packages/domain/payment/index.ts', import.meta.url)),
      '@aura/domain-kitchen': fileURLToPath(new URL('../packages/domain/kitchen/index.ts', import.meta.url)),
      '@aura/domain-staff': fileURLToPath(new URL('../packages/domain/staff/index.ts', import.meta.url)),
      '@aura/domain-shift': fileURLToPath(new URL('../packages/domain/shift/index.ts', import.meta.url)),
      '@aura/domain-sop': fileURLToPath(new URL('../packages/domain/sop/index.ts', import.meta.url)),
      '@aura/domain-inventory': fileURLToPath(new URL('../packages/domain/inventory/index.ts', import.meta.url)),
      '@aura/domain-reservation': fileURLToPath(new URL('../packages/domain/reservation/index.ts', import.meta.url)),
      'worker': fileURLToPath(new URL('.', import.meta.url)),
      '@/lib/guest-order-token': fileURLToPath(new URL('../src/lib/guest-order-token.ts', import.meta.url)),
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
