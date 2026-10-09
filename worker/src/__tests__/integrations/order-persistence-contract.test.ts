/**
 * Order Persistence Contract Integration Tests
 * Verifies canonical D1 persistence:
 * - canonical Order write = handleCreateOrder
 * - canonical line item = server-generated snapshot in order_items (7 cols)
 * - order_items.product_id references products.id
 * - snapshot JSON encoded exactly once
 * - persisted totals derive exclusively from server snapshot
 * - table references use cafe_tables
 * - KDS/history readback compatibility
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { makePersistenceTestEnv } from './order-persistence-test-helper';

describe('Order Persistence Contract (/api/orders)', () => {
  it('persists single-item order with canonical 7 columns in order_items', async () => {
    const { env, insertLogs } = makePersistenceTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Diner A',
        customer_phone: '0901234567',
        payment_method: 'cod',
        order_type: 'takeaway',
        total: 999999, // tampered total ignored
        items: [{ product_id: 'P1', name: 'Espresso', quantity: 1, price: 999999 }], // tampered price
      }),
    }), env);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.data.total).toBe(25000); // server authoritative

    // Verify orders table insert
    const orderInsert = insertLogs.find(l => l.sql.includes('INSERT INTO orders'));
    expect(orderInsert).toBeDefined();
    expect(orderInsert?.binds[2]).toBe(25000); // total is server calculated

    // Verify order_items table insert with 7 canonical columns
    const itemInsert = insertLogs.find(l => l.sql.includes('INSERT INTO order_items'));
    expect(itemInsert).toBeDefined();
    expect(itemInsert?.sql).toContain('id, order_id, product_id, quantity, subtotal, modifiers, created_at');
    expect(itemInsert?.binds[2]).toBe('P1'); // product_id references products.id
    expect(itemInsert?.binds[3]).toBe(1); // quantity
    expect(itemInsert?.binds[4]).toBe(25000); // subtotal
  });

  it('persists multi-item order creating normalized order_items for each item', async () => {
    const { env, insertLogs } = makePersistenceTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Diner B',
        customer_phone: '0901234568',
        payment_method: 'cod',
        order_type: 'takeaway',
        total: 85000,
        items: [
          { product_id: 'P1', name: 'Espresso', quantity: 2 }, // 25000 * 2 = 50000
          { product_id: 'P2', name: 'Croissant', quantity: 1 }, // 35000 * 1 = 35000
        ],
      }),
    }), env);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.data.total).toBe(85000);

    const itemInserts = insertLogs.filter(l => l.sql.includes('INSERT INTO order_items'));
    expect(itemInserts.length).toBe(2);
    expect(itemInserts[0].binds[2]).toBe('P1');
    expect(itemInserts[0].binds[3]).toBe(2);
    expect(itemInserts[0].binds[4]).toBe(50000);

    expect(itemInserts[1].binds[2]).toBe('P2');
    expect(itemInserts[1].binds[3]).toBe(1);
    expect(itemInserts[1].binds[4]).toBe(35000);
  });

  it('persists modifiers and resolves price delta server-side into order_items', async () => {
    const { env, insertLogs } = makePersistenceTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Diner Mod',
        customer_phone: '0901234569',
        payment_method: 'cod',
        order_type: 'takeaway',
        total: 10000,
        items: [{
          product_id: 'P1',
          name: 'Espresso',
          quantity: 1,
          modifiers: [{ group_id: 'G1', choice_id: 'M1', price_delta: 0 }], // tampered delta
        }],
      }),
    }), env);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.data.total).toBe(35000); // 25000 base + 10000 oat milk delta

    const itemInsert = insertLogs.find(l => l.sql.includes('INSERT INTO order_items'));
    expect(itemInsert?.binds[4]).toBe(35000);
    const modJson = JSON.parse(String(itemInsert?.binds[5]));
    expect(modJson[0]).toMatchObject({ id: 'M1', price_delta: 10000 });
  });

  it('binds table_id via cafe_tables lookup and auto-occupies table', async () => {
    const { env, insertLogs } = makePersistenceTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Diner DineIn',
        customer_phone: '0909998877',
        payment_method: 'cod',
        order_type: 'dine_in',
        table_id: '1',
        total: 25000,
        items: [{ product_id: 'P1', name: 'Espresso', quantity: 1 }],
      }),
    }), env);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.data.table_id).toBe('tbl-uuid-1');

    const tableUpdate = insertLogs.find(l => l.sql.includes('UPDATE cafe_tables SET status = \'Occupied\''));
    expect(tableUpdate).toBeDefined();
    expect(tableUpdate?.binds[0]).toBe('tbl-uuid-1');
  });

  it('guarantees single JSON encoding for KDS and order history readback', async () => {
    const { env, insertLogs } = makePersistenceTestEnv();
    const res = await app.fetch(new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'KDS Diner',
        customer_phone: '0908887766',
        payment_method: 'cod',
        order_type: 'takeaway',
        total: 50000,
        items: [{ product_id: 'P1', name: 'Espresso', quantity: 2 }],
      }),
    }), env);

    expect(res.status).toBe(201);
    const orderInsert = insertLogs.find(l => l.sql.includes('INSERT INTO orders'));
    const itemsValue = orderInsert?.binds[1];

    // Single JSON encoding: must parse directly to array without double JSON decode
    expect(typeof itemsValue).toBe('string');
    const parsed = JSON.parse(itemsValue as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toMatchObject({
      menuItemId: 'P1',
      name: 'Espresso',
      quantity: 2,
      unitPriceCents: 25000,
      subtotalCents: 50000,
    });
  });
});
