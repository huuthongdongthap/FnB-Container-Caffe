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
      '@aura/domain-catalog': fileURLToPath(new URL('./packages/domain/catalog/index.ts', import.meta.url)),
      '@aura/domain-customer': fileURLToPath(new URL('./packages/domain/customer/index.ts', import.meta.url)),
      '@aura/domain-crm': fileURLToPath(new URL('./packages/domain/crm/index.ts', import.meta.url)),
      '@aura/domain-order': fileURLToPath(new URL('./packages/domain/order/index.ts', import.meta.url)),
      '@aura/domain-table': fileURLToPath(new URL('./packages/domain/table/index.ts', import.meta.url)),
      '@aura/domain-payment': fileURLToPath(new URL('./packages/domain/payment/index.ts', import.meta.url)),
      '@aura/domain-kitchen': fileURLToPath(new URL('./packages/domain/kitchen/index.ts', import.meta.url)),
      '@aura/domain-staff': fileURLToPath(new URL('./packages/domain/staff/index.ts', import.meta.url)),
      '@aura/domain-shift': fileURLToPath(new URL('./packages/domain/shift/index.ts', import.meta.url)),
      '@aura/domain-inventory': fileURLToPath(new URL('./packages/domain/inventory/index.ts', import.meta.url)),
      '@aura/domain-reservation': fileURLToPath(new URL('./packages/domain/reservation/index.ts', import.meta.url)),
      'packages/domain/crm/commands/loyalty-policy': fileURLToPath(new URL('./packages/domain/crm/commands/loyalty-policy.ts', import.meta.url)),
      'packages/domain/crm/commands/accrual': fileURLToPath(new URL('./packages/domain/crm/commands/accrual.ts', import.meta.url)),
      'packages/domain/crm/commands/refund-reversal': fileURLToPath(new URL('./packages/domain/crm/commands/refund-reversal.ts', import.meta.url)),
      'packages/domain/order/policies/loyalty-trigger': fileURLToPath(new URL('./packages/domain/order/policies/loyalty-trigger.ts', import.meta.url)),
      'packages/domain/crm/commands/frequency-band': fileURLToPath(new URL('./packages/domain/crm/commands/frequency-band.ts', import.meta.url)),
      'packages/domain/crm/commands/preferences': fileURLToPath(new URL('./packages/domain/crm/commands/preferences.ts', import.meta.url)),
      'packages/domain/crm/commands/customer-360': fileURLToPath(new URL('./packages/domain/crm/commands/customer-360.ts', import.meta.url)),
      'packages/domain/crm/commands/segments': fileURLToPath(new URL('./packages/domain/crm/commands/segments.ts', import.meta.url)),
      'packages/domain/crm/commands/referral-policy': fileURLToPath(new URL('./packages/domain/crm/commands/referral-policy.ts', import.meta.url)),
      'packages/domain/crm/commands/referral': fileURLToPath(new URL('./packages/domain/crm/commands/referral.ts', import.meta.url)),
      'packages/domain/crm/commands/campaign/templates': fileURLToPath(new URL('./packages/domain/crm/commands/campaign/templates.ts', import.meta.url)),
      'packages/domain/crm/commands/campaign/dedup': fileURLToPath(new URL('./packages/domain/crm/commands/campaign/dedup.ts', import.meta.url)),
      'packages/domain/crm/commands/campaign/detect': fileURLToPath(new URL('./packages/domain/crm/commands/campaign/detect.ts', import.meta.url)),
      'packages/domain/crm/commands/campaign/types': fileURLToPath(new URL('./packages/domain/crm/commands/campaign/types.ts', import.meta.url)),
      '@hono/zod-openapi': fileURLToPath(new URL('./node_modules/@hono/zod-openapi/dist/index.mjs', import.meta.url)),
      'zod': fileURLToPath(new URL('./node_modules/zod/index.js', import.meta.url)),
      'worker/src': fileURLToPath(new URL('./worker/src', import.meta.url)),
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
