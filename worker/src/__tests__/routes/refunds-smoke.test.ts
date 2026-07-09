import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

const JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await generateJWT(
    { id: 'USR_TEST', email: 'test@test.com', name: 'Test Owner', role: 'owner' },
    JWT_SECRET,
    '3600'
  );
  return { Authorization: `Bearer ${token}` };
}

describe('Refunds smoke', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function refundMockDB(config: { paymentAmount?: number } = {}): ReturnType<typeof createMockDB> {
    const { paymentAmount = 50000 } = config;
    const db = createMockDB();
    db.prepare = ((sql: string) => {
      const stmt: Record<string, unknown> = {
        _sql: sql,
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt._binds = args;
          return stmt;
        },
        first: async() => {
          if (!sql.includes('FROM payments WHERE id = ?')) {
            return null;
          }
          return {
            id: 'PAY_1',
            order_id: 'ORD_1',
            method: 'momo',
            amount: paymentAmount,
            status: 'paid',
            transaction_id: '123',
            refund_status: null,
            refund_amount: null,
            refund_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        },
        all: async() => ({ results: [], success: true }),
        run: async() => ({ success: true, changes: 1, lastRowId: 1 }),
        raw: async() => []
      };
      return stmt as any;
    }) as any;
    return db;
  }

  it('processes refund successfully — happy path', async() => {
    const { Hono } = await import('hono');
    const { refundRouter } = await import('../../routes/refunds');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: '00', desc: 'success', data: { refundAmount: 50000 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const app = new Hono();
    const api = new Hono();
    api.route('/payments', refundRouter);
    app.route('/api', api);

    const env = {
      ...createMockEnv(),
      AURA_DB: refundMockDB({ paymentAmount: 50000 })
    };

    const headers = await authHeaders();
    const req = new Request('https://test.aura/api/payments/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ paymentId: 'PAY_1', amount: 50000, reason: 'test refund' })
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 when refund amount exceeds payment — error path', async() => {
    const { Hono } = await import('hono');
    const { refundRouter } = await import('../../routes/refunds');

    const app = new Hono();
    const api = new Hono();
    api.route('/payments', refundRouter);
    app.route('/api', api);

    const env = {
      ...createMockEnv(),
      AURA_DB: refundMockDB({ paymentAmount: 50000 })
    };

    const headers = await authHeaders();
    const req = new Request('https://test.aura/api/payments/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ paymentId: 'PAY_1', amount: 100000, reason: 'test refund' })
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });
});
