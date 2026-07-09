import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';

vi.mock('../../middleware/auth', () => ({
  requireAuth: () => (_c: any, next: any) => next()
}));

describe('Payments MoMo smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeDB(): ReturnType<typeof createMockDB> {
    const db = createMockDB();
    db.prepare = ((sql: string) => {
      const stmt: Record<string, unknown> = {
        _sql: sql, _binds: [] as unknown[],
        bind(...args: unknown[]) {
          stmt._binds = args; return stmt;
        },
        async first() {
          if (sql.includes('FROM orders WHERE id = ?')) {
            return { id: 'ORD_1', total: '50000', payment_status: 'unpaid', customer_id: 'USR_1' };
          }
          if (sql.includes('FROM payments WHERE')) {
            return null;
          }
          return null;
        },
        all: async() => ({ results: [], success: true }),
        run: async() => ({ success: true, changes: 1, lastRowId: 1 }),
        raw: async() => []
      };
      return stmt as any;
    }) as any;
    return db;
  }

  it('creates MoMo payment link — happy path', async() => {
    const { Hono } = await import('hono');
    const { momoCreate } = await import('../../routes/payments/momo-create');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ resultCode: 0, payUrl: 'https://pay.momo.vn/abc123', transId: 'TX_MOMO' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const app = new Hono();
    momoCreate(app);

    const req = new Request('https://test.aura/momo/create/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: '550e8400-e29b-41d4-a716-446655440000' })
    });

    const env = {
      ...createMockEnv(),
      AURA_DB: makeDB(),
      MOMO_PARTNER_CODE: 'test-partner',
      MOMO_ACCESS_KEY: 'test-access',
      MOMO_SECRET_KEY: 'test-secret',
      FE_BASE_URL: 'https://test.aura'
    };

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
  });
});
