import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/middleware/auth.js', () => ({
  requireAuth: () => {
    return async (c: any, next: any) => {
      c.set('user', { id: 'test-user', email: 'staff@test.com', name: 'Test Staff', role: 'staff' });
      await next();
    };
  },
}));

function makeDb() {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  };
}

let shiftsRouter: any;
beforeEach(() => { vi.clearAllMocks(); });

describe('few tests', () => {
  test('clock-in', async () => {
    const mod = await import('../worker/src/routes/shifts');
    shiftsRouter = mod.shiftsRouter;
    const res = await shiftsRouter.request('/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, { JWT_SECRET: 'test-secret', AURA_DB: makeDb() });
    expect(res.status).toBe(201);
  });
  test('clock-out', async () => {
    const res = await shiftsRouter.request('/clock-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: 's1' }) }, { JWT_SECRET: 'test-secret', AURA_DB: makeDb() });
    expect(res.status).toBe(404);
  });
  test('get /', async () => {
    const res = await shiftsRouter.request('/', { method: 'GET' }, { JWT_SECRET: 'test-secret', AURA_DB: makeDb() });
    expect(res.status).toBe(200);
  });
});
