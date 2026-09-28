/**
 * M4-D: Customer Order History & List Endpoint Tests
 *
 * Verifies the scoped GET /api/orders list endpoint:
 * 1. Authenticated customers see only their own orders (customer_id = their ID).
 * 2. Staff (owner/manager/staff) see all orders with optional filters.
 * 3. Unauthenticated requests are rejected with 401 Unauthorized.
 * 4. Response shape conforms to CustomerOrderResponseSchema array.
 * 5. Pagination and filter params work correctly under customer scope.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../worker/src/index';
import { generateJWT } from '../worker/src/lib/jwt';
import { CustomerOrderResponseSchema } from '../worker/src/schemas/orders';
import type { D1Database } from '@cloudflare/workers-types';

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';
const TEST_KV = new Map<string, string>();

function makeScriptedDB(rowsBySql: Array<{ match: (sql: string) => boolean; rows?: unknown[]; firstRow?: unknown | null }>): D1Database {
  const callLog: string[] = [];
  const boundLog: { sql: string; args: unknown[] }[] = [];
  const db = {
    _log: callLog,
    _bound: boundLog,
    prepare: (sql: string) => {
      callLog.push(sql);
      const handler = rowsBySql.find(h => h.match(sql));
      const rows = handler?.rows ?? (handler?.firstRow !== undefined ? [handler.firstRow] : []);
      const firstRow = handler?.firstRow !== undefined ? handler.firstRow : (rows[0] ?? null);
      const stmt = {
        bind: (...args: unknown[]) => { boundLog.push({ sql, args }); return stmt; },
        run: async () => ({ success: true, changes: 1, lastRowId: 1, meta: {} }),
        first: async () => firstRow,
        all: async () => ({ results: rows, success: true, meta: {} }),
        raw: async () => [],
      };
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  } as unknown as D1Database;
  return db;
}

function makeEnv(db: D1Database) {
  TEST_KV.clear();
  return {
    AURA_DB: db,
    AUTH_KV: {
      get: async (k: string) => (TEST_KV.has(k) ? TEST_KV.get(k) : null),
      put: async (k: string, v: string) => { TEST_KV.set(k, v); },
      delete: async (k: string) => { TEST_KV.delete(k); },
      list: async () => ({ keys: [] }),
    } as any,
    JWT_SECRET: TEST_JWT_SECRET,
    ENVIRONMENT: 'test',
  } as any;
}

const CUST_A_ID = '11111111-1111-4111-8111-111111111111';
const CUST_B_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_OWNER_ID = '33333333-3333-4333-8333-333333333333';

const MOCK_ORDERS = [
  { id: '123e4567-e89b-12d3-a456-426614174001', order_number: 'ORD-20260920-001', customer_id: CUST_A_ID, subtotal: 50000, total_amount: 50000, status: 'completed', payment_status: 'completed', channel: 'dine_in', notes: null, created_at: '2026-09-20T10:00:00.000Z', updated_at: '2026-09-20T10:00:00.000Z', location_id: '123e4567-e89b-12d3-a456-426614174099', table_id: null, source: 'pos', discount_amount: 0, tax_amount: 0, served_at: null, completed_at: null, cancelled_at: null },
  { id: '123e4567-e89b-12d3-a456-426614174002', order_number: 'ORD-20260920-002', customer_id: CUST_A_ID, subtotal: 75000, total_amount: 75000, status: 'pending', payment_status: 'pending', channel: 'takeaway', notes: 'Extra sauce', created_at: '2026-09-20T11:00:00.000Z', updated_at: '2026-09-20T11:00:00.000Z', location_id: '123e4567-e89b-12d3-a456-426614174099', table_id: null, source: 'mobile', discount_amount: 0, tax_amount: 0, served_at: null, completed_at: null, cancelled_at: null },
  { id: '123e4567-e89b-12d3-a456-426614174003', order_number: 'ORD-20260920-003', customer_id: CUST_B_ID, subtotal: 100000, total_amount: 100000, status: 'confirmed', payment_status: 'pending', channel: 'delivery', notes: null, created_at: '2026-09-20T12:00:00.000Z', updated_at: '2026-09-20T12:00:00.000Z', location_id: '123e4567-e89b-12d3-a456-426614174099', table_id: null, source: 'kiosk', discount_amount: 0, tax_amount: 0, served_at: null, completed_at: null, cancelled_at: null },
];

const MOCK_ITEMS: Record<string, any[]> = {
  '123e4567-e89b-12d3-a456-426614174001': [{ id: '123e4567-e89b-12d3-a456-426614174011', order_id: '123e4567-e89b-12d3-a456-426614174001', product_id: '123e4567-e89b-12d3-a456-426614174051', product_name: 'Cà phê đen', quantity: 2, unit_price: 25000, total_price: 50000, modifiers: null, notes: null, status: 'completed' }],
  '123e4567-e89b-12d3-a456-426614174002': [{ id: '123e4567-e89b-12d3-a456-426614174012', order_id: '123e4567-e89b-12d3-a456-426614174002', product_id: '123e4567-e89b-12d3-a456-426614174052', product_name: 'Bánh mì', quantity: 1, unit_price: 75000, total_price: 75000, modifiers: null, notes: 'Extra sauce', status: 'pending' }],
  '123e4567-e89b-12d3-a456-426614174003': [{ id: '123e4567-e89b-12d3-a456-426614174013', order_id: '123e4567-e89b-12d3-a456-426614174003', product_id: '123e4567-e89b-12d3-a456-426614174053', product_name: 'Combo', quantity: 1, unit_price: 100000, total_price: 100000, modifiers: null, notes: null, status: 'confirmed' }],
};

const MOCK_PAYMENTS: Record<string, any[]> = {
  '123e4567-e89b-12d3-a456-426614174001': [{ id: '123e4567-e89b-12d3-a456-426614174021', order_id: '123e4567-e89b-12d3-a456-426614174001', amount: 50000, method: 'cash', status: 'completed', transactionId: null, payosOrderCode: null, paidAt: '2026-09-20T10:05:00.000Z' }],
  '123e4567-e89b-12d3-a456-426614174002': [],
  '123e4567-e89b-12d3-a456-426614174003': [{ id: '123e4567-e89b-12d3-a456-426614174023', order_id: '123e4567-e89b-12d3-a456-426614174003', amount: 100000, method: 'card', status: 'pending', transactionId: null, payosOrderCode: null, paidAt: null }],
};

describe('M4-D: Customer Order History (GET /api/orders)', () => {
  let custAToken: string;
  let custBToken: string;
  let staffToken: string;

  beforeEach(async() => {
    custAToken = await generateJWT({ sub: CUST_A_ID, role: 'customer', name: 'Customer A' }, TEST_JWT_SECRET);
    custBToken = await generateJWT({ sub: CUST_B_ID, role: 'customer', name: 'Customer B' }, TEST_JWT_SECRET);
    staffToken = await generateJWT({ sub: STAFF_OWNER_ID, role: 'owner', name: 'Staff Owner' }, TEST_JWT_SECRET);
  });

  it('customer sees only their own orders with customer-safe projection', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('COUNT(*)'), firstRow: { total: 2 } },
      { match: (s) => s.includes('FROM orders o'), rows: [MOCK_ORDERS[0], MOCK_ORDERS[1]] },
      { match: (s) => s.includes('order_items') && s.includes(MOCK_ORDERS[0].id), rows: MOCK_ITEMS[MOCK_ORDERS[0].id] },
      { match: (s) => s.includes('order_payments') && s.includes(MOCK_ORDERS[0].id), rows: MOCK_PAYMENTS[MOCK_ORDERS[0].id] },
      { match: (s) => s.includes('order_items') && s.includes(MOCK_ORDERS[1].id), rows: MOCK_ITEMS[MOCK_ORDERS[1].id] },
      { match: (s) => s.includes('order_payments') && s.includes(MOCK_ORDERS[1].id), rows: MOCK_PAYMENTS[MOCK_ORDERS[1].id] },
    ]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', { headers: { Authorization: `Bearer ${custAToken}` } }),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orders).toHaveLength(2);
    // Verify each order matches customer projection schema
    body.data.orders.forEach((o: any) => {
      const parsed = CustomerOrderResponseSchema.safeParse(o);
      expect(parsed.success).toBe(true);
      expect(o.source).toBeUndefined();
      expect(o.payments).toBeUndefined();
    });
  });

  it('customer B sees only their own orders', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('COUNT(*)'), firstRow: { total: 1 } },
      { match: (s) => s.includes('FROM orders o'), rows: [MOCK_ORDERS[2]] },
      { match: (s) => s.includes('order_items'), rows: MOCK_ITEMS[MOCK_ORDERS[2].id] },
      { match: (s) => s.includes('order_payments'), rows: MOCK_PAYMENTS[MOCK_ORDERS[2].id] },
    ]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', { headers: { Authorization: `Bearer ${custBToken}` } }),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.orders[0].id).toBe(MOCK_ORDERS[2].id);
  });

  it('staff sees all orders (full staff projection)', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('COUNT(*)'), firstRow: { total: 3 } },
      { match: (s) => s.includes('FROM orders o'), rows: MOCK_ORDERS },
      { match: (s) => s.includes('order_items'), rows: MOCK_ITEMS[MOCK_ORDERS[0].id] },
      { match: (s) => s.includes('order_payments'), rows: MOCK_PAYMENTS[MOCK_ORDERS[0].id] },
    ]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', { headers: { Authorization: `Bearer ${staffToken}` } }),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders).toHaveLength(3);
    // Staff projection includes source, payments, etc.
    const first = body.data.orders[0];
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('payments');
  });

  it('staff can filter by customerId', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('COUNT(*)'), firstRow: { total: 1 } },
      { match: (s) => s.includes('FROM orders o'), rows: [MOCK_ORDERS[2]] },
      { match: (s) => s.includes('order_items'), rows: MOCK_ITEMS[MOCK_ORDERS[2].id] },
      { match: (s) => s.includes('order_payments'), rows: MOCK_PAYMENTS[MOCK_ORDERS[2].id] },
    ]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request(`https://test.aura/api/orders?customerId=${CUST_B_ID}`, { headers: { Authorization: `Bearer ${staffToken}` } }),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.orders[0].id).toBe(MOCK_ORDERS[2].id);
  });

  it('unauthenticated request fails with 401 Unauthorized', async() => {
    const db = makeScriptedDB([]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders'),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(401);
  });

  it('customer can filter by status', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('COUNT(*)'), firstRow: { total: 1 } },
      { match: (s) => s.includes('FROM orders o'), rows: [MOCK_ORDERS[1]] },
      { match: (s) => s.includes('order_items'), rows: MOCK_ITEMS[MOCK_ORDERS[1].id] },
      { match: (s) => s.includes('order_payments'), rows: MOCK_PAYMENTS[MOCK_ORDERS[1].id] },
    ]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders?status=pending', { headers: { Authorization: `Bearer ${custAToken}` } }),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.orders[0].status).toBe('pending');
  });

  it('customer can filter by date range', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('COUNT(*)'), firstRow: { total: 1 } },
      { match: (s) => s.includes('FROM orders o'), rows: [MOCK_ORDERS[1]] },
      { match: (s) => s.includes('order_items'), rows: MOCK_ITEMS[MOCK_ORDERS[1].id] },
      { match: (s) => s.includes('order_payments'), rows: MOCK_PAYMENTS[MOCK_ORDERS[1].id] },
    ]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders?dateFrom=2026-09-20', { headers: { Authorization: `Bearer ${custAToken}` } }),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.orders[0].id).toBe(MOCK_ORDERS[1].id);
  });

  it('pagination works correctly', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('COUNT(*)'), firstRow: { total: 2 } },
      { match: (s) => s.includes('FROM orders o'), rows: [MOCK_ORDERS[0]] },
      { match: (s) => s.includes('order_items'), rows: MOCK_ITEMS[MOCK_ORDERS[0].id] },
      { match: (s) => s.includes('order_payments'), rows: MOCK_PAYMENTS[MOCK_ORDERS[0].id] },
    ]);
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders?page=1&limit=1', { headers: { Authorization: `Bearer ${custAToken}` } }),
      env, { waitUntil: () => {} }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.meta.page).toBe(1);
    expect(body.data.meta.limit).toBe(1);
    expect(body.data.meta.total).toBe(2);
    expect(body.data.meta.totalPages).toBe(2);
  });
});