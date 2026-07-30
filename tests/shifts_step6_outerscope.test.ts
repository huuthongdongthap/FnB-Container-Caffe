import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/middleware/auth.js', () => ({ requireAuth: () => async (c: any, next: any) => { c.set('user', { id: 'tu', role: 'staff' }); await next(); }, }));

function createMockD1() {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      })),
    })),
  };
}

let shiftsRouter: any;
let env: any;

describe('debug shifts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('import and use', async () => {
 try {
    const mod = await import('../worker/src/routes/shifts');
    shiftsRouter = mod.shiftsRouter;
    env = { JWT_SECRET: 'test-secret', AURA_DB: createMockD1() };
    const res = await shiftsRouter.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, env);
    expect(res.status).toBe(201);
 } catch (e) { console.log('ERROR:', e.message, e.stack); }
 });
});
