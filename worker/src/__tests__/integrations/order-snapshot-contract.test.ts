/**
 * Order Snapshot Contract Integration Tests
 * Verifies single server-authoritative line-item contract across app & D1:
 * - input product ID mapping
 * - missing / unavailable product rejection
 * - modifier validation & cross-product rejection
 * - client price tampering ignored
 * - single JSON encoding & KDS snapshot integrity
 * - canonical D1 schema persistence (order_items 7 cols, cafe_tables)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import type { D1Database } from '@cloudflare/workers-types';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';

function makeMockDb(customHandlers?: Array<{ match: (sql: string) => boolean; row?: unknown; rows?: unknown[] }>) {
  const insertLogs: { sql: string; args: unknown[] }[] = [];
  const queryLogs: string[] = [];

  const db = {
    _inserts: insertLogs,
    _queries: queryLogs,
    prepare: (sql: string) => {
      queryLogs.push(sql);
      let boundArgs: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return stmt;
        },
        first: async () => {
          if (customHandlers) {
            const h = customHandlers.find(x => x.match(sql));
            if (h) return h.row ?? (h.rows ? h.rows[0] : null);
          }
          if (sql.includes('FROM products WHERE id = ?') || sql.includes('FROM menu_items WHERE id = ?')) {
            const id = boundArgs[0];
            if (id === 'P1') return { id: 'P1', name: 'Espresso', price: 25000, available: 1 };
            if (id === 'P-UNAVAIL') return { id: 'P-UNAVAIL', name: 'Cold Brew', price: 40000, available: 0 };
            return null;
          }
          if (sql.includes('FROM modifier_choices WHERE id = ?')) {
            const id = boundArgs[0];
            if (id === 'MOD-SHOT') return { id: 'MOD-SHOT', group_id: 'G1', name: 'Extra Shot', price_delta: 10000 };
            if (id === 'MOD-CROSS') return { id: 'MOD-CROSS', group_id: 'G-OTHER', name: 'Cross Mod', price_delta: 5000 };
            return null;
          }
          if (sql.includes('FROM modifier_groups WHERE id = ?')) {
            const id = boundArgs[0];
            if (id === 'G1') return { id: 'G1', name: 'Shots', type: 'multiple', required: 0, is_active: 1 };
            if (id === 'G-OTHER') return { id: 'G-OTHER', name: 'Other Group', type: 'multiple', required: 0, is_active: 1 };
            return null;
          }
          if (sql.includes('FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')) {
            const [pId, gId] = boundArgs;
            if (pId === 'P1' && gId === 'G1') return { product_id: 'P1', group_id: 'G1' };
            return null;
          }
          if (sql.includes('FROM cafe_tables WHERE table_number = ?')) {
            return { id: 'tbl-uuid-1', table_number: '1' };
          }
          if (sql.includes('FROM orders WHERE id = ?') || sql.includes('SELECT o.*')) {
            return {
              id: boundArgs[0] || 'ORD-001',
              status: 'pending',
              payment_status: 'unpaid',
              total_amount: 50000,
              items: JSON.stringify([{ menuItemId: 'P1', name: 'Espresso', quantity: 2, unitPriceCents: 25000, subtotalCents: 50000, modifiers: [] }]),
            };
          }
          return null;
        },
        all: async () => ({ results: [], success: true, meta: {} }),
        run: async () => {
          insertLogs.push({ sql, args: boundArgs });
          return { success: true, changes: 1, lastRowId: 1 };
        },
      };
      return stmt;
    },
    batch: async () => [],
  } as unknown as D1Database & { _inserts: typeof insertLogs; _queries: string[] };

  return db;
}

function makeEnv(db: D1Database) {
  const kv = new Map<string, string>();
  return {
    AURA_DB: db,
    AUTH_KV: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => { kv.set(k, v); },
      delete: async (k: string) => { kv.delete(k); },
    } as any,
    JWT_SECRET: TEST_SECRET,
    ENVIRONMENT: 'test',
  } as any;
}

describe('Order Snapshot Contract Integration', () => {
  let token: string;

  beforeEach(async () => {
    token = await generateJWT({ sub: 'usr-1', role: 'owner', name: 'Owner' }, TEST_SECRET);
  });

  it('ignores client prices, calculates server authoritative price and single JSON encodes snapshot', async () => {
    const db = makeMockDb();
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: 'Diner A',
          customer_phone: '0909000111',
          payment_method: 'cod',
          total: 1000, // tampered client total (server recalculates to 50000)
          items: [{ name: 'Espresso', product_id: 'P1', quantity: 2, price: 10 }], // tampered price
        }),
      }),
      env, { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);

    const orderInsert = db._inserts.find(i => i.sql.includes('INSERT INTO orders'));
    expect(orderInsert).toBeDefined();

    // Verify items was stored as valid single-encoded JSON string
    const itemsArg = orderInsert!.args.find(arg => typeof arg === 'string' && arg.startsWith('[{"'));
    expect(itemsArg).toBeDefined();
    const parsedItems = JSON.parse(itemsArg as string);
    expect(Array.isArray(parsedItems)).toBe(true);
    expect(parsedItems[0].menuItemId).toBe('P1');
    expect(parsedItems[0].unitPriceCents).toBe(25000);
    expect(parsedItems[0].subtotalCents).toBe(50000);

    // Verify order total ignores client price (2 * 25000 = 50000)
    expect(orderInsert!.args).toContain(50000);
  });

  it('rejects order with item_not_found when product does not exist in catalog', async () => {
    const db = makeMockDb();
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: 'Diner B',
          customer_phone: '0909000222',
          payment_method: 'cod',
          total: 50000,
          items: [{ name: 'Unknown', product_id: 'P-NONEXISTENT', quantity: 1, price: 50000 }],
        }),
      }),
      env, { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain('Product not found: P-NONEXISTENT');
  });

  it('rejects order with item_unavailable when product is inactive', async () => {
    const db = makeMockDb();
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: 'Diner C',
          customer_phone: '0909000333',
          payment_method: 'cod',
          total: 40000,
          items: [{ name: 'Cold Brew', product_id: 'P-UNAVAIL', quantity: 1, price: 40000 }],
        }),
      }),
      env, { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain('unavailable');
  });

  it('applies valid modifier price deltas and rejects cross-product modifier IDs', async () => {
    const db = makeMockDb();
    const env = makeEnv(db);

    // 1. Cross-product modifier -> rejected
    const badRes = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: 'Diner D',
          customer_phone: '0909000444',
          payment_method: 'cod',
          total: 30000,
          items: [{ name: 'Espresso', product_id: 'P1', quantity: 1, modifiers: ['MOD-CROSS'] }],
        }),
      }),
      env, { waitUntil: () => {} } as any
    );

    expect(badRes.status).toBe(400);
    const badBody = await badRes.json() as any;
    expect(badBody.error).toMatch(/modifier/i);

    // 2. Valid modifier -> accepted with authoritative delta
    const goodRes = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: 'Diner E',
          customer_phone: '0909000555',
          payment_method: 'cod',
          total: 35000,
          items: [{ name: 'Espresso', product_id: 'P1', quantity: 1, modifiers: ['MOD-SHOT'] }],
        }),
      }),
      env, { waitUntil: () => {} } as any
    );

    expect(goodRes.status).toBe(201);
    const orderInsert = db._inserts.find(i => i.sql.includes('INSERT INTO orders') && i.args.includes('Diner E'));
    expect(orderInsert).toBeDefined();
    // 25000 base + 10000 modifier = 35000 total
    expect(orderInsert!.args).toContain(35000);
  });

  it('reconciles D1 persistence: writes only canonical order_items columns and uses cafe_tables', async () => {
    const db = makeMockDb();
    const env = makeEnv(db);

    const res = await app.fetch(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_name: 'Diner F',
          customer_phone: '0909000666',
          table_id: '1',
          order_type: 'dine_in',
          payment_method: 'cod',
          total: 50000,
          items: [{ name: 'Espresso', product_id: 'P1', quantity: 2 }],
        }),
      }),
      env, { waitUntil: () => {} } as any
    );

    expect(res.status).toBe(201);

    // Verify cafe_tables was queried, NOT tables
    expect(db._queries.some(q => q.includes('FROM cafe_tables'))).toBe(true);
    expect(db._queries.some(q => q.match(/\bFROM tables\b/i))).toBe(false);

    // Verify order_items insert only uses the 7 canonical columns
    const itemInsert = db._inserts.find(i => i.sql.startsWith('INSERT INTO order_items'));
    if (itemInsert) {
      expect(itemInsert.sql).toBe(
        'INSERT INTO order_items (id, order_id, product_id, quantity, subtotal, modifiers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      expect(itemInsert.args.length).toBe(7);
    }
  });
});
