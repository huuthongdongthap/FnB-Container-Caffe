import { test, expect, vi } from 'vitest';

vi.mock('../worker/src/middleware/auth.js', () => ({
  requireAuth: () => async (c: any, next: any) => {
    c.set('user', { id: 'tu', role: 'staff' });
    await next();
  },
}));

test('debug 1', async () => {
  const mod = await import('../worker/src/routes/shifts');
  const router = mod.shiftsRouter;
  const env = { AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } };
  const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
  expect(res.status).toBe(200);
});
