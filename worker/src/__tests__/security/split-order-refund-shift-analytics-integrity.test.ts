// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { splitOrders } from '../../../../packages/domain/order/commands/split-orders';
import { getStats } from '../../../../packages/domain/order/queries/stats';
import { openCanonicalShift, recordShiftSale, closeCanonicalShift } from '../../../../packages/domain/shift/src/policies/shift-lifecycle-policy';
import { handleRefund } from '../../routes/refunds-handlers/mutation-handlers';
import { getSummary } from '../../tree/analytics/summary';
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

describe('Split-order concurrency & BOM conservation, manual refund fanout & voucher clawback, shift CAS/dedup & analytics hygiene', () => {
  it('atomically claims parent order once on split, restores parent BOM & cashback, occupies Reserved table, and blocks paid-completed parents', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number TEXT, status TEXT, tenant_id TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, price INTEGER, is_available INTEGER, tenant_id TEXT);
      CREATE TABLE inventory_items (id TEXT PRIMARY KEY, name TEXT, unit TEXT, quantity REAL, cost_per_unit REAL, is_active INTEGER, updated_at TEXT, tenant_id TEXT);
      CREATE TABLE recipe_ingredients (id TEXT PRIMARY KEY, product_id TEXT, inventory_item_id TEXT, quantity REAL, unit TEXT, tenant_id TEXT);
      CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, inventory_item_id TEXT, type TEXT, quantity REAL, unit_cost REAL, reference_type TEXT, reference_id TEXT, notes TEXT, created_by TEXT, tenant_id TEXT);
      CREATE TABLE customers (id TEXT PRIMARY KEY, phone TEXT, cashback_balance REAL DEFAULT 0, tenant_id TEXT);
      CREATE TABLE cashback_transactions (id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, type TEXT, amount REAL, balance_after REAL, description TEXT, tenant_id TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, items TEXT, subtotal INTEGER, shipping_fee INTEGER, discount INTEGER, total INTEGER, status TEXT, customer_name TEXT, customer_phone TEXT, customer_id TEXT, customer_email TEXT, customer_address TEXT, payment_method TEXT, payment_status TEXT, notes TEXT, delivery_time TEXT, cashback_used INTEGER DEFAULT 0, table_id TEXT, guest_token_hash TEXT, created_at TEXT, updated_at TEXT, tenant_id TEXT);
      INSERT INTO cafe_tables VALUES ('tbl_r1', 'R1', 'Reserved', 'sadec');
      INSERT INTO products VALUES ('prod_latte', 'Latte', 45000, 1, 'sadec');
      INSERT INTO inventory_items VALUES ('inv_beans', 'Arabica Beans', 'g', 80, 500, 1, '2026-11-17T00:00:00Z', 'sadec');
      INSERT INTO recipe_ingredients VALUES ('rec_1', 'prod_latte', 'inv_beans', 10, 'g', 'sadec');
      INSERT INTO inventory_transactions VALUES ('itx_parent_1', 'inv_beans', 'order', -20, 500, 'order', 'ord_parent_1', 'Order #ord_parent_1: 2xprod_latte', 'pos', 'sadec');
      INSERT INTO customers VALUES ('cust_cb_1', '0901112222', 0, 'sadec');
      INSERT INTO orders VALUES ('ord_parent_1', '[{"id":"prod_latte","product_id":"prod_latte","name":"Latte","quantity":2,"price":45000}]', 90000, 0, 0, 85000, 'pending', 'Parent', '0901112222', 'cust_cb_1', NULL, NULL, 'cod', 'unpaid', NULL, NULL, 5000, 'R1', NULL, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z', 'sadec');
      INSERT INTO orders VALUES ('ord_paid_completed', '[{"id":"prod_latte","product_id":"prod_latte","name":"Latte","quantity":1,"price":45000}]', 45000, 0, 0, 45000, 'confirmed', 'PaidGuest', '0909998888', NULL, NULL, NULL, 'payos', 'completed', NULL, NULL, 0, 'R1', NULL, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z', 'sadec');
    `);
    const db = createSqliteD1(sqlite);
    const kvPut = vi.fn(async () => {});
    const kvDel = vi.fn(async () => {});
    const broadcastSpy = vi.fn(async () => {});
    const env = {
      AURA_DB: db,
      AUTH_KV: { get: vi.fn(async () => null), put: kvPut, delete: kvDel },
      ORDER_BROADCASTER: { idFromName: (n: string) => n, get: () => ({ broadcast: broadcastSpy }) },
    } as unknown as Record<string, unknown>;

    const makeSplitReq = (parentId: string, idemKey: string) =>
      new Request('https://aura.test/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
        body: JSON.stringify({
          parent_order_id: parentId,
          table_id: 'R1',
          orders: [
            { customer_name: 'Child A', customer_phone: '0901112223', payment_method: 'cod', items: [{ product_id: 'prod_latte', name: 'Latte', quantity: 1, price: 45000 }] },
            { customer_name: 'Child B', customer_phone: '0901112224', payment_method: 'cod', items: [{ product_id: 'prod_latte', name: 'Latte', quantity: 1, price: 45000 }] },
          ],
        }),
      });

    const actor = { id: 'cashier_1', role: 'cashier', tenantId: 'sadec' };
    const paidSplitRes = await splitOrders(makeSplitReq('ord_paid_completed', 'idem_paid_comp'), env, undefined, actor);
    expect(paidSplitRes.status).toBe(409);

    const firstRes = await splitOrders(makeSplitReq('ord_parent_1', 'idem_split_1'), env, undefined, actor);
    expect(firstRes.status).toBe(201);
    const secondRes = await splitOrders(makeSplitReq('ord_parent_1', 'idem_split_2'), env, undefined, actor);
    expect(secondRes.status).toBe(409);

    const beansAfter = sqlite.prepare('SELECT quantity FROM inventory_items WHERE id = ?').get('inv_beans') as { quantity: number };
    expect(beansAfter.quantity).toBe(80);
    const custAfter = sqlite.prepare('SELECT cashback_balance FROM customers WHERE id = ?').get('cust_cb_1') as { cashback_balance: number };
    expect(custAfter.cashback_balance).toBe(5000);
    const tblAfter = sqlite.prepare('SELECT status FROM cafe_tables WHERE id = ?').get('tbl_r1') as { status: string };
    expect(tblAfter.status).toBe('Occupied');
    expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_parent_1', status: 'cancelled' }));
  });

  it('settles manual refund on completed orders, broadcasts realtime/KV updates, and claws back tenant-scoped vouchers across redemptions and user_rewards', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_status TEXT, total INTEGER, points_earned INTEGER DEFAULT 0, cashback_earned REAL DEFAULT 0, customer_id TEXT, guest_token_hash TEXT, updated_at TEXT, tenant_id TEXT);
      CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount INTEGER, status TEXT, transaction_id TEXT, refund_status TEXT, refund_amount INTEGER, refund_reason TEXT, refunded_at TEXT, updated_at TEXT);
      CREATE TABLE customers (id TEXT PRIMARY KEY, loyalty_points INTEGER, lifetime_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'member', total_spent INTEGER, tier TEXT, updated_at TEXT, tenant_id TEXT);
      CREATE TABLE loyalty_settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE loyalty_point_logs (id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, points_change INTEGER, reason TEXT, balance_after INTEGER, description TEXT, created_at TEXT, tenant_id TEXT);
      CREATE TABLE loyalty_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT, action TEXT, amount_vnd INTEGER, order_id TEXT, metadata TEXT, created_at TEXT, tenant_id TEXT);
      CREATE TABLE loyalty_redemptions (id TEXT PRIMARY KEY, customer_id TEXT, points_spent INTEGER, code TEXT, voucher_code TEXT, status TEXT, used_at TEXT, redeemed_at TEXT, created_at TEXT, tenant_id TEXT);
      CREATE TABLE user_rewards (id TEXT PRIMARY KEY, customer_id TEXT, code TEXT, status TEXT, tenant_id TEXT);
      CREATE TABLE audit_logs (actor_id TEXT, actor_name TEXT, user_id TEXT, action TEXT, resource_type TEXT, resource_id TEXT, details TEXT, metadata TEXT, tenant_id TEXT, created_at TEXT);
      INSERT INTO orders VALUES ('ord_ref_1', 'completed', 'completed', 100000, 100, 0, 'cust_loy_1', NULL, '2026-11-17T00:00:00Z', 'sadec');
      INSERT INTO payments VALUES ('pay_ref_1', 'ord_ref_1', 'payos', 100000, 'completed', '99887766', NULL, 0, NULL, NULL, '2026-11-17T00:00:00Z');
      INSERT INTO customers VALUES ('cust_loy_1', 0, 100, 'member', 100000, 'member', '2026-11-17T00:00:00Z', 'sadec');
      INSERT INTO loyalty_point_logs VALUES ('lpl_acc_1', 'cust_loy_1', 'ord_ref_1', 100, 'accrual', 100, 'Accrual', '2026-11-17T00:00:00Z', 'sadec');
      INSERT INTO loyalty_redemptions VALUES ('red_sadec', 'cust_loy_1', 100, 'VCH-SADEC', 'VCH-SADEC', 'active', NULL, '2026-11-17T01:00:00Z', '2026-11-17T01:00:00Z', 'sadec');
      INSERT INTO loyalty_redemptions VALUES ('red_other', 'cust_loy_1', 100, 'VCH-OTHER', 'VCH-OTHER', 'active', NULL, '2026-11-17T02:00:00Z', '2026-11-17T02:00:00Z', 'caolanh');
      INSERT INTO user_rewards VALUES ('rew_sadec', 'cust_loy_1', 'VCH-SADEC', 'active', 'sadec');
      INSERT INTO user_rewards VALUES ('rew_other', 'cust_loy_1', 'VCH-OTHER', 'active', 'caolanh');
    `);
    const db = createSqliteD1(sqlite);
    const kvDel = vi.fn(async () => {});
    const kvPut = vi.fn(async () => {});
    const broadcastSpy = vi.fn(async () => {});
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'mgr_1', role: 'manager', tenantId: 'sadec' } as never);
      c.set('tenantId' as never, 'sadec' as never);
      await next();
    });
    app.post('/refund', (c) => handleRefund(c));

    const res = await app.request('/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: 'pay_ref_1', manual_transfer_ref: 'VCB-991122', reason: 'Duplicate charge' }),
    }, {
      AURA_DB: db,
      AUTH_KV: { get: vi.fn(async () => null), put: kvPut, delete: kvDel },
      ORDER_BROADCASTER: { idFromName: (n: string) => n, get: () => ({ broadcast: broadcastSpy }) },
    } as unknown as Env);

    expect(res.status).toBe(200);
    const ordRow = sqlite.prepare('SELECT payment_status FROM orders WHERE id = ?').get('ord_ref_1') as { payment_status: string };
    expect(ordRow.payment_status).toBe('refunded');
    expect(kvDel).toHaveBeenCalledWith('orders:active:sadec');
    expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_ref_1', payment_status: 'refunded' }));
    expect((sqlite.prepare('SELECT status FROM loyalty_redemptions WHERE id = ?').get('red_sadec') as { status: string }).status).toBe('revoked');
    expect((sqlite.prepare('SELECT status FROM user_rewards WHERE id = ?').get('rew_sadec') as { status: string }).status).toBe('revoked');
    expect((sqlite.prepare('SELECT status FROM loyalty_redemptions WHERE id = ?').get('red_other') as { status: string }).status).toBe('active');
    expect((sqlite.prepare('SELECT status FROM user_rewards WHERE id = ?').get('rew_other') as { status: string }).status).toBe('active');
  });

  it('enforces shift sale deduplication + close CAS and excludes canceled/rejected/QR-placeholder orders from stats and summary', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const nowIso = new Date().toISOString();
    sqlite.exec(`
      CREATE TABLE staff_shifts (id TEXT PRIMARY KEY, staff_id TEXT, staff_name TEXT, role TEXT, operating_unit_id TEXT, status TEXT, clock_in TEXT, clock_out TEXT, opening_cash INTEGER DEFAULT 0, cash_sales INTEGER DEFAULT 0, online_sales INTEGER DEFAULT 0, total_sales INTEGER DEFAULT 0, order_count INTEGER DEFAULT 0, expected_cash INTEGER, actual_cash INTEGER, cash_variance INTEGER, notes TEXT, created_at TEXT, updated_at TEXT, tenant_id TEXT);
      CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT, tenant_id TEXT, created_at TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_status TEXT, payment_method TEXT, items TEXT, total INTEGER, notes TEXT, customer_phone TEXT, created_at TEXT, tenant_id TEXT);
    `);
    sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?)').run('ord_ok', 'completed', 'paid', 'cod', '[{"name":"Latte","quantity":1}]', 50000, NULL_VAL(), '0903334444', nowIso, 'sadec');
    sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?)').run('ord_single_l', 'canceled', 'unpaid', 'cod', '[{"name":"Latte","quantity":1}]', 90000, NULL_VAL(), '0903334445', nowIso, 'sadec');
    sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?)').run('ord_rej', 'rejected', 'unpaid', 'cod', '[{"name":"Latte","quantity":1}]', 80000, NULL_VAL(), '0903334446', nowIso, 'sadec');
    sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?)').run('ord_qr_ph', 'pending', 'unpaid', 'cod', '[]', 0, 'Khách QR - cho don mon', '', nowIso, 'sadec');

    const db = createSqliteD1(sqlite);
    const opened = await openCanonicalShift(db, { staffId: 'st_1', staffName: 'Cashier', role: 'cashier', openingCash: 100000, tenantId: 'sadec' });
    expect(opened.ok).toBe(true);
    const shiftId = opened.ok ? opened.shift.id : '';

    const s1 = await recordShiftSale(db, { shiftId, orderId: 'ord_ok', amount: 50000, paymentMethod: 'cash', tenantId: 'sadec' });
    const s2 = await recordShiftSale(db, { shiftId, orderId: 'ord_ok', amount: 50000, paymentMethod: 'cash', tenantId: 'sadec' });
    expect(s1).toEqual({ ok: true, alreadyRecorded: false });
    expect(s2).toEqual({ ok: true, alreadyRecorded: true });

    const c1 = await closeCanonicalShift(db, { shiftId, closedByStaffId: 'st_1', closedByRole: 'cashier', actualCash: 150000, tenantId: 'sadec' });
    const c2 = await closeCanonicalShift(db, { shiftId, closedByStaffId: 'st_1', closedByRole: 'cashier', actualCash: 150000, tenantId: 'sadec' });
    const lateSale = await recordShiftSale(db, { shiftId, orderId: 'ord_late', amount: 20000, paymentMethod: 'cash', tenantId: 'sadec' });
    expect(c1.ok).toBe(true);
    expect(c2).toEqual({ ok: false, error: 'shift_already_closed' });
    expect(lateSale).toEqual({ ok: false, error: 'closed_shift_immutable' });

    const statsRes = await getStats(new Request('https://aura.test/api/orders/stats'), { AURA_DB: db }, 'sadec');
    const statsJson = (await statsRes.json()) as { stats: { orders_today: number; revenue_today: number; orders_by_status: Record<string, number> } };
    expect(statsJson.stats.orders_today).toBe(1);
    expect(statsJson.stats.revenue_today).toBe(50000);
    expect(statsJson.stats.orders_by_status.pending).toBeUndefined();

    const summary = await getSummary(db, 7, 'sadec');
    expect(summary.total_orders).toBe(1);
    expect(summary.total_revenue).toBe(50000);
    expect(summary.avg_order_value).toBe(50000);
  });
});

function NULL_VAL(): null {
  return null;
}
