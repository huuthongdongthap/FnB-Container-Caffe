/**
 * Order State Machine KDS & Cancellation Contract Tests
 * Verifies:
 * - KDS status transition validation
 * - Rejection of invalid / terminal transitions in KDS
 * - Customer cancellation boundary (permitted on pending, forbidden on confirmed/preparing)
 * - Staff cancellation boundary (permitted before serving, forbidden once served)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { handleUpdateOrderStatus } from '../../routes/orders-hono-handlers/kds-handlers';
import { handleCancelOrder } from '../../routes/openapi-orders-handlers/order-cancel-handlers';

function makeKdsMockEnv(orderRow: { id: string; status: string; customer_id?: string | null }, userRole = 'staff', userId = 'usr_1') {
  const executedStatements: Array<{ sql: string; binds: unknown[] }> = [];

  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => { binds = args; return stmt; },
        first: async () => {
          if (sql.includes('FROM orders')) {
            return { items: '[]', total: 50000, payment_status: 'unpaid', customer_id: 'usr_1', ...orderRow };
          }
          return null;
        },
        run: async () => { executedStatements.push({ sql, binds }); return { success: true, changes: 1 }; },
        all: async () => ({ results: [], success: true }),
      };
      return stmt as any;
    },
  };

  const app = new Hono<{ Bindings: any }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: userId, role: userRole });
    await next();
  });
  app.patch('/kds/:id/status', handleUpdateOrderStatus);
  app.post('/orders/:id/cancel', handleCancelOrder);

  return { app, env: { AURA_DB: db }, executedStatements };
}

describe('Order State Machine KDS & Cancellation Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows KDS staff to move order from confirmed to preparing', async () => {
    const { app, env, executedStatements } = makeKdsMockEnv({
      id: 'ORD_KDS_1',
      status: 'confirmed',
    });

    const res = await app.fetch(
      new Request('https://test.aura/kds/ORD_KDS_1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const update = executedStatements.find(s => s.sql.includes('UPDATE orders SET status'));
    expect(update).toBeDefined();
    expect(update?.binds[0]).toBe('preparing');
  });

  it('rejects KDS illegal transition with HTTP 400', async () => {
    const { app, env } = makeKdsMockEnv({
      id: 'ORD_KDS_2',
      status: 'pending',
    });

    const res = await app.fetch(
      new Request('https://test.aura/kds/ORD_KDS_2/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }), // Illegal skip
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  it('rejects KDS status update on terminal order with HTTP 400', async () => {
    const { app, env } = makeKdsMockEnv({
      id: 'ORD_KDS_3',
      status: 'cancelled',
    });

    const res = await app.fetch(
      new Request('https://test.aura/kds/ORD_KDS_3/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' }),
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toContain('terminal');
  });

  it('allows customer to cancel order when pending before kitchen start', async () => {
    const { app, env, executedStatements } = makeKdsMockEnv({
      id: 'ORD_CUST_1',
      status: 'pending',
      customer_id: 'cust_99',
    }, 'customer', 'cust_99');

    const res = await app.fetch(
      new Request('https://test.aura/orders/ORD_CUST_1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Customer changed mind' }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const cancelUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders SET status = \'cancelled\''));
    expect(cancelUpdate).toBeDefined();
  });

  it('rejects customer cancellation once order is confirmed/preparing with HTTP 403', async () => {
    const { app, env } = makeKdsMockEnv({
      id: 'ORD_CUST_2',
      status: 'preparing',
      customer_id: 'cust_99',
    }, 'customer', 'cust_99');

    const res = await app.fetch(
      new Request('https://test.aura/orders/ORD_CUST_2/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Too late' }),
      }),
      env
    );

    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toContain('may not transition');
  });

  it('allows staff to cancel order during preparation', async () => {
    const { app, env, executedStatements } = makeKdsMockEnv({
      id: 'ORD_STAFF_1',
      status: 'preparing',
      customer_id: 'cust_55',
    }, 'staff', 'staff_1');

    const res = await app.fetch(
      new Request('https://test.aura/orders/ORD_STAFF_1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Ran out of milk' }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const cancelUpdate = executedStatements.find(s => s.sql.includes('UPDATE orders SET status = \'cancelled\''));
    expect(cancelUpdate).toBeDefined();
  });

  it('rejects cancellation once order is served with HTTP 400 or 409', async () => {
    const { app, env } = makeKdsMockEnv({
      id: 'ORD_STAFF_2',
      status: 'served',
      customer_id: 'cust_55',
    }, 'staff', 'staff_1');

    const res = await app.fetch(
      new Request('https://test.aura/orders/ORD_STAFF_2/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Attempt after serve' }),
      }),
      env
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
