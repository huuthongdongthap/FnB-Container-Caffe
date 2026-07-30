import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'tu', role: 'staff' }); await next(); }, }));

describe('shifts_test_debug with beforeEach', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  test('import and use', async () => {
    const mod = await import('../worker/src/routes/shifts');
    const router = mod.shiftsRouter;
    const env = { AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } };
    const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Body:', body);
    expect(res.status).toBe(200);
  });
});
