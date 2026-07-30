import { describe, test, expect, vi } from 'vitest';
vi.mock('../worker/src/middleware/auth.ts', () => ({
  requireAuth: () => {
    return async (c: any, next: any) => {
      c.set('user', { id: 'test-user', email: 'staff@test.com', name: 'Test Staff', role: 'staff' });
      await next();
    };
  },
}));
describe('debug shifts', () => {
  test('import and use', async () => {
    const mod = (await import('../worker/src/routes/shifts')) as any;
    const router = mod.shiftsRouter;
    const env = {
      AURA_DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
        }),
      },
    };
    const res = await router.request('/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1' }),
    }, env);
    console.log('Status (.ts mock):', res.status);
  });
});
