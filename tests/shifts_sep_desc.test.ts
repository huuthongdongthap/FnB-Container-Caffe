import { describe, test, expect, vi } from 'vitest';

describe('A', () => {
  vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'A', role: 'staff' }); await next(); }, }));
  test('A', async () => {
    const mod = await import('../worker/src/routes/shifts');
    const router = mod.shiftsRouter;
    const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, { JWT_SECRET: 'test-secret', AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } });
    const body = await res.json();
    console.log('A STATUS:', res.status, 'data id:', body.data?.staff_id);
    expect(res.status).toBe(200);
  });
});

describe('B', () => {
  vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'B', role: 'staff' }); await next(); }, }));
  test('B', async () => {
    const mod = await import('../worker/src/routes/shifts');
    const router = mod.shiftsRouter;
    const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, { JWT_SECRET: 'test-secret', AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } });
    const body = await res.json();
    console.log('B STATUS:', res.status, 'data id:', body.data?.staff_id);
    expect(res.status).toBe(200);
  });
});
