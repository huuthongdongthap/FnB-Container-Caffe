import { describe, test, expect, vi, beforeEach } from 'vitest';

// EXACT mock from shifts.test.ts
vi.mock('../worker/src/middleware/auth.js', () => ({
 requireAuth: () => {
 return async (c: any, next: any) => {
 c.set('user', { id: 'test-user', email: 'staff@test.com', name: 'Test Staff', role: 'staff' });
 await next();
 };
 },
}));

describe('debug shifts', () => {
  beforeEach(() => { vi.clearAllMocks(); });
 test('import and use', async () => {
 try {
 const mod = await import('../worker/src/routes/shifts');
 const router = mod.shiftsRouter;
 const env = { JWT_SECRET: 'test-secret', AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } };
 const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
 expect(res.status).toBe(200);
 } catch (e) { console.log('ERROR:', e.message, e.stack); }
 });
});
