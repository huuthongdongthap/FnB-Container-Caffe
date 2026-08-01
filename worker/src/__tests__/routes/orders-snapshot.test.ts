/**
 * Phase 0 — Regression Snapshot: POST /api/orders response shape.
 *
 * This test FREEZES the exact keys and types returned by createOrder().
 * It is the prerequisite gate for Phase 1 (DO integration).
 *
 * If any key is removed, renamed, or its type changes, this test MUST fail.
 * Run BEFORE modifying create-order.ts:  npx vitest run orders-snapshot.test.ts
 */

import { describe, it, expect } from 'vitest';
import { createOrder } from '../../routes/orders';
import { createMockEnv, createMockDB } from '../test-utils';

function snapshotMockDB() {
  const db = createMockDB();
  db.prepare = ((sql: string) => {
    const stmt: Record<string, unknown> = {
      _sql: sql,
      _binds: [] as unknown[],
      bind(...args: unknown[]) { this._binds = args; return this; },
      first: async() => {
        // table_id resolution
        if (sql.includes('FROM cafe_tables WHERE table_number')) {
          return { id: 'TBL_001' };
        }
        // duplicate check (Phase 1 idempotency guard)
        if (sql.toLowerCase().includes('from orders where id')) {
          return null; // not found — allow insert
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

describe('Phase 0: Response Shape Snapshot', () => {
  it('freezes POST /api/orders response keys and types', async() => {
    const env = { ...createMockEnv(), AURA_DB: snapshotMockDB(), REALTIME_ENABLED: 'false' };
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Ca Phe Sua', qty: 2, price: 35000 }],
        total: 70000,
        customer_name: 'Nguyen Van A',
        customer_phone: '0912345678',
        customer_email: 'test@example.com',
        customer_address: '123 Le Loi, Sa Dec',
        payment_method: 'cod',
        shipping_fee: 5000,
        discount: 0,
        notes: 'Less sugar',
        delivery_time: 'now'
      })
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);

    const body = await res.json() as Record<string, unknown>;

    // ── Top-level envelope ──
    expect(body).toHaveProperty('success');
    expect(typeof body.success).toBe('boolean');
    expect(body.success).toBe(true);

    expect(body).toHaveProperty('order');
    expect(typeof body.order).toBe('object');

    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');

    // ── order object — exact key whitelist (from create-order.ts:179-194) ──
    const order = body.order as Record<string, unknown>;
    const expectedKeys = [
      'id',            // string
      'status',        // 'pending'
      'payment_status',// 'unpaid'
      'items',         // array
      'total',         // number
  'table_id', // string | null (table reference)
      'customer',      // object { full_name, phone, address }
      'customer_name', // string
      'customer_phone',// string
      'customer_address', // string | null
      'payment_method',// string
      'shipping_fee',  // number
      'discount',      // number
      'notes',         // string | null
      'delivery_time', // string
      'created_at',    // string (ISO timestamp)
    ];

    // Fail if ANY key is missing
    const missing = expectedKeys.filter(k => !(k in order));
    expect(missing, `Missing keys in order response: ${missing.join(', ')}`).toEqual([]);

    // Fail if there are EXTRA keys (unexpected additions)
    const extra = Object.keys(order).filter(k => !expectedKeys.includes(k));
    expect(extra, `Unexpected extra keys in order response: ${extra.join(', ')}`).toEqual([]);

    // ── Type assertions ──
    expect(typeof order.id).toBe('string');
    expect(order.status).toBe('pending');
    expect(order.payment_status).toBe('unpaid');
    expect(Array.isArray(order.items)).toBe(true);
    expect(typeof order.total).toBe('number');
    expect(typeof order.customer).toBe('object');
    expect(order.customer).toHaveProperty('full_name');
    expect(order.customer).toHaveProperty('phone');
    expect(order.customer).toHaveProperty('address');
    expect(typeof order.customer_name).toBe('string');
    expect(typeof order.customer_phone).toBe('string');
    expect(order.customer_address === null || typeof order.customer_address === 'string').toBe(true);
    expect(typeof order.payment_method).toBe('string');
    expect(typeof order.shipping_fee).toBe('number');
    expect(typeof order.discount).toBe('number');
    expect(order.notes === null || typeof order.notes === 'string').toBe(true);
    expect(typeof order.delivery_time).toBe('string');
    // table_id: only present when request includes table_id → null or undefined acceptable here
    expect(order.table_id === null || order.table_id === undefined || typeof order.table_id === 'string').toBe(true);
    expect(typeof order.created_at).toBe('string');
    // created_at should be a valid ISO timestamp
    expect(new Date(order.created_at as string).toISOString()).toBe(order.created_at);
  });

  it('response shape is stable — empty optional fields still return null not undefined', async() => {
    const env = { ...createMockEnv(), AURA_DB: snapshotMockDB(), REALTIME_ENABLED: 'false' };
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Tra Chanh', qty: 1, price: 15000 }],
        total: 15000,
        customer_name: 'Test',
        customer_phone: '0900000000',
        payment_method: 'cod'
        // no email, address, shipping_fee, discount, notes, delivery_time, table_id
      })
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    const order = body.order as Record<string, unknown>;

    // Keys that should be null when not provided
    expect(order.customer_address).toBeNull();
    expect(order.customer).toHaveProperty('address', null);
    expect(order.notes).toBeNull();
    // Keys with numeric defaults
    expect(typeof order.shipping_fee).toBe('number');
    expect(typeof order.discount).toBe('number');
    // delivery_time defaults to 'now'
    expect(order.delivery_time).toBe('now');
  });
});
