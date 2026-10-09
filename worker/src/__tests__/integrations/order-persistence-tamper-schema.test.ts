/**
 * Order Persistence: Tamper Resistance & Schema Compatibility Tests
 * Verifies:
 * - Tampered financial fields (subtotal, total, price) ignored
 * - Malformed input / missing items / invalid product rejection
 * - Fresh schema column compatibility for orders & order_items
 * - Guest checkout persistence matches canonical D1 columns
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../../index';
import { createMockEnv, createMockDB } from '../test-utils';

function makeTamperTestEnv() {
  const insertLogs: { sql: string; binds: unknown[] }[] = [];
  const db = createMockDB();

  db.prepare = (_sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind: (...args: unknown[]) => {
        bound = args;
        return stmt;
      },
      run: async () => {
        insertLogs.push({ sql: _sql, binds: bound });
        return { success: true, changes: 1, lastRowId: 1 };
      },
      first: async () => {
        if (_sql.includes('FROM products WHERE id = ?') || _sql.includes('FROM menu_items WHERE id = ?')) {
          const id = bound[0];
          if (id === 'P_VALID') return { id: 'P_VALID', name: 'Latte', price: 40000, is_available: 1, available: 1 };
          return null;
        }
        if (_sql.includes('FROM cafe_tables WHERE table_number = ?')) {
          if (bound[0] === 'T9') return { id: 'tbl-9', table_number: 'T9' };
          return null;
        }
        return null;
      },
      all: async () => ({ results: [], success: true }),
    };
    return stmt as any;
  };

  const store = new Map<string, string>();
  return {
    env: {
      ...createMockEnv(),
      AURA_DB: db,
      AUTH_KV: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => { store.set(k, v); },
        delete: async (k: string) => { store.delete(k); },
      } as any,
    } as any,
    insertLogs,
  };
}

describe('Order Persistence Tamper & Schema Validation', () => {
  it('discards client subtotal/total tamper and persists server snapshot total', async () => {
    const { env, insertLogs } = makeTamperTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Attacker',
        customer_phone: '0901112233',
        payment_method: 'cod',
        order_type: 'takeaway',
        total: 1000, // tampered total
        subtotal: 1000, // tampered subtotal
        items: [{ product_id: 'P_VALID', name: 'Latte', quantity: 2, price: 100 }], // 100 VND tampered
      }),
    }), env);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.data.total).toBe(80000); // 40000 * 2 = 80000

    const orderInsert = insertLogs.find(l => l.sql.includes('INSERT INTO orders'));
    expect(orderInsert?.binds[2]).toBe(80000);

    const itemInsert = insertLogs.find(l => l.sql.includes('INSERT INTO order_items'));
    expect(itemInsert?.binds[4]).toBe(80000); // subtotal
  });

  it('rejects order with non-existent product ID deterministically', async () => {
    const { env } = makeTamperTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Victim',
        customer_phone: '0902223344',
        payment_method: 'cod',
        order_type: 'takeaway',
        total: 50000,
        items: [{ product_id: 'P_NON_EXISTENT', name: 'Ghost', quantity: 1 }],
      }),
    }), env);

    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.success).toBe(false);
  });

  it('rejects order with empty items array', async () => {
    const { env } = makeTamperTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Diner Empty',
        customer_phone: '0903334455',
        payment_method: 'cod',
        total: 50000,
        items: [],
      }),
    }), env);

    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.success).toBe(false);
  });

  it('persists guest checkout using canonical orders and order_items schema', async () => {
    const { env, insertLogs } = makeTamperTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders/guest-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Khách Vãng Lai',
        customer_phone: '0904445566',
        fulfillment_type: 'DELIVERY',
        delivery_address: '123 Đường Hoa, Sa Đéc',
        payment_method: 'cod',
        items: [{ name: 'Trà Sen', qty: 2, price: 30000, product_id: 'P_VALID' }],
      }),
    }), env);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.total).toBe(60000);

    // Verify order insert uses order_type and customer_address (not fulfillment_type)
    const orderInsert = insertLogs.find(l => l.sql.includes('INSERT INTO orders'));
    expect(orderInsert).toBeDefined();
    expect(orderInsert?.sql).toContain('order_type, customer_address');
    expect(orderInsert?.binds[7]).toBe('delivery');
    expect(orderInsert?.binds[8]).toBe('123 Đường Hoa, Sa Đéc');

    // Verify order_items insert matches canonical 7 columns
    const itemInsert = insertLogs.find(l => l.sql.includes('INSERT INTO order_items'));
    expect(itemInsert).toBeDefined();
    expect(itemInsert?.sql).toContain('id, order_id, product_id, quantity, subtotal, modifiers, created_at');
    expect(itemInsert?.binds[2]).toBe('P_VALID');
    expect(itemInsert?.binds[3]).toBe(2);
    expect(itemInsert?.binds[4]).toBe(60000);
  });

  it('validates canonical schema DDL compatibility for orders and order_items', () => {
    const workerSchema = fs.readFileSync(path.resolve(__dirname, '../../../schema.sql'), 'utf8');
    const rootSchema = fs.readFileSync(path.resolve(__dirname, '../../../../db/schema.sql'), 'utf8');

    for (const schema of [workerSchema, rootSchema]) {
      // Check order_items has exact 7 canonical columns and references products(id)
      expect(schema).toMatch(/CREATE TABLE (IF NOT EXISTS )?order_items/);
      expect(schema).toContain('FOREIGN KEY (product_id) REFERENCES products(id)');
      expect(schema).not.toContain('variant_id');
      expect(schema).not.toContain('unit_price');
      expect(schema).not.toContain('total_price');

      // Check orders has cafe_tables foreign key and canonical columns
      expect(schema).toContain('FOREIGN KEY (table_id) REFERENCES cafe_tables(id)');
      expect(schema).toContain('order_type TEXT DEFAULT \'dine_in\'');
      expect(schema).toContain('tip_amount INTEGER DEFAULT 0');
      expect(schema).toContain('service_fee INTEGER DEFAULT 0');
    }
  });
});
