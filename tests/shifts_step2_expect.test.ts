import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'tu', role: 'staff' }); await next(); }, }));

describe('debug shifts', () => {
  beforeEach(() => { vi.clearAllMocks(); });
 test('import and use', async () => {
 try {
 const mod = await import('../worker/src/routes/shifts');
 const router = mod.shiftsRouter;
 const env = { AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } };
 const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
 expect(res.status).toBe(200);
 } catch (e) { console.log('ERROR:', e.message, e.stack); }
 });
});
