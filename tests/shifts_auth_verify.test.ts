import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock 1: simple bypass
vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'tu', role: 'staff' }); await next(); }, }));

describe('verify auth mock applied', () => {
  beforeEach(() => { vi.clearAllMocks(); });

 test('basic - check auth mock was used', async () => {
    const { requireAuth: raMock } = await import('../worker/src/middleware/auth.js');

    const mod = await import('../worker/src/routes/shifts');
    const router = mod.shiftsRouter;
    const env = { JWT_SECRET: 'test-secret', AURA_DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }) }) } };
    const res = await router.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
    console.log('STATUS:', res.status);
    const body = await res.json();
    console.log('BODY:', JSON.stringify(body));
    expect(res.status).toBe(201);

    // Verify mock was called - if not, auth middleware is NOT our mock
    const mockFn = vi.mocked(raMock);
    console.log('Mock called?', mockFn.mock.calls.length > 0 || raMock.toString().includes('async'));
 });
});
