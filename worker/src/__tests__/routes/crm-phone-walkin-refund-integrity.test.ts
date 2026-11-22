// @vitest-environment node
/**
 * Real-SQLite regression tests for:
 * - #99: Unified phone canonicalization (+84 <-> 0) across QR/capture and POS lookup
 * - #98: Anonymous POS walk-in representation (no 0900000000 sentinel aggregation)
 * - #97: Guest order refund loyalty reversal resolved from original accrual ledger
 */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { reverseRefundTranche } from '../../../../packages/domain/crm/commands/refund-tranche';
import { loadPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';
import { canonicalPhone } from '../../../../packages/domain/customer/phone';
import { runPostOrderSideEffects } from '../../../../packages/domain/order/commands/create-order-side-effects';
import { creditLoyaltyIfEligible } from '../../../../packages/domain/order/policies/loyalty-trigger';
import { posCustomerRouter } from '../../routes/pos-customer';
import { handleRefund } from '../../routes/refunds-handlers/mutation-handlers';
import { generateJWT } from '../../lib/jwt';
import { normalizePhone } from '../../../../src/pages/TableOrder-utils';
import type { Env } from '../../types/env';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const runners = new WeakMap<object, () => unknown>();
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const run = () => {
      const info = sqlite.prepare(sql).run(...(params as never[]));
      return { success: true, meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) } };
    };
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        return col ? ((row[col] as T) ?? null) : (row as unknown as T);
      },
      async all<T = Record<string, unknown>>() {
        return { results: sqlite.prepare(sql).all(...(params as never[])) as unknown as T[], success: true };
      },
      async run() { return run(); },
    };
    runners.set(stmt, run);
    return stmt;
  };
  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec('BEGIN');
      try {
        const results: unknown[] = [];
        for (const s of stmts) {
          const run = runners.get(s);
          if (!run) throw new Error('Unknown D1 statement');
          results.push(run());
        }
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  } as unknown as D1Database;
}

function createCrmSqlite(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      role TEXT,
      tenant_id TEXT,
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1
    );
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      phone TEXT,
      loyalty_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      loyalty_tier TEXT DEFAULT 'bronze',
      cashback_balance REAL DEFAULT 0,
      source TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cashback_wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      balance REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT,
      customer_id TEXT,
      order_id TEXT,
      type TEXT,
      amount REAL,
      balance_after REAL,
      multiplier_applied REAL DEFAULT 1.0,
      campaign_id TEXT,
      expires_at TEXT,
      description TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      total INTEGER,
      total_amount INTEGER,
      status TEXT DEFAULT 'confirmed',
      payment_method TEXT DEFAULT 'payos',
      payment_status TEXT DEFAULT 'paid',
      points_earned INTEGER DEFAULT 0,
      cashback_earned REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      transaction_id TEXT,
      refund_status TEXT,
      refund_amount INTEGER,
      refund_reason TEXT,
      refunded_at TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE loyalty_point_logs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      points_change INTEGER NOT NULL,
      reason TEXT,
      balance_after INTEGER,
      description TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE loyalty_audit_log (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      action TEXT NOT NULL,
      amount_vnd INTEGER,
      order_id TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      actor_name TEXT,
      user_id TEXT,
      action TEXT,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE loyalty_policy (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      version INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      config_json TEXT
    );
    CREATE TABLE loyalty_redemptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      points_spent INTEGER,
      code TEXT,
      voucher_code TEXT,
      status TEXT DEFAULT 'active',
      used_at TEXT,
      redeemed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE user_rewards (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      code TEXT,
      status TEXT DEFAULT 'active',
      tenant_id TEXT DEFAULT 'default'
    );
  `);
  sqlite.exec(readFileSync(new URL('../../../db/migrations/20261121_03_refund_atomicity_and_loyalty_work.sql', import.meta.url), 'utf8'));
  sqlite.exec(`CREATE TABLE loyalty_accounts (customer_id TEXT, tenant_id TEXT DEFAULT 'default', current_points INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0, tier TEXT, updated_at TEXT);
    INSERT INTO refund_tenant_readiness VALUES ('sadec', datetime('now'), 'local-test', 'fresh test database');`);
  return sqlite;
}

describe('transfer-keyed atomic loyalty reversals', () => {
  function seed(points = 5, cashback = 7, total = 100) {
    const sqlite = createCrmSqlite();
    const db = createSqliteD1(sqlite);
    sqlite.prepare(`INSERT INTO customers (id, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('member', ?, ?, 'silver', 'sadec')`).run(points, points);
    sqlite.prepare(`INSERT INTO orders (id, customer_id, total, points_earned, cashback_earned, tenant_id)
      VALUES ('order', 'member', ?, ?, ?, 'sadec')`).run(total, points, cashback);
    sqlite.prepare(`INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, tenant_id)
      VALUES ('wallet', 'member', ?, ?, 'sadec')`).run(cashback, cashback);
    sqlite.prepare(`INSERT INTO loyalty_accounts (customer_id, tenant_id, current_points, lifetime_points, tier)
      VALUES ('member', 'sadec', ?, ?, 'silver')`).run(points, points);
    const add = (key: string, amount: number) => sqlite.prepare(`INSERT INTO refund_loyalty_work
      (tenant_id, reversal_key, order_id, amount) VALUES ('sadec', ?, 'order', ?)`).run(key, amount);
    const run = async (key: string, amount: number) => reverseRefundTranche(db, await loadPolicy(db), {
      orderId: 'order', customerId: 'member', tenantId: 'sadec', reversalKey: key, refundAmountVnd: amount,
    });
    return { sqlite, db, add, run };
  }

  it('rolls back points, wallet, tier, vouchers and work on failure, then retries the same identity exactly once', async () => {
    const f = seed(10, 70);
    f.sqlite.exec(`UPDATE customers SET loyalty_points = 0;
      INSERT INTO loyalty_redemptions (id, customer_id, points_spent, code, tenant_id) VALUES ('voucher', 'member', 10, 'CODE', 'sadec');
      INSERT INTO user_rewards (id, customer_id, code, tenant_id) VALUES ('reward', 'member', 'CODE', 'sadec');
      CREATE TRIGGER reject_cashback BEFORE INSERT ON cashback_transactions BEGIN SELECT RAISE(ABORT, 'cashback unavailable'); END;`);
    f.add('BANK', 100);
    expect(await f.run('BANK', 100)).toMatchObject({ ok: false, reason: 'd1_error' });
    expect(f.sqlite.prepare('SELECT lifetime_points, loyalty_tier FROM customers').get()).toMatchObject({ lifetime_points: 10, loyalty_tier: 'silver' });
    expect(f.sqlite.prepare('SELECT balance FROM cashback_wallets').get()?.balance).toBe(70);
    expect(f.sqlite.prepare('SELECT status FROM loyalty_redemptions').get()?.status).toBe('active');
    expect(f.sqlite.prepare('SELECT status FROM refund_loyalty_work').get()?.status).toBe('pending');
    expect(f.sqlite.prepare('SELECT count(*) n FROM loyalty_point_logs').get()?.n).toBe(0);
    f.sqlite.exec('DROP TRIGGER reject_cashback');
    expect(await f.run('BANK', 100)).toMatchObject({ ok: true, pointsDeducted: 10, newLifetimePoints: 0, newTier: 'bronze' });
    expect(f.sqlite.prepare('SELECT status FROM loyalty_redemptions').get()?.status).toBe('revoked');
    expect(f.sqlite.prepare('SELECT status FROM user_rewards').get()?.status).toBe('revoked');
    expect(f.sqlite.prepare('SELECT current_points, lifetime_points, tier FROM loyalty_accounts').get()).toMatchObject({ current_points: 0, lifetime_points: 0, tier: 'bronze' });
    expect(f.sqlite.prepare('SELECT balance, total_earned FROM cashback_wallets').get()).toMatchObject({ balance: 0, total_earned: 0 });
    expect(await f.run('BANK', 100)).toMatchObject({ ok: false, reason: 'already_reversed' });
    expect(f.sqlite.prepare('SELECT count(*) n FROM cashback_transactions').get()?.n).toBe(1);
  });

  it('serializes duplicate and overlapping distinct tranches without lost balances or count-key collisions', async () => {
    const f = seed(); f.add('A', 33); f.add('B', 33); f.add('C', 34);
    const results = await Promise.all([f.run('A', 33), f.run('A', 33), f.run('B', 33)]);
    expect(results.filter(r => r.ok)).toHaveLength(2);
    expect(results.filter(r => !r.ok && r.reason === 'already_reversed')).toHaveLength(1);
    expect(f.sqlite.prepare('SELECT loyalty_points FROM customers').get()?.loyalty_points).toBe(2);
    expect(f.sqlite.prepare('SELECT balance FROM cashback_wallets').get()?.balance).toBe(2);
    expect(await f.run('C', 34)).toMatchObject({ ok: true, pointsDeducted: 2 });
    expect(f.sqlite.prepare('SELECT loyalty_points, lifetime_points FROM customers').get()).toMatchObject({ loyalty_points: 0, lifetime_points: 0 });
    expect(f.sqlite.prepare('SELECT SUM(points_reversed) points, SUM(cashback_reversed) cashback FROM refund_loyalty_work').get()).toMatchObject({ points: 5, cashback: 7 });
    expect(f.sqlite.prepare('SELECT COUNT(*) n FROM loyalty_point_logs').get()?.n).toBe(3);
  });

  it('rounds cumulative targets and caps repeated tiny tranches at the original accrual', async () => {
    const f = seed(2, 3, 10);
    for (let i = 0; i < 11; i++) {
      f.add(`tiny-${i}`, 1); expect((await f.run(`tiny-${i}`, 1)).ok).toBe(true);
      if (i === 0) expect(f.sqlite.prepare('SELECT SUM(points_reversed) n FROM refund_loyalty_work').get()?.n).toBe(0);
    }
    expect(f.sqlite.prepare('SELECT SUM(points_reversed) points, SUM(cashback_reversed) cashback FROM refund_loyalty_work').get()).toMatchObject({ points: 2, cashback: 3 });
  });

  it('does not treat unrelated unique failures as completed work or retry non-contention errors', async () => {
    const f = seed(); f.add('A', 50);
    f.sqlite.exec("CREATE UNIQUE INDEX one_point_reason ON loyalty_point_logs(reason); INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason) VALUES ('other', 'member', 0, 'refund');");
    expect(await f.run('A', 50)).toMatchObject({ ok: false, reason: 'd1_error' });
    expect(f.sqlite.prepare('SELECT status FROM refund_loyalty_work').get()?.status).toBe('pending');
    expect(f.sqlite.prepare('SELECT loyalty_points FROM customers').get()?.loyalty_points).toBe(5);
  });
});

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

describe('CRM phone normalization (#99), walk-in anonymity (#98), and guest refund loyalty reversal (#97)', () => {
  it('#99: QR checkout with +84 creates canonical 0... customer found by POS via both +84 and 0 in same tenant, isolated across tenants', async () => {
    const sqlite = createCrmSqlite();
    sqlite.exec(`
      INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version)
      VALUES ('staff_a', 'Cashier A', 'a@t1.vn', 'cashier', 'tenant_a', 1, 1);
      INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version)
      VALUES ('staff_b', 'Cashier B', 'b@t2.vn', 'cashier', 'tenant_b', 1, 1);
    `);
    const db = createSqliteD1(sqlite);

    // TableOrder utility and backend helper agree on canonical 0xxxxxxxxx
    expect(normalizePhone('+84 912-345-678')).toBe('0912345678');
    expect(canonicalPhone('84912345678')).toBe('0912345678');

    // Step 1: QR order side-effects capture customer with +84 format in tenant_a
    await runPostOrderSideEffects({
      db,
      env: { AURA_DB: db } as unknown as Env,
      orderId: 'ord_qr_1',
      data: {
        items: [{ product_id: 'p1', name: 'Latte', price: 50000, quantity: 1 }],
        total: 50000,
        customer_name: 'Khach QR',
        customer_phone: '+84 912 345 678',
        payment_method: 'cash',
      },
      snapshot: { items: [{ id: 'p1', name: 'Latte', price: 50000, quantity: 1 }], total: 50000, subtotal: 50000, discount: 0 },
      tenantId: 'tenant_a',
    } as Parameters<typeof runPostOrderSideEffects>[0]);

    // Step 2: Second order with 0... format matches the SAME customer, no duplicate
    await runPostOrderSideEffects({
      db,
      env: { AURA_DB: db } as unknown as Env,
      orderId: 'ord_qr_2',
      data: {
        items: [{ product_id: 'p1', name: 'Latte', price: 50000, quantity: 1 }],
        total: 50000,
        customer_name: 'Khach QR',
        customer_phone: '0912345678',
        payment_method: 'cash',
      },
      snapshot: { items: [{ id: 'p1', name: 'Latte', price: 50000, quantity: 1 }], total: 50000, subtotal: 50000, discount: 0 },
      tenantId: 'tenant_a',
    } as Parameters<typeof runPostOrderSideEffects>[0]);

    const customersA = sqlite.prepare(`SELECT id, phone FROM customers WHERE tenant_id = 'tenant_a'`).all() as Array<{
      id: string;
      phone: string;
    }>;
    expect(customersA).toHaveLength(1);
    expect(customersA[0].phone).toBe('0912345678');

    const walletsA = sqlite.prepare(`SELECT id FROM cashback_wallets WHERE tenant_id = 'tenant_a'`).all();
    expect(walletsA).toHaveLength(1);

    // Step 3: POS lookup in tenant_a resolves same customer for both +84 and 0
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/pos/customer', posCustomerRouter);
    const tokenA = await generateJWT(
      { id: 'staff_a', email: 'a@t1.vn', name: 'Cashier A', role: 'cashier', tenantId: 'tenant_a', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' },
      TEST_JWT_SECRET,
      28800,
    );
    const tokenB = await generateJWT(
      { id: 'staff_b', email: 'b@t2.vn', name: 'Cashier B', role: 'cashier', tenantId: 'tenant_b', authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' },
      TEST_JWT_SECRET,
      28800,
    );
    const env = { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;

    const resPlus84 = await app.fetch(
      new Request('https://test.aura/api/pos/customer?phone=%2B84912345678', {
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      env,
    );
    const bodyPlus84 = (await resPlus84.json()) as { found: boolean; customer?: { id: string } };
    expect(resPlus84.status).toBe(200);
    expect(bodyPlus84.found).toBe(true);
    expect(bodyPlus84.customer?.id).toBe(customersA[0].id);

    const resZero = await app.fetch(
      new Request('https://test.aura/api/pos/customer?phone=0912345678', {
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      env,
    );
    const bodyZero = (await resZero.json()) as { found: boolean; customer?: { id: string } };
    expect(resZero.status).toBe(200);
    expect(bodyZero.customer?.id).toBe(customersA[0].id);

    // Step 4: Tenant B cannot see Tenant A's customer
    const resOtherTenant = await app.fetch(
      new Request('https://test.aura/api/pos/customer?phone=0912345678', {
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
      env,
    );
    const bodyOtherTenant = (await resOtherTenant.json()) as { found: boolean };
    expect(resOtherTenant.status).toBe(200);
    expect(bodyOtherTenant.found).toBe(false);

    // Step 5: Ambiguous historical records in same tenant return 409 instead of silent merge
    sqlite.exec(`
      INSERT INTO customers (id, email, name, phone, tenant_id)
      VALUES ('cust_legacy_84', 'legacy@t1.vn', 'Legacy 84', '84912345678', 'tenant_a');
    `);
    const resConflict = await app.fetch(
      new Request('https://test.aura/api/pos/customer?phone=0912345678', {
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      env,
    );
    expect(resConflict.status).toBe(409);
  });

  it('#98: two anonymous POS walk-ins (empty or sentinel 0900000000) create no shared customer/wallet/rewards while real customer accrues normally', async () => {
    const sqlite = createCrmSqlite();
    const db = createSqliteD1(sqlite);

    // Real customer exists in tenant_x
    sqlite.exec(`
      INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_real_1', 'real@example.com', 'Nguyen Real', '0987654321', 0, 0, 'bronze', 'tenant_x');
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal_real_1', 'cust_real_1', 0, 0, 0, 'tenant_x');
      INSERT INTO orders (id, customer_id, customer_name, customer_phone, total, total_amount, status, payment_method, payment_status, tenant_id)
      VALUES
        ('ord_walkin_1', NULL, 'Khach vang lai', '', 60000, 60000, 'confirmed', 'cash', 'paid', 'tenant_x'),
        ('ord_walkin_2', NULL, 'Khach vang lai', '0900000000', 80000, 80000, 'confirmed', 'cash', 'paid', 'tenant_x'),
        ('ord_real_1', 'cust_real_1', 'Nguyen Real', '0987654321', 100000, 100000, 'confirmed', 'cash', 'paid', 'tenant_x');
    `);

    // Walk-in 1 (empty phone) and Walk-in 2 (legacy sentinel 0900000000)
    await runPostOrderSideEffects({
      db,
      env: { AURA_DB: db } as unknown as Env,
      orderId: 'ord_walkin_1',
      data: {
        items: [{ product_id: 'p1', name: 'Americano', price: 60000, quantity: 1 }],
        total: 60000,
        customer_name: 'Khach vang lai',
        customer_phone: '',
        payment_method: 'cash',
      },
      snapshot: { items: [{ id: 'p1', name: 'Americano', price: 60000, quantity: 1 }], total: 60000, subtotal: 60000, discount: 0 },
      tenantId: 'tenant_x',
    } as Parameters<typeof runPostOrderSideEffects>[0]);
    await runPostOrderSideEffects({
      db,
      env: { AURA_DB: db } as unknown as Env,
      orderId: 'ord_walkin_2',
      data: {
        items: [{ product_id: 'p1', name: 'Cold Brew', price: 80000, quantity: 1 }],
        total: 80000,
        customer_name: 'Khach vang lai',
        customer_phone: '0900000000',
        payment_method: 'cash',
      },
      snapshot: { items: [{ id: 'p1', name: 'Cold Brew', price: 80000, quantity: 1 }], total: 80000, subtotal: 80000, discount: 0 },
      tenantId: 'tenant_x',
    } as Parameters<typeof runPostOrderSideEffects>[0]);

    await creditLoyaltyIfEligible(db, undefined, 'ord_walkin_1', 'tenant_x');
    await creditLoyaltyIfEligible(db, undefined, 'ord_walkin_2', 'tenant_x');

    // Real customer accrues normally
    await creditLoyaltyIfEligible(db, undefined, 'ord_real_1', 'tenant_x');

    // Only the real customer exists — zero walk-in/sentinel customer or wallet created
    const allCustomers = sqlite.prepare(`SELECT id, phone FROM customers WHERE tenant_id = 'tenant_x'`).all() as Array<{
      id: string;
      phone: string;
    }>;
    expect(allCustomers).toEqual([{ id: 'cust_real_1', phone: '0987654321' }]);

    const allWallets = sqlite.prepare(`SELECT customer_id FROM cashback_wallets WHERE tenant_id = 'tenant_x'`).all();
    expect(allWallets).toEqual([{ customer_id: 'cust_real_1' }]);

    const pointLogs = sqlite.prepare(`SELECT customer_id, order_id, points_change FROM loyalty_point_logs`).all() as Array<{
      customer_id: string;
      order_id: string;
      points_change: number;
    }>;
    expect(pointLogs).toHaveLength(1);
    expect(pointLogs[0].customer_id).toBe('cust_real_1');
    expect(pointLogs[0].order_id).toBe('ord_real_1');
  });

  it('#97: guest order matched via contact accrues loyalty and manual partial + full refunds reverse from original recipient without mutating orders.customer_id', async () => {
    const sqlite = createCrmSqlite();
    const db = createSqliteD1(sqlite);

    sqlite.exec(`
      INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id)
      VALUES ('cust_guest_match', 'guest@example.com', 'Matched Member', '0911223344', 0, 0, 'bronze', 'sadec');
      INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id)
      VALUES ('wal_guest_match', 'cust_guest_match', 0, 0, 0, 'sadec');
      INSERT INTO orders (id, customer_id, customer_name, customer_phone, customer_email, total, total_amount, status, payment_method, payment_status, tenant_id)
      VALUES ('ord_guest_payos', NULL, 'Matched Member', '+84911223344', 'guest@example.com', 100000, 100000, 'confirmed', 'payos', 'paid', 'sadec');
      INSERT INTO payments (id, order_id, amount, method, status, transaction_id, tenant_id)
      VALUES ('pay_guest_1', 'ord_guest_payos', 100000, 'payos', 'paid', '99887766', 'sadec');
    `);

    // Step 1: Guest order accrues loyalty via contact match while orders.customer_id stays NULL
    await creditLoyaltyIfEligible(db, undefined, 'ord_guest_payos', 'sadec');

    const orderBeforeRefund = sqlite.prepare(`SELECT customer_id, points_earned FROM orders WHERE id = 'ord_guest_payos'`).get() as {
      customer_id: string | null;
      points_earned: number;
    };
    expect(orderBeforeRefund.customer_id).toBeNull();
    const earnedPoints = orderBeforeRefund.points_earned;
    expect(earnedPoints).toBeGreaterThan(0);

    const custAfterEarn = sqlite.prepare(`SELECT loyalty_points FROM customers WHERE id = 'cust_guest_match'`).get() as {
      loyalty_points: number;
    };
    expect(custAfterEarn.loyalty_points).toBe(earnedPoints);

    // Step 2: Partial manual refund (50%) via handleRefund
    const app = new Hono<{ Bindings: Env }>();
    app.post('/refund', async (c) => {
      c.set('user' as never, { id: 'mgr_1', name: 'Manager', role: 'manager', tenantId: 'sadec' } as never);
      return handleRefund(c);
    });
    const env = { AURA_DB: db } as unknown as Env;

    const resPartial = await app.fetch(
      new Request('https://test.aura/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay_guest_1',
          amount: 50000,
          reason: 'Partial refund',
          manualTransferRef: 'VCB-GUEST-PART-1',
        }),
      }),
      env,
    );
    expect(resPartial.status).toBe(200);
    const bodyPartial = (await resPartial.json()) as {
      success: boolean;
      data: { loyalty_reversal: { status: string; customerId: string; pointsDeducted: number } };
    };
    expect(bodyPartial.data.loyalty_reversal.status).toBe('reversed');
    expect(bodyPartial.data.loyalty_reversal.customerId).toBe('cust_guest_match');
    expect(bodyPartial.data.loyalty_reversal.pointsDeducted).toBe(Math.round(earnedPoints * 0.5));

    // Step 3: Remaining 50% refund reverses the rest; duplicate ref is rejected 409
    const resFinal = await app.fetch(
      new Request('https://test.aura/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay_guest_1',
          amount: 50000,
          reason: 'Final refund',
          manualTransferRef: 'VCB-GUEST-PART-2',
        }),
      }),
      env,
    );
    expect(resFinal.status).toBe(200);

    const custAfterFullRefund = sqlite.prepare(`SELECT loyalty_points, lifetime_points FROM customers WHERE id = 'cust_guest_match'`).get() as {
      loyalty_points: number;
      lifetime_points: number;
    };
    expect(custAfterFullRefund.loyalty_points).toBe(0);
    expect(custAfterFullRefund.lifetime_points).toBe(0);

    // orders.customer_id was NEVER mutated to grant ownership
    const orderAfterRefund = sqlite.prepare(`SELECT customer_id FROM orders WHERE id = 'ord_guest_payos'`).get() as {
      customer_id: string | null;
    };
    expect(orderAfterRefund.customer_id).toBeNull();

    // Repeat call on already-refunded payment is rejected and does not double-reverse
    const resRepeat = await app.fetch(
      new Request('https://test.aura/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay_guest_1',
          amount: 50000,
          reason: 'Repeat',
          manualTransferRef: 'VCB-GUEST-PART-2',
        }),
      }),
      env,
    );
    expect([400, 409]).toContain(resRepeat.status);
    const custAfterRepeat = sqlite
      .prepare(`SELECT loyalty_points, lifetime_points FROM customers WHERE id = 'cust_guest_match'`)
      .get() as { loyalty_points: number; lifetime_points: number };
    expect(custAfterRepeat.loyalty_points).toBe(0);
    expect(custAfterRepeat.lifetime_points).toBe(0);
  });

  it('#97: records auditable retryable failure when refund succeeds but loyalty reversal fails', async () => {
    const sqlite = createCrmSqlite();
    const db = createSqliteD1(sqlite);

    // Accrual ledger points to a missing customer row so reverseAccrual fails with customer_not_found
    sqlite.exec(`
      INSERT INTO orders (id, customer_id, customer_name, customer_phone, total, total_amount, status, payment_method, payment_status, points_earned, tenant_id)
      VALUES ('ord_fail_rev', NULL, 'Orphaned', '0911000111', 100000, 100000, 'confirmed', 'payos', 'paid', 100, 'sadec');
      INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, tenant_id)
      VALUES ('ptl_earn_1', 'cust_deleted_ghost', 'ord_fail_rev', 100, 'order_earned', 100, 'sadec');
      INSERT INTO payments (id, order_id, amount, method, status, transaction_id, tenant_id)
      VALUES ('pay_fail_rev', 'ord_fail_rev', 100000, 'payos', 'paid', '11223344', 'sadec');
    `);

    const app = new Hono<{ Bindings: Env }>();
    app.post('/refund', async (c) => {
      c.set('user' as never, { id: 'mgr_1', name: 'Manager', role: 'manager', tenantId: 'sadec' } as never);
      return handleRefund(c);
    });

    const res = await app.fetch(
      new Request('https://test.aura/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay_fail_rev',
          amount: 100000,
          reason: 'Full refund',
          manualTransferRef: 'VCB-FAIL-REV-1',
        }),
      }),
      { AURA_DB: db } as unknown as Env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { loyalty_reversal: { status: string; retryable?: boolean; reason?: string; customerId?: string } };
    };
    expect(body.data.loyalty_reversal.status).toBe('failed');
    expect(body.data.loyalty_reversal.retryable).toBe(true);
    expect(body.data.loyalty_reversal.customerId).toBe('cust_deleted_ghost');

    const failedAudits = sqlite
      .prepare(`SELECT action, resource_id, details FROM audit_logs WHERE action = 'loyalty_reversal_failed'`)
      .all() as Array<{ action: string; resource_id: string; details: string }>;
    expect(failedAudits).toHaveLength(1);
    expect(failedAudits[0].resource_id).toBe('pay_fail_rev');
    expect(failedAudits[0].details).toContain('cust_deleted_ghost');
    const settledPayment = sqlite.prepare("SELECT * FROM payments WHERE id = 'pay_fail_rev'").get();
    sqlite.exec(`INSERT INTO customers (id, loyalty_points, lifetime_points, tenant_id)
      VALUES ('cust_deleted_ghost', 100, 100, 'sadec');`);
    const retry = await app.fetch(new Request('https://test.aura/refund', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: 'pay_fail_rev',
        amount: 100000, reason: 'Full refund', manualTransferRef: 'VCB-FAIL-REV-1' }) }), { AURA_DB: db } as unknown as Env);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ data: { loyalty_reversal: { status: 'reversed', pointsDeducted: 100 } } });
    expect(sqlite.prepare("SELECT * FROM payments WHERE id = 'pay_fail_rev'").get()).toEqual(settledPayment);
    expect(sqlite.prepare('SELECT count(*) n FROM payment_refund_transfers').get()?.n).toBe(1);
    expect(sqlite.prepare("SELECT loyalty_points, lifetime_points FROM customers WHERE id = 'cust_deleted_ghost'").get())
      .toMatchObject({ loyalty_points: 0, lifetime_points: 0 });
  });

  it('#97: fails closed with ambiguous_accrual_recipient and audit log when multiple customers accrued on the same order', async () => {
    const sqlite = createCrmSqlite();
    const db = createSqliteD1(sqlite);

    sqlite.exec(`
      INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, tenant_id)
      VALUES
        ('cust_amb_a', 'Guest A', '0911000222', 100, 100, 'sadec'),
        ('cust_amb_b', 'Guest B', '0911000333', 100, 100, 'sadec');
      INSERT INTO orders (id, customer_id, customer_name, customer_phone, total, total_amount, status, payment_method, payment_status, points_earned, tenant_id)
      VALUES ('ord_amb_rev', 'cust_amb_a', 'Ambiguous', '0911000222', 100000, 100000, 'confirmed', 'payos', 'paid', 100, 'sadec');
      INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, tenant_id)
      VALUES
        ('ptl_amb_1', 'cust_amb_a', 'ord_amb_rev', 50, 'order_earned', 100, 'sadec'),
        ('ptl_amb_2', 'cust_amb_b', 'ord_amb_rev', 50, 'order_earned', 100, 'sadec');
      INSERT INTO payments (id, order_id, amount, method, status, transaction_id, tenant_id)
      VALUES ('pay_amb_rev', 'ord_amb_rev', 100000, 'payos', 'paid', '55667788', 'sadec');
    `);

    const app = new Hono<{ Bindings: Env }>();
    app.post('/refund', async (c) => {
      c.set('user' as never, { id: 'mgr_1', name: 'Manager', role: 'manager', tenantId: 'sadec' } as never);
      return handleRefund(c);
    });

    const res = await app.fetch(
      new Request('https://test.aura/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay_amb_rev',
          amount: 100000,
          reason: 'Full refund',
          manualTransferRef: 'VCB-AMB-REV-1',
        }),
      }),
      { AURA_DB: db } as unknown as Env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { loyalty_reversal: { status: string; retryable?: boolean; reason?: string } };
    };
    expect(body.data.loyalty_reversal).toEqual({
      status: 'failed',
      reason: 'ambiguous_accrual_recipient',
      retryable: true,
    });

    const failedAudits = sqlite
      .prepare(`SELECT action, resource_id, details FROM audit_logs WHERE action = 'loyalty_reversal_failed'`)
      .all() as Array<{ action: string; resource_id: string; details: string }>;
    expect(failedAudits).toHaveLength(1);
    expect(failedAudits[0].resource_id).toBe('pay_amb_rev');
    expect(failedAudits[0].details).toContain('ambiguous_accrual_recipient');
    expect(failedAudits[0].details).toContain('cust_amb_a');
    expect(failedAudits[0].details).toContain('cust_amb_b');

    const balances = sqlite
      .prepare(`SELECT id, loyalty_points FROM customers WHERE id IN ('cust_amb_a', 'cust_amb_b') ORDER BY id`)
      .all() as Array<{ id: string; loyalty_points: number }>;
    expect(balances).toEqual([
      { id: 'cust_amb_a', loyalty_points: 100 },
      { id: 'cust_amb_b', loyalty_points: 100 },
    ]);
  });
});
