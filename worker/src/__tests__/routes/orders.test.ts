/**
 * Unit tests for orders routes (createOrder, getOrder, updateOrder, getAdminOrders, getStats)
 */

import { describe, it, expect, vi } from 'vitest';
import { notifyTelegram, createOrder, getOrder, updateOrder, getAdminOrders, getStats, getLatestOrderTimestamp } from '../../routes/orders';
import { createMockEnv, createMockDB } from '../test-utils';

function orderMockDB() {
  const db = createMockDB();
  db.prepare = ((sql: string) => {
    const stmt: Record<string, unknown> = {
      _sql: sql,
      _binds: [] as unknown[],
      bind: function (...args: unknown[]) { this._binds = args; return this; },
      first: async () => {
        if (sql.includes('FROM orders WHERE id = ?')) {
          return { id: 'ORD_1', items: '[{"name":"Coffee","qty":2,"price":35000}]', total: 70000, status: 'pending', payment_method: 'cod', payment_status: 'unpaid', customer_name: 'Test', customer_phone: '0912345678', customer_email: null, created_at: new Date().toISOString() };
        }
        if (sql.includes('SELECT COUNT(*) as count')) return { count: 5 };
        if (sql.includes('SELECT COALESCE')) return { total: 350000 };
        return null;
      },
      all: async () => {
        if (sql.includes('FROM orders')) {
          return { results: [{ id: 'ORD_1', items: '[]', total: 70000, status: 'pending', payment_status: 'unpaid', customer_name: 'Test', customer_phone: '0912345678', customer_address: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), shipping_fee: null, discount: null }], success: true };
        }
        return { results: [], success: true };
      },
      run: async () => {
        return { success: true, changes: 1, lastRowId: 0, meta: { last_row_id: 0 } };
      },
      raw: async () => [],
    };
    return stmt as any;
  }) as any;
  return db;
}

describe('createOrder', () => {
  it('creates a COD order successfully', async () => {
    const env = { ...createMockEnv(), AURA_DB: orderMockDB() };
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Coffee', qty: 2, price: 35000 }],
        total: 70000,
        customer_name: 'Test User',
        customer_phone: '0912345678',
        payment_method: 'cod',
      }),
    });
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });

  it('rejects invalid payment method', async () => {
    const env = { ...createMockEnv(), AURA_DB: orderMockDB() };
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Coffee', qty: 1, price: 35000 }],
        total: 35000,
        customer_name: 'Test',
        customer_phone: '0912345678',
        payment_method: 'invalid_method',
      }),
    });
    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
  });

  it('rejects empty order items', async () => {
    const env = { ...createMockEnv(), AURA_DB: orderMockDB() };
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [],
        total: 0,
        customer_name: 'Test',
        customer_phone: '0912345678',
        payment_method: 'cod',
      }),
    });
    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
  });
});

describe('getOrder', () => {
  it('returns order by ID', async () => {
    const env = { ...createMockEnv(), AURA_DB: orderMockDB() };
    const req = new Request('https://test.aura/api/orders/ORD_1');
    const res = await getOrder(req, env, 'ORD_1');
    expect(res.status).toBe(200);
  });
});

describe('updateOrder', () => {
  it('rejects invalid status transition', async () => {
    const env = { ...createMockEnv(), AURA_DB: orderMockDB() };
    const req = new Request('https://test.aura/api/orders/ORD_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    });
    const res = await updateOrder(req, env, 'ORD_1');
    expect(res.status).toBe(400);
  });
});

describe('getAdminOrders', () => {
  it('returns paginated orders', async () => {
    const env = { ...createMockEnv(), AURA_DB: orderMockDB() };
    const req = new Request('https://test.aura/api/admin/orders?limit=10&offset=0');
    const res = await getAdminOrders(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
  });
});

describe('getStats', () => {
  it('returns order statistics', async () => {
    const env = { ...createMockEnv(), AURA_DB: orderMockDB() };
    const req = new Request('https://test.aura/api/admin/stats');
    const res = await getStats(req, env);
    expect(res.status).toBe(200);
  });
});

describe('getLatestOrderTimestamp', () => {
  it('returns timestamp', async () => {
    const env = { ...createMockEnv(), AUTH_KV: createMockEnv().AUTH_KV };
    const req = new Request('https://test.aura/api/orders/latest');
    const res = await getLatestOrderTimestamp(req, env);
    expect(res.status).toBe(200);
  });
});

describe('notifyTelegram', () => {
  it('skips when TELEGRAM_BOT_TOKEN missing', async () => {
    const env = createMockEnv();
    await expect(notifyTelegram(env, { id: 'ORD_1', total: 70000 } as any)).resolves.not.toThrow();
  });
});
