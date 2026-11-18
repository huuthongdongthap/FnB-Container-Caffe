// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { splitOrders } from '../../../../packages/domain/order/commands/split-orders';
import { updateOrder } from '../../../../packages/domain/order/commands/update-order';
import { tableSessionsRouter } from '../../routes/table-sessions';
import { updateTableStatus } from '../../routes/tables-mobile';
import { getOrdersInRange } from '../../tree/analytics/csv-export';
import { getCustomerMetrics } from '../../tree/analytics/customer-metrics';
import { getPeakHours } from '../../tree/analytics/peak-hours';
import { getTopProducts } from '../../tree/analytics/top-products';
import { getZoneStats } from '../../tree/analytics/zone-analytics';
import type { Env } from '../../types/env';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) { params = values; return stmt; },
      async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        return col ? ((row[col] as T) ?? null) : (row as unknown as T);
      },
      async all<T = Record<string, unknown>>() {
        return { results: sqlite.prepare(sql).all(...(params as never[])) as unknown as T[], success: true };
      },
      async run() {
        const info = sqlite.prepare(sql).run(...(params as never[]));
        return { success: true, meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) } };
      },
    };
    return stmt;
  };
  return { prepare, batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => Promise.all(stmts.map((s) => s.run())) } as unknown as D1Database;
}

describe('Table session PayOS settlement parity, split/cancel session synchronization, and secondary analytics hygiene', () => {
  it('closes sessions and releases mobile tables when PayOS orders have payment_status completed while still blocking unpaid orders', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number TEXT, zone TEXT, capacity INTEGER, status TEXT, current_order_id TEXT, current_session_id TEXT, tenant_id TEXT);
      CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, status TEXT, order_count INTEGER DEFAULT 0, total_amount INTEGER DEFAULT 0, current_order_id TEXT, notes TEXT, opened_at TEXT, closed_at TEXT, updated_at TEXT, tenant_id TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, table_id TEXT, session_id TEXT, status TEXT, payment_status TEXT, total INTEGER, tenant_id TEXT);
      INSERT INTO cafe_tables VALUES ('tbl_p1', '10', 'Indoor', 4, 'Occupied', 'ord_payos_done', 'sess_p1', 'sadec');
      INSERT INTO cafe_tables VALUES ('tbl_u1', '11', 'Indoor', 4, 'Occupied', 'ord_unpaid_1', 'sess_u1', 'sadec');
      INSERT INTO table_sessions VALUES ('sess_p1', 'tbl_p1', 'ordering', 1, 55000, 'ord_payos_done', NULL, '2026-11-18T01:00:00Z', NULL, '2026-11-18T01:00:00Z', 'sadec');
      INSERT INTO table_sessions VALUES ('sess_u1', 'tbl_u1', 'ordering', 1, 65000, 'ord_unpaid_1', NULL, '2026-11-18T01:00:00Z', NULL, '2026-11-18T01:00:00Z', 'sadec');
      INSERT INTO orders VALUES ('ord_payos_done', 'tbl_p1', 'sess_p1', 'confirmed', 'completed', 55000, 'sadec');
      INSERT INTO orders VALUES ('ord_unpaid_1', 'tbl_u1', 'sess_u1', 'confirmed', 'unpaid', 65000, 'sadec');
    `);
    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'cashier_1', role: 'cashier', tenantId: 'sadec' } as never);
      c.set('tenantId' as never, 'sadec' as never);
      await next();
    });
    app.route('/api/table-sessions', tableSessionsRouter);
    app.patch('/api/mobile/tables/:id', (c) => updateTableStatus(c));
    const bindings = { AURA_DB: db } as unknown as Env;

    const blockMobile = await app.request('/api/mobile/tables/tbl_u1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'free' }) }, bindings);
    const blockClose = await app.request('/api/table-sessions/sess_u1/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, bindings);
    expect(blockMobile.status).toBe(409);
    expect(blockClose.status).toBe(409);

    const freeMobile = await app.request('/api/mobile/tables/tbl_p1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'free' }) }, bindings);
    expect(freeMobile.status).toBe(200);
    expect((sqlite.prepare('SELECT status FROM table_sessions WHERE id = ?').get('sess_p1') as { status: string }).status).toBe('closed');

    sqlite.prepare("UPDATE cafe_tables SET status = 'Occupied', current_order_id = 'ord_payos_done', current_session_id = 'sess_p1' WHERE id = 'tbl_p1'").run();
    sqlite.prepare("UPDATE table_sessions SET status = 'ordering', closed_at = NULL WHERE id = 'sess_p1'").run();
    const closeOk = await app.request('/api/table-sessions/sess_p1/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, bindings);
    expect(closeOk.status).toBe(200);

    const closedTbl = sqlite.prepare('SELECT status, current_order_id, current_session_id FROM cafe_tables WHERE id = ?').get('tbl_p1') as Record<string, unknown>;
    const closedSess = sqlite.prepare('SELECT status FROM table_sessions WHERE id = ?').get('sess_p1') as { status: string };
    expect(closedSess.status).toBe('closed');
    expect(closedTbl).toEqual({ status: 'Available', current_order_id: null, current_session_id: null });
  });

  it('propagates session_id across split child orders and synchronizes table_sessions order_count and total_amount on split and cancel', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number TEXT, status TEXT, current_order_id TEXT, tenant_id TEXT);
      CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, status TEXT, order_count INTEGER DEFAULT 0, total_amount INTEGER DEFAULT 0, current_order_id TEXT, updated_at TEXT, tenant_id TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, price INTEGER, is_available INTEGER, tenant_id TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, items TEXT, subtotal INTEGER, shipping_fee INTEGER, discount INTEGER, total INTEGER, status TEXT, customer_name TEXT, customer_phone TEXT, customer_id TEXT, customer_email TEXT, customer_address TEXT, payment_method TEXT, payment_status TEXT, notes TEXT, delivery_time TEXT, cashback_used INTEGER DEFAULT 0, table_id TEXT, session_id TEXT, guest_token_hash TEXT, created_at TEXT, updated_at TEXT, tenant_id TEXT);
      INSERT INTO cafe_tables VALUES ('tbl_s1', 'S1', 'Occupied', 'ord_parent_s1', 'sadec');
      INSERT INTO table_sessions VALUES ('sess_s1', 'tbl_s1', 'ordering', 1, 90000, 'ord_parent_s1', '2026-11-18T01:00:00Z', 'sadec');
      INSERT INTO products VALUES ('prod_latte', 'Latte', 45000, 1, 'sadec');
      INSERT INTO orders VALUES ('ord_parent_s1', '[{"id":"prod_latte","product_id":"prod_latte","name":"Latte","quantity":2,"price":45000}]', 90000, 0, 0, 90000, 'pending', 'Parent', '0901112222', NULL, NULL, NULL, 'cod', 'unpaid', NULL, NULL, 0, 'S1', 'sess_s1', NULL, '2026-11-18T01:00:00Z', '2026-11-18T01:00:00Z', 'sadec');
    `);
    const db = createSqliteD1(sqlite);
    const env = {
      AURA_DB: db,
      AUTH_KV: { get: vi.fn(async () => null), put: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
      ORDER_BROADCASTER: { idFromName: (n: string) => n, get: () => ({ broadcast: vi.fn(async () => {}) }) },
    } as unknown as Record<string, unknown>;

    const splitRes = await splitOrders(
      new Request('https://aura.test/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem_sess_split_1' },
        body: JSON.stringify({
          parent_order_id: 'ord_parent_s1',
          table_id: 'S1',
          orders: [
            { customer_name: 'Split A', customer_phone: '0901112223', payment_method: 'cod', items: [{ product_id: 'prod_latte', name: 'Latte', quantity: 1, price: 45000 }] },
            { customer_name: 'Split B', customer_phone: '0901112224', payment_method: 'cod', items: [{ product_id: 'prod_latte', name: 'Latte', quantity: 1, price: 45000 }] },
          ],
        }),
      }),
      env,
      undefined,
      { id: 'cashier_1', role: 'cashier', tenantId: 'sadec' },
    );
    expect(splitRes.status).toBe(201);
    const splitJson = (await splitRes.json()) as { orders: Array<{ id: string; session_id?: string }> };
    expect(splitJson.orders).toHaveLength(2);
    const [childA, childB] = splitJson.orders;

    const childRows = sqlite.prepare('SELECT id, session_id FROM orders WHERE id IN (?, ?)').all(childA.id, childB.id) as Array<{ id: string; session_id: string }>;
    expect(childRows.every((r) => r.session_id === 'sess_s1')).toBe(true);

    const sessAfterSplit = sqlite.prepare('SELECT order_count, total_amount, current_order_id FROM table_sessions WHERE id = ?').get('sess_s1') as Record<string, unknown>;
    expect(sessAfterSplit).toEqual({ order_count: 2, total_amount: 90000, current_order_id: childA.id });

    const cancelRes = await updateOrder(
      new Request(`https://aura.test/api/orders/${childA.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }),
      env,
      childA.id,
      'manager',
      'sadec',
    );
    expect(cancelRes.status).toBe(200);

    const sessAfterCancel = sqlite.prepare('SELECT order_count, total_amount, current_order_id FROM table_sessions WHERE id = ?').get('sess_s1') as Record<string, unknown>;
    expect(sessAfterCancel).toEqual({ order_count: 1, total_amount: 45000, current_order_id: null });
  });

  it('excludes QR check-in placeholders and single-L canceled orders across customer metrics, peak hours, top products, zone stats, and CSV export', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const nowSql = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const ictDate = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    sqlite.exec(`
      CREATE TABLE customers (id TEXT PRIMARY KEY, phone TEXT, created_at TEXT, tenant_id TEXT);
      CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, zone TEXT, tenant_id TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT, table_id TEXT, total INTEGER, status TEXT, payment_status TEXT, payment_method TEXT, items TEXT, notes TEXT, created_at TEXT, tenant_id TEXT);
      CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, quantity INTEGER, subtotal INTEGER);
      INSERT INTO customers VALUES ('c1', '0901234567', '${nowSql}', 'sadec');
      INSERT INTO cafe_tables VALUES ('tbl_vip', 'VIP', 'sadec');
      INSERT INTO products VALUES ('p_matcha', 'Matcha Latte', 'sadec');
    `);
    const insOrder = sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    insOrder.run('ord_valid_1', 'Guest 1', '0901234567', 'tbl_vip', 60000, 'completed', 'completed', 'payos', '[{"product_id":"p_matcha","name":"Matcha Latte","quantity":2,"subtotal":60000}]', null, nowSql, 'sadec');
    insOrder.run('ord_qr_empty', 'QR Guest', '0901234567', 'tbl_vip', 0, 'pending', 'unpaid', 'cod', '[]', 'Khách QR - cho don mon', nowSql, 'sadec');
    insOrder.run('ord_canceled_1l', 'Canceled Guest', '0901234567', 'tbl_vip', 120000, 'canceled', 'unpaid', 'cod', '[{"product_id":"p_matcha","name":"Matcha Latte","quantity":4,"subtotal":120000}]', null, nowSql, 'sadec');
    insOrder.run('ord_pay_failed', 'Failed Guest', '0901234567', 'tbl_vip', 90000, 'pending', 'failed', 'payos', '[{"product_id":"p_matcha","name":"Matcha Latte","quantity":3,"subtotal":90000}]', null, nowSql, 'sadec');

    const insItem = sqlite.prepare('INSERT INTO order_items VALUES (?,?,?,?,?)');
    insItem.run('oi_1', 'ord_valid_1', 'p_matcha', 2, 60000);
    insItem.run('oi_2', 'ord_canceled_1l', 'p_matcha', 4, 120000);
    insItem.run('oi_3', 'ord_pay_failed', 'p_matcha', 3, 90000);

    const db = createSqliteD1(sqlite);
    const metrics = await getCustomerMetrics(db, 'sadec');
    expect(metrics).toEqual({ total_customers: 1, new_30d: 1, repeat_rate: 0, avg_order_value: 60000 });

    const peak = await getPeakHours(db, 7, 'sadec');
    expect(peak.reduce((s, r) => s + r.order_count, 0)).toBe(1);
    expect(peak.reduce((s, r) => s + r.revenue, 0)).toBe(60000);

    expect(await getTopProducts(db, 10, 'sadec')).toEqual([{ product_name: 'Matcha Latte', total_qty: 2, revenue: 60000 }]);
    expect(await getZoneStats(db, 7, 'sadec')).toEqual([{ label: 'VIP', value: 60000, count: 1 }]);

    const exported = await getOrdersInRange(db, ictDate, ictDate, 'sadec', { alignIct: true });
    expect(exported.map((r) => r.id)).toEqual(['ord_valid_1']);
  });
});
