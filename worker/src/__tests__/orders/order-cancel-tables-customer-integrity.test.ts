// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { updateOrder } from '../../../../packages/domain/order/commands/update-order';
import { getAdminOrders } from '../../../../packages/domain/order/queries/admin-orders';
import { handleCancelOrder } from '../../routes/openapi-orders-handlers/order-cancel-handlers';
import { executeKdsStatusTransition } from '../../../../packages/domain/kitchen/commands/kds-status-transition';
import { tablesRouter } from '../../../../packages/domain/table/commands/tables';
import { posCustomerRouter } from '../../routes/pos-customer';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import { getAdminCustomers } from '../../routes/admin-handlers';
import { issueStaffSession } from '../../lib/staff-session';
import type { Env } from '../../types/env';

const TEST_JWT_SECRET = 'test-jwt-secret-min-32-characters-long-12345';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const db = {
    prepare(sql: string) {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async first<T = unknown>() {
          return (sqlite.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
        },
        async all<T = unknown>() {
          return { results: sqlite.prepare(sql).all(...(binds as never[])) as T[], success: true, meta: {} };
        },
        async run() {
          const info = sqlite.prepare(sql).run(...(binds as never[]));
          return {
            success: true,
            changes: Number(info.changes),
            meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
          };
        },
      };
      return stmt;
    },
    async batch(stmts: Array<{ run?: () => Promise<unknown>; first?: () => Promise<unknown> }>) {
      const results = [];
      sqlite.exec('BEGIN');
      try {
        for (const s of stmts) {
          if (typeof s.run === 'function') results.push(await s.run());
        }
        sqlite.exec('COMMIT');
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
      return results;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
  return db as unknown as D1Database;
}

function createCoreSchema(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      phone TEXT,
      role TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      loyalty_tier TEXT DEFAULT 'bronze',
      loyalty_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category_id TEXT,
      is_available INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category_id TEXT,
      is_available INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      customer_address TEXT,
      table_id TEXT,
      items TEXT DEFAULT '[]',
      subtotal INTEGER DEFAULT 0,
      shipping_fee INTEGER DEFAULT 0,
      discount INTEGER DEFAULT 0,
      service_fee INTEGER DEFAULT 0,
      tip_amount INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      total_amount INTEGER DEFAULT 0,
      cashback_used INTEGER DEFAULT 0,
      loyalty_points_redeemed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'cash',
      payment_status TEXT DEFAULT 'pending',
      order_type TEXT DEFAULT 'takeaway',
      source TEXT DEFAULT 'pos',
      notes TEXT,
      delivery_time TEXT,
      guest_session_id TEXT,
      guest_token_hash TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      subtotal INTEGER NOT NULL,
      modifiers TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT,
      notes TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      method TEXT,
      amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      refund_status TEXT,
      refund_amount INTEGER DEFAULT 0,
      transaction_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cashback_wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      order_id TEXT,
      description TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE rewards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      point_cost INTEGER NOT NULL DEFAULT 100,
      discount_type TEXT DEFAULT 'fixed',
      discount_value INTEGER NOT NULL DEFAULT 0,
      min_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE user_rewards (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      reward_id TEXT NOT NULL,
      code TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      expires_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE loyalty_redemptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      reward_id TEXT,
      code TEXT,
      voucher_code TEXT,
      points_spent INTEGER DEFAULT 0,
      order_id TEXT,
      status TEXT DEFAULT 'active',
      used_at TEXT,
      expires_at TEXT,
      redeemed_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE loyalty_rewards (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT DEFAULT 'fixed',
      value REAL DEFAULT 0,
      reward_type TEXT DEFAULT 'discount',
      reward_value INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE cafe_tables (
      id TEXT PRIMARY KEY,
      table_number TEXT NOT NULL,
      zone TEXT DEFAULT 'indoor',
      seats INTEGER DEFAULT 4,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'Available',
      current_order_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE reservations (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      guest_count INTEGER DEFAULT 2,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      zone TEXT DEFAULT 'Indoor',
      status TEXT DEFAULT 'confirmed',
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

describe('Order cancel financial integrity, live tables router, and customer/order query regressions', () => {
  const dbs: DatabaseSync[] = [];

  afterEach(() => {
    while (dbs.length) dbs.pop()?.close();
  });

  it('persists orders.cashback_used, refunds positive cashback with balance_after, restores user_rewards voucher on cancel, and blocks cross-customer voucher use by staff', async () => {
    const sqlite = new DatabaseSync(':memory:');
    dbs.push(sqlite);
    createCoreSchema(sqlite);
    const db = createSqliteD1(sqlite);

    sqlite.exec(`
      INSERT INTO users (id, email, name, phone, role, tenant_id)
      VALUES ('staff-1', 'staff@aura.vn', 'Staff 1', '0909000001', 'cashier', 'default');
      INSERT INTO customers (id, name, phone, email, loyalty_tier, loyalty_points, tenant_id)
      VALUES
        ('cust-a', 'Khách A', '0901111111', 'a@aura.vn', 'gold', 500, 'default'),
        ('cust-b', 'Khách B', '0902222222', 'b@aura.vn', 'bronze', 100, 'default');
      INSERT INTO products (id, name, price, category_id, is_available, tenant_id)
      VALUES ('item-1', 'Cà phê sữa đá', 50000, 'coffee', 1, 'default');
      INSERT INTO menu_items (id, name, price, category_id, is_available, tenant_id)
      VALUES ('item-1', 'Cà phê sữa đá', 50000, 'coffee', 1, 'default');
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal-a', 'cust-a', 30000, 30000, 0, 'default');
      INSERT INTO rewards (id, title, point_cost, discount_type, discount_value, min_order, tenant_id)
      VALUES ('rew-1', 'Giảm 15k', 150, 'fixed', 15000, 0, 'default');
      INSERT INTO user_rewards (id, customer_id, reward_id, code, status, tenant_id)
      VALUES ('ur-a-1', 'cust-a', 'rew-1', 'LOYAL-A-15K', 'active', 'default');
    `);

    const staffSession = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'staff-1', name: 'Staff 1', phone: '0909000001', role: 'cashier', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { email: 'staff@aura.vn', sessionType: 'staff-web' },
    );
    const env = { AURA_DB: db, DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Record<string, unknown>;

    // 1. Staff creating order for Customer B MUST NOT be allowed to redeem Customer A's voucher
    const hijackRes = await createOrder(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffSession.token}`,
        },
        body: JSON.stringify({
          items: [{ id: 'item-1', name: 'Cà phê sữa đá', price: 50000, quantity: 1 }],
          total: 50000,
          customer_id: 'cust-b',
          customer_name: 'Khách B',
          customer_phone: '0902222222',
          promo_code: 'LOYAL-A-15K',
          payment_method: 'cod',
          order_type: 'takeaway',
        }),
      }),
      env,
      undefined,
    );
    expect(hijackRes.status).toBe(400);
    const hijackJson = (await hijackRes.json()) as { error?: string; message?: string };
    expect(String(hijackJson.error ?? hijackJson.message ?? '')).toMatch(/không thuộc tài khoản/i);

    // 2. Staff creating order for Customer A with cashback (10,000) + Customer A's voucher (15,000) succeeds
    const createRes = await createOrder(
      new Request('https://test.aura/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffSession.token}`,
        },
        body: JSON.stringify({
          items: [{ id: 'item-1', name: 'Cà phê sữa đá', price: 50000, quantity: 1 }],
          total: 25000,
          customer_id: 'cust-a',
          customer_name: 'Khách A',
          customer_phone: '0901111111',
          use_cashback: true,
          cashback_amount: 10000,
          promo_code: 'LOYAL-A-15K',
          payment_method: 'cod',
          order_type: 'takeaway',
        }),
      }),
      env,
      undefined,
    );
    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as { id?: string; data?: { id?: string }; order?: { id: string } };
    const orderId = createJson.data?.id || createJson.id || createJson.order?.id || '';
    expect(orderId).toBeTruthy();

    // Verify cashback_used persisted on orders, wallet debited to 20,000, voucher marked used
    const orderRow = sqlite.prepare('SELECT cashback_used, total, discount FROM orders WHERE id = ?').get(orderId) as {
      cashback_used: number;
      total: number;
      discount: number;
    };
    expect(orderRow.cashback_used).toBe(10000);
    expect(orderRow.discount).toBe(25000);
    expect(orderRow.total).toBe(25000);
    const walletAfterCreate = sqlite.prepare("SELECT balance, total_spent FROM cashback_wallets WHERE id = 'wal-a'").get() as { balance: number; total_spent: number };
    expect(walletAfterCreate.balance).toBe(20000);
    expect(walletAfterCreate.total_spent).toBe(10000);
    const urAfterCreate = sqlite.prepare("SELECT status FROM user_rewards WHERE id = 'ur-a-1'").get() as { status: string };
    expect(urAfterCreate.status).toBe('used');

    // 3. Cancelling via updateOrder refunds +10,000 (not -10,000), writes balance_after=30000, and restores user_rewards to active
    const cancelRes = await updateOrder(
      new Request(`https://test.aura/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      }),
      env,
      orderId,
      'cashier',
      'default',
    );
    expect(cancelRes.status).toBe(200);

    const walletAfterCancel = sqlite.prepare("SELECT balance, total_spent FROM cashback_wallets WHERE id = 'wal-a'").get() as { balance: number; total_spent: number };
    expect(walletAfterCancel.balance).toBe(30000);
    expect(walletAfterCancel.total_spent).toBe(0);

    const refundTx = sqlite
      .prepare("SELECT amount, balance_after FROM cashback_transactions WHERE order_id = ? AND type = 'refund'")
      .get(orderId) as { amount: number; balance_after: number } | undefined;
    expect(refundTx).toEqual({ amount: 10000, balance_after: 30000 });

    const urAfterCancel = sqlite.prepare("SELECT status FROM user_rewards WHERE id = 'ur-a-1'").get() as { status: string };
    expect(urAfterCancel.status).toBe('active');
  });

  it('OpenAPI cancel handler and KDS cancel transition both refund positive cashback with balance_after and restore loyalty vouchers', async () => {
    const sqlite = new DatabaseSync(':memory:');
    dbs.push(sqlite);
    createCoreSchema(sqlite);
    const db = createSqliteD1(sqlite);

    sqlite.exec(`
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES
        ('wal-oa', 'cust-oa', 15000, 30000, 15000, 'default'),
        ('wal-kds', 'cust-kds', 10000, 20000, 10000, 'default');
      INSERT INTO orders (id, customer_id, total, total_amount, cashback_used, status, payment_status, tenant_id)
      VALUES
        ('ord-oa', 'cust-oa', 35000, 35000, 15000, 'pending', 'pending', 'default'),
        ('ord-kds', 'cust-kds', 40000, 40000, 10000, 'pending', 'pending', 'default');
      INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, order_id, tenant_id)
      VALUES
        ('tx-oa-spend', 'wal-oa', 'cust-oa', 'spend', -15000, 15000, 'ord-oa', 'default'),
        ('tx-kds-spend', 'wal-kds', 'cust-kds', 'spend', -10000, 10000, 'ord-kds', 'default');
      INSERT INTO loyalty_redemptions (id, customer_id, code, voucher_code, order_id, status, tenant_id)
      VALUES
        ('lr-oa', 'cust-oa', 'V-OA-1', 'V-OA-1', 'ord-oa', 'used', 'default'),
        ('lr-kds', 'cust-kds', 'V-KDS-1', 'V-KDS-1', 'ord-kds', 'used', 'default');
    `);

    // OpenAPI cancel handler
    const app = new Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'default' });
      c.set('tenantId', 'default');
      await next();
    });
    app.post('/orders/:id/cancel', handleCancelOrder as never);

    const oaRes = await app.request(
      '/orders/ord-oa/cancel',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Customer changed mind' }) },
      { AURA_DB: db, DB: db } as unknown as Env,
    );
    expect(oaRes.status).toBe(200);

    const oaWallet = sqlite.prepare("SELECT balance, total_spent FROM cashback_wallets WHERE id = 'wal-oa'").get() as { balance: number; total_spent: number };
    expect(oaWallet).toEqual({ balance: 30000, total_spent: 0 });
    const oaRefundTx = sqlite.prepare("SELECT amount, balance_after FROM cashback_transactions WHERE order_id = 'ord-oa' AND type = 'refund'").get() as { amount: number; balance_after: number };
    expect(oaRefundTx).toEqual({ amount: 15000, balance_after: 30000 });
    const oaVoucher = sqlite.prepare("SELECT status, order_id FROM loyalty_redemptions WHERE id = 'lr-oa'").get() as { status: string; order_id: string | null };
    expect(oaVoucher).toEqual({ status: 'active', order_id: null });

    // KDS cancel transition
    const kdsRes = await executeKdsStatusTransition(
      db as never,
      'ord-kds',
      'cancelled',
      'manager',
      { tenantId: 'default' },
    );
    expect(kdsRes.success).toBe(true);

    const kdsWallet = sqlite.prepare("SELECT balance, total_spent FROM cashback_wallets WHERE id = 'wal-kds'").get() as { balance: number; total_spent: number };
    expect(kdsWallet).toEqual({ balance: 20000, total_spent: 0 });
    const kdsRefundTx = sqlite.prepare("SELECT amount, balance_after FROM cashback_transactions WHERE order_id = 'ord-kds' AND type = 'refund'").get() as { amount: number; balance_after: number };
    expect(kdsRefundTx).toEqual({ amount: 10000, balance_after: 20000 });
    const kdsVoucher = sqlite.prepare("SELECT status, order_id FROM loyalty_redemptions WHERE id = 'lr-kds'").get() as { status: string; order_id: string | null };
    expect(kdsVoucher).toEqual({ status: 'active', order_id: null });
  });

  it('live tablesRouter auto-releases stale reserved tables, blocks PATCH/DELETE with unpaid order, allows failed payment release, and fails closed on DB error', async () => {
    const sqlite = new DatabaseSync(':memory:');
    dbs.push(sqlite);
    createCoreSchema(sqlite);
    const db = createSqliteD1(sqlite);

    sqlite.exec(`
      INSERT INTO users (id, email, name, phone, role, tenant_id)
      VALUES ('mgr-1', 'mgr@aura.vn', 'Manager', '0909000010', 'manager', 'default');
      INSERT INTO cafe_tables (id, table_number, status, tenant_id)
      VALUES
        ('tbl-stale', 'T01', 'Reserved', 'default'),
        ('tbl-unpaid', 'T02', 'Occupied', 'default'),
        ('tbl-failed', 'T03', 'Occupied', 'default');
      INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, zone, status, tenant_id)
      VALUES ('res-old', 'tbl-stale', 'Old Guest', '0901000000', '2026-01-01', '08:00', 'Indoor', 'confirmed', 'default');
      INSERT INTO orders (id, table_id, total, status, payment_status, tenant_id)
      VALUES
        ('ord-unpaid', 'tbl-unpaid', 60000, 'preparing', 'pending', 'default'),
        ('ord-failed', 'tbl-failed', 45000, 'pending', 'failed', 'default');
    `);

    const mgrSession = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'mgr-1', name: 'Manager', phone: '0909000010', role: 'manager', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { email: 'mgr@aura.vn', sessionType: 'staff-web' },
    );

    const app = new Hono<{ Bindings: Env; Variables: { tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('tenantId', 'default');
      await next();
    });
    app.route('/api/tables', tablesRouter);

    const env = { AURA_DB: db, DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;
    const headers = { Authorization: `Bearer ${mgrSession.token}`, 'Content-Type': 'application/json' };

    // 1. GET /api/tables auto-releases stale reserved table T01
    const listRes = await app.request('/api/tables', { method: 'GET', headers }, env);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<{ id: string; status: string }> };
    expect(listBody.data.find((t) => t.id === 'tbl-stale')?.status).toBe('Available');

    // 2. PATCH /api/tables/tbl-unpaid -> available is blocked (409)
    const blockPatch = await app.request(
      '/api/tables/tbl-unpaid',
      { method: 'PATCH', headers, body: JSON.stringify({ status: 'Available' }) },
      env,
    );
    expect(blockPatch.status).toBe(409);

    // 3. DELETE /api/tables/tbl-unpaid is ALSO blocked (409)
    const blockDelete = await app.request('/api/tables/tbl-unpaid', { method: 'DELETE', headers }, env);
    expect(blockDelete.status).toBe(409);

    // 4. PATCH /api/tables/tbl-failed -> Available succeeds because payment_status='failed' does not block release
    const allowPatch = await app.request(
      '/api/tables/tbl-failed',
      { method: 'PATCH', headers, body: JSON.stringify({ status: 'Available' }) },
      env,
    );
    expect(allowPatch.status).toBe(200);

    // 5. Fail-closed: if the orders check throws an unexpected DB error, PATCH must return 409 (not silently allow)
    const faultyDb = {
      ...db,
      prepare(sql: string) {
        if (/FROM orders\s+WHERE\s+table_id = \?/i.test(sql)) {
          return {
            bind() {
              return {
                async all() {
                  throw new Error('SQLITE_BUSY: database is locked');
                },
                async first() {
                  throw new Error('SQLITE_BUSY: database is locked');
                },
              };
            },
          };
        }
        return db.prepare(sql);
      },
    } as unknown as D1Database;
    const failClosedPatch = await app.request(
      '/api/tables/tbl-failed',
      { method: 'PATCH', headers, body: JSON.stringify({ status: 'Available' }) },
      { AURA_DB: faultyDb, DB: faultyDb, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env,
    );
    expect(failClosedPatch.status).toBe(409);
  });

  it('admin-orders dateTo filters ISO-8601 timestamps accurately in ICT and customer total_spent stays consistent across POS search, POS phone, admin customers, and admin loyalty', async () => {
    const sqlite = new DatabaseSync(':memory:');
    dbs.push(sqlite);
    createCoreSchema(sqlite);
    const db = createSqliteD1(sqlite);

    sqlite.exec(`
      INSERT INTO users (id, email, name, phone, role, tenant_id)
      VALUES ('mgr-2', 'mgr2@aura.vn', 'Manager 2', '0909000020', 'manager', 'default');
      INSERT INTO customers (id, name, phone, email, loyalty_tier, loyalty_points, tenant_id)
      VALUES ('cust-walk', 'Nguyễn Minh', '0908888888', 'minh@aura.vn', 'silver', 120, 'default');
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal-walk', 'cust-walk', 5000, 15000, 10000, 'default');
      INSERT INTO orders (id, customer_id, customer_phone, total, total_amount, status, payment_status, tenant_id, created_at)
      VALUES
        ('ord-id-1', 'cust-walk', '0908888888', 120000, 120000, 'completed', 'paid', 'default', '2026-11-23T08:00:00.000Z'),
        ('ord-phone-only', NULL, '0908888888', 80000, 80000, 'completed', 'paid', 'default', '2026-11-22T18:30:00.000Z'),
        ('ord-cancelled', 'cust-walk', '0908888888', 500000, 500000, 'cancelled', 'pending', 'default', '2026-11-23T09:00:00.000Z'),
        ('ord-failed-pay', 'cust-walk', '0908888888', 300000, 300000, 'pending', 'failed', 'default', '2026-11-23T10:00:00.000Z');
    `);

    const mgrSession = await issueStaffSession(
      { JWT_SECRET: TEST_JWT_SECRET },
      { id: 'mgr-2', name: 'Manager 2', phone: '0909000020', role: 'manager', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { email: 'mgr2@aura.vn', sessionType: 'staff-web' },
    );
    const env = { AURA_DB: db, DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;
    const headers = { Authorization: `Bearer ${mgrSession.token}` };

    // 1. admin-orders dateFrom/dateTo with YYYY-MM-DD includes BOTH:
    //    - 2026-11-23T08:00:00.000Z (15:00 ICT on 2026-11-23)
    //    - 2026-11-22T18:30:00.000Z (01:30 ICT on 2026-11-23)
    const adminOrdersRes = await getAdminOrders(
      new Request('https://test.aura/api/admin/orders?dateFrom=2026-11-23&dateTo=2026-11-23'),
      env as unknown as Record<string, unknown>,
      'default',
    );
    expect(adminOrdersRes.status).toBe(200);
    const adminOrdersJson = (await adminOrdersRes.json()) as { orders: Array<{ id: string }>; pagination: { total: number } };
    expect(adminOrdersJson.pagination.total).toBe(4);
    expect(adminOrdersJson.orders.map((o) => o.id).sort()).toEqual([
      'ord-cancelled',
      'ord-failed-pay',
      'ord-id-1',
      'ord-phone-only',
    ]);

    // 2. Customer spend consistency (expected: 120000 + 80000 = 200000, 2 visits; excludes cancelled/failed AND ignores cashback_wallets.total_spent=10000)
    const app = new Hono<{ Bindings: Env; Variables: { tenantId: string } }>();
    app.use('*', async (c, next) => {
      c.set('tenantId', 'default');
      await next();
    });
    app.route('/api/pos/customer', posCustomerRouter);
    app.route('/api/admin-loyalty', adminLoyaltyRouter);

    const posPhoneRes = await app.request('/api/pos/customer?phone=0908888888', { headers }, env);
    expect(posPhoneRes.status).toBe(200);
    const posPhoneJson = (await posPhoneRes.json()) as { customer: { total_spent: number; visit_count: number } };
    expect(posPhoneJson.customer.total_spent).toBe(200000);
    expect(posPhoneJson.customer.visit_count).toBe(2);

    const posSearchRes = await app.request('/api/pos/customer?q=Minh', { headers }, env);
    expect(posSearchRes.status).toBe(200);
    const posSearchJson = (await posSearchRes.json()) as { customers: Array<{ total_spent: number; visit_count: number }> };
    expect(posSearchJson.customers[0].total_spent).toBe(200000);
    expect(posSearchJson.customers[0].visit_count).toBe(2);

    const adminCustRes = await getAdminCustomers(
      new Request('https://test.aura/api/admin/customers'),
      env as unknown as Record<string, unknown>,
      'default',
    );
    expect(adminCustRes.status).toBe(200);
    const adminCustJson = (await adminCustRes.json()) as { customers: Array<{ total_spent: number; visit_count: number }> };
    expect(adminCustJson.customers[0].total_spent).toBe(200000);
    expect(adminCustJson.customers[0].visit_count).toBe(2);

    const widgetsRes = await app.request('/api/admin-loyalty/widgets', { headers }, env);
    expect(widgetsRes.status).toBe(200);
    const widgetsJson = (await widgetsRes.json()) as { data: Array<{ title: string; value: number | string }> };
    expect(widgetsJson.data.find((w) => w.title === 'Total Spend')?.value).toBe(200000);

    const topRes = await app.request('/api/admin-loyalty/top-customers', { headers }, env);
    expect(topRes.status).toBe(200);
    const topJson = (await topRes.json()) as { data: Array<{ total_spent: number; visit_count: number }> };
    expect(topJson.data[0].total_spent).toBe(200000);
    expect(topJson.data[0].visit_count).toBe(2);

    const exportRes = await app.request('/api/admin-loyalty/export', { headers }, env);
    expect(exportRes.status).toBe(200);
    const csv = await exportRes.text();
    expect(csv).toContain(',5000,200000,2,');
  });
});
