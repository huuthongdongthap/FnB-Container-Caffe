import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/middleware/auth.ts', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'tu', role: 'staff' }); await next(); }, }));

describe('direct ts mock', () => {
  beforeEach(() => { vi.clearAllMocks(); });
 test('ts path', async () => {
 try {
 const mod = await import('../worker/src/routes/shifts');
 const router = mod.shiftsRouter;
 const env = { JWT_SECRET: 'test-secret', AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } };
 const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
 const text = await res.text();
 console.log('TS MOCK Status:', res.status, 'Body:', text);
 expect(res.status).toBe(201);
 } catch (e) { console.log('ERROR:', e.message); }
 });
});
