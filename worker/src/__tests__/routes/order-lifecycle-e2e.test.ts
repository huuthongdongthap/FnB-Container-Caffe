/**
 * Order Lifecycle E2E - full path through the Hono app.
 *
 * Exercises the real route handlers end-to-end with a scripted D1 mock:
 *   POST /api/orders        -> createOrder (idempotency KV, inventory reserve)
 *   PATCH /api/orders/:id   -> updateOrder (state machine, loyalty, ERPNext trigger)
 *   GET  /api/orders/:id    -> getOrder
 *
 * Auth is exercised with a real HS-256 JWT so requireAuth's secret path
 * runs, not a bypass. This is the integration backbone for the checkout
 * flow and must stay green when any order handler changes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedRow { [key: string]: unknown }

function makeScriptedDB(rowsBySql: Array<{ match: (sql: string) => boolean; rows: ScriptedRow[]; firstRow?: ScriptedRow | null }>): D1Database {
  const callLog: string[] = [];
  const boundLog: { sql: string; args: unknown[] }[] = [];
  let idx = 0;
  const db = {
    _log: callLog,
    _bound: boundLog,
    prepare: (sql: string) => {
      callLog.push(sql);
      let handler = rowsBySql[idx];
      if (handler && !handler.match(sql)) handler = rowsBySql.find(h => h.match(sql));
      if (handler) idx = rowsBySql.indexOf(handler) + 1;
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

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';
const TEST_KV = new Map<string, string>();

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

const ORDER_BODY = {
  customer_name: 'Nguyen Van A',
  customer_phone: '0909123456',
  customer_email: 'a@example.com',
  customer_address: undefined,
  payment_method: 'cod',
  items: [{ name: 'Product P1', product_id: 'P1', quantity: 2, price: 25000 }],
  total: 50000,
  shipping_fee: 0,
  discount: 0,
  notes: 'Less sugar',
  delivery_time: 'now',
};

describe('Order lifecycle E2E', () => {
  let token: string;

  beforeEach(async() => {
    token = await generateJWT({ sub: 'usr-owner', role: 'owner', name: 'Owner' }, TEST_JWT_SECRET);
  });

  it('creates an order, retrieves it, and transitions through the state machine', async() => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM products'), rows: [{ id: 'P1', price: 25000, name: 'P1' }] },
      { match: (s) => s.startsWith('INSERT INTO orders'), rows: [] },
      { match: (s) => s.includes('inventory_reserves'), rows: [] },
      { match: (s) => s.includes('SELECT id, status, total, payment_status'), rows: [{
        id: 'ORD-TEST-001', status: 'pending', payment_status: 'unpaid',
        total: 50000, customer_name: 'Nguyen Van A', customer_phone: '0909123456',
        customer_address: null, payment_method: 'cod', items: JSON.stringify(ORDER_BODY.items),
        shipping_fee: 0, discount: 0, notes: 'Less sugar', delivery_time: 'now',
        table_id: null, order_type: 'dine_in', tip_amount: 0, service_fee: 0,
        created_at: new Date().toISOString(),
      }] },
      { match: (s) => s.includes('SELECT id, status FROM orders'), firstRow: { id: 'ORD-TEST-001', status: 'pending' } },
      { match: (s) => s.startsWith('UPDATE orders SET'), rows: [] },
      { match: (s) => s.includes('SELECT id FROM customers'), rows: [] },
      { match: (s) => s.includes('SELECT id FROM referrals'), rows: [] },
    ]);

    const env = makeEnv(db);

    const createRes = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(ORDER_BODY),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as Record<string, unknown>;
    expect(created.success).toBe(true);
    expect((created.data as Record<string, unknown>).id).toMatch(/^ORD_/);

    const getRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD-TEST-001', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(getRes.status).toBe(200);
    const got = await getRes.json() as Record<string, unknown>;
    expect((got.order as Record<string, unknown>).id).toBe('ORD-TEST-001');

    const patchRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD-TEST-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'confirmed' }),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json() as Record<string, unknown>;
    expect(patched.success).toBe(true);

    const db2 = makeScriptedDB([
      { match: (s) => s.includes('SELECT id, status FROM orders'), firstRow: { id: 'ORD-TEST-001', status: 'confirmed' } },
    ]);
    const env2 = makeEnv(db2);
    const badRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD-TEST-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'pending' }),
      }),
      env2 as any, { waitUntil: () => {} } as any
    );
    expect(badRes.status).toBe(400);
    const bad = await badRes.json() as Record<string, unknown>;
    expect(bad.error).toContain('Invalid transition');
  });

  it('rejects order creation with empty items', async() => {
    const db = makeScriptedDB([]);
    const env = makeEnv(db);
    const res = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...ORDER_BODY, items: [] }),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(400);
  });
});
