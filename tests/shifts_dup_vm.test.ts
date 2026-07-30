import { describe, test, expect, vi } from 'vitest';

vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'first', role: 'staff' }); await next(); }, }));
vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'second', role: 'staff' }); await next(); }, }));

describe('dup vm', () => {
 test('which mock wins', async () => {
 try {
 const mod = await import('../worker/src/routes/shifts');
 const router = mod.shiftsRouter;
 const env = { JWT_SECRET: 'test-secret', AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } };
 const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
 const body = await res.json();
 console.log('STATUS:', res.status, 'BODY id:', body.data?.staff_id);
 expect(res.status).toBe(200);
 } catch (e) { console.log('ERROR:', e.message); }
 });
});
