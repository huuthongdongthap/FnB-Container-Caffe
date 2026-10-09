/**
 * Order State Machine Lifecycle Integration Tests
 * Verifies:
 * - Canonical order lifecycle progression
 * - Rejection of invalid / backward transitions
 * - Terminal state protection (completed, cancelled, failed, expired)
 * - Idempotency of duplicate transitions
 * - Payment success and failure isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canTransition, isTerminal } from '@aura/domain-order';
import { Hono } from 'hono';
import { handleOpenApiUpdateOrder } from '../../routes/openapi-orders-handlers/order-write-handlers';
import { paymentRouter } from '@aura/domain-payment';

function makeOrderMockEnv(initialOrder: { id: string; status: string; total: number; payment_status: string; is_cod?: number }) {
  const executedStatements: Array<{ sql: string; binds: unknown[] }> = [];

  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          binds = args;
          return stmt;
        },
        first: async () => {
          if (sql.includes('FROM orders')) {
            return {
              customer_id: 'usr_1',
              items: '[]',
              ...initialOrder,
            };
          }
          if (sql.includes('FROM cafe_tables')) return null;
          return null;
        },
        run: async () => {
          executedStatements.push({ sql, binds });
          return { success: true, changes: 1 };
        },
        all: async () => ({ results: [], success: true }),
      };
      return stmt as any;
    },
  };

  const app = new Hono<{ Bindings: any }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'usr_1', role: 'staff' });
    await next();
  });
  app.patch('/orders/:id', handleOpenApiUpdateOrder);
  app.route('/api/payment', paymentRouter);

  return { app, env: { AURA_DB: db, PAYOS_CLIENT_ID: 'cid', PAYOS_API_KEY: 'key', PAYOS_CHECKSUM_KEY: 'checksum' }, executedStatements };
}

describe('Order State Machine Lifecycle Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('permits valid full lifecycle progression', () => {
    expect(canTransition('pending', 'confirmed').ok).toBe(true);
    expect(canTransition('confirmed', 'preparing').ok).toBe(true);
    expect(canTransition('preparing', 'ready').ok).toBe(true);
    expect(canTransition('ready', 'served').ok).toBe(true);
    expect(canTransition('served', 'completed').ok).toBe(true);
  });

  it('permits delivery fulfillment lifecycle progression', () => {
    expect(canTransition('ready', 'delivered').ok).toBe(true);
    expect(canTransition('delivered', 'completed').ok).toBe(true);
  });

  it('rejects invalid stage-skipping transitions', () => {
    expect(canTransition('pending', 'preparing').ok).toBe(false);
    expect(canTransition('pending', 'served').ok).toBe(false);
    expect(canTransition('pending', 'ready').ok).toBe(false);
    expect(canTransition('confirmed', 'completed').ok).toBe(false);
  });

  it('rejects backward transitions', () => {
    expect(canTransition('ready', 'pending').ok).toBe(false);
    expect(canTransition('preparing', 'confirmed').ok).toBe(false);
    expect(canTransition('served', 'preparing').ok).toBe(false);
  });

  it('enforces terminal state immutability', () => {
    const terminals = ['completed', 'cancelled', 'failed', 'expired'];
    for (const term of terminals) {
      expect(isTerminal(term)).toBe(true);
      expect(canTransition(term, 'pending').ok).toBe(false);
      expect(canTransition(term, 'confirmed').ok).toBe(false);
      expect(canTransition(term, 'preparing').ok).toBe(false);
      expect(canTransition(term, 'ready').ok).toBe(false);
      expect(canTransition(term, 'served').ok).toBe(false);
      if (term !== 'completed') expect(canTransition(term, 'completed').ok).toBe(false);
      if (term !== 'cancelled') expect(canTransition(term, 'cancelled').ok).toBe(false);
    }
  });

  it('treats same-status transition as idempotent success', () => {
    expect(canTransition('preparing', 'preparing').ok).toBe(true);
    expect(canTransition('completed', 'completed').ok).toBe(true);
  });

  it('rejects API transition attempt out of terminal state with HTTP 400', async () => {
    const { app, env } = makeOrderMockEnv({
      id: 'ORD_TERM_1',
      status: 'completed',
      total: 50000,
      payment_status: 'paid',
    });

    const res = await app.fetch(
      new Request('https://test.aura/orders/ORD_TERM_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' }),
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('terminal');
  });

  it('rejects payment link creation for terminal orders with HTTP 409', async () => {
    const { app, env } = makeOrderMockEnv({
      id: 'ORD_TERM_2',
      status: 'cancelled',
      total: 60000,
      payment_status: 'unpaid',
      is_cod: 0,
    });

    const res = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_TERM_2' }),
      }),
      env
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('Cannot pay for cancelled order');
  });
});
