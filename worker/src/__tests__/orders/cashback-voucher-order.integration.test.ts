// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, it, expect } from 'vitest';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { registerPromotionValidationHandlers } from '../../routes/promotions-handlers/validation-handlers';
import type { Env } from '../../types/env';

function createSqliteD1(): { d1: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const schemaPath = path.resolve(__dirname, '../../../schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  raw.exec(schemaSql);

  const makeStmt = (sql: string, params: unknown[] = []) => ({
    bind(...args: unknown[]) {
      return makeStmt(sql, args);
    },
    async first<T = Record<string, unknown>>() {
      const stmt = raw.prepare(sql);
      const row = stmt.get(...(params as never[])) as T | undefined;
      return row ?? null;
    },
    async all<T = Record<string, unknown>>() {
      const stmt = raw.prepare(sql);
      const results = stmt.all(...(params as never[])) as T[];
      return { results, success: true, meta: {} };
    },
    async run() {
      const stmt = raw.prepare(sql);
      const info = stmt.run(...(params as never[])) as { changes: number; lastInsertRowid: number };
      return {
        success: true,
        meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
      };
    },
    _exec() {
      const stmt = raw.prepare(sql);
      return stmt.run(...(params as never[]));
    },
  });

  const d1 = {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(stmts: Array<{ _exec: () => unknown }>) {
      raw.exec('BEGIN');
      try {
        const results = stmts.map((s) => {
          const info = s._exec() as { changes?: number };
          return { success: true, meta: { changes: Number(info?.changes ?? 0) } };
        });
        raw.exec('COMMIT');
        return results;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  } as unknown as D1Database;

  return { d1, raw };
}

describe('Cashback wallet, voucher rollback, and promo IDOR integration (#121, #122)', () => {
  it('commits cashback order with NOT NULL cashback_transactions.balance_after against real worker/schema.sql', async () => {
    const { d1, raw } = createSqliteD1();
    const now = '2026-11-23T05:00:00.000Z';

    raw.prepare(
      `INSERT INTO categories (id, name, slug, tenant_id, created_at)
       VALUES ('cat-coffee', 'Coffee', 'coffee', 'default', ?)`
    ).run(now);

    raw.prepare(
      `INSERT INTO products (id, name, price, category_id, is_available, tenant_id, created_at, updated_at)
       VALUES ('prod-1', 'Cà Phê Sữa Đá', 50000, 'cat-coffee', 1, 'default', ?, ?)`
    ).run(now, now);

    raw.prepare(
      `INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id, created_at, updated_at)
       VALUES ('cust-1', 'Nguyễn Văn A', '0901234567', 100, 'silver', 'default', ?, ?)`
    ).run(now, now);

    raw.prepare(
      `INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at)
       VALUES ('wallet-1', 'cust-1', 25000, 25000, 0, 'default', ?, ?)`
    ).run(now, now);

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0901234567',
        customer_address: '123 Sa Đéc',
        payment_method: 'cod',
        total: 35000,
        items: [{ id: 'prod-1', name: 'Cà Phê Sữa Đá', price: 50000, quantity: 1 }],
        use_cashback: true,
        cashback_amount: 15000,
      }),
    });

    const res = await createOrder(
      req,
      { AURA_DB: d1 },
      undefined,
      { id: 'cust-1', role: 'customer', phone: '0901234567' },
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string; total: number } };
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(35000);

    const wallet = raw.prepare('SELECT balance, total_spent FROM cashback_wallets WHERE id = ?').get('wallet-1') as {
      balance: number;
      total_spent: number;
    };
    expect(wallet.balance).toBe(10000);
    expect(wallet.total_spent).toBe(15000);

    const tx = raw.prepare(
      'SELECT amount, balance_after, type FROM cashback_transactions WHERE wallet_id = ?'
    ).get('wallet-1') as { amount: number; balance_after: number; type: string };
    expect(tx.type).toBe('spend');
    expect(tx.amount).toBe(-15000);
    expect(tx.balance_after).toBe(10000);
  });

  it('rolls back reserved loyalty voucher when subsequent cashback balance check fails', async () => {
    const { d1, raw } = createSqliteD1();
    const now = '2026-11-23T05:00:00.000Z';

    raw.prepare(
      `INSERT INTO categories (id, name, slug, tenant_id, created_at)
       VALUES ('cat-coffee', 'Coffee', 'coffee', 'default', ?)`
    ).run(now);

    raw.prepare(
      `INSERT INTO products (id, name, price, category_id, is_available, tenant_id, created_at, updated_at)
       VALUES ('prod-1', 'Latte', 60000, 'cat-coffee', 1, 'default', ?, ?)`
    ).run(now, now);

    raw.prepare(
      `INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id, created_at, updated_at)
       VALUES ('cust-2', 'Trần Thị B', '0909876543', 100, 'silver', 'default', ?, ?)`
    ).run(now, now);

    raw.prepare(
      `INSERT INTO rewards (id, title, point_cost, discount_type, discount_value, min_order, is_active, tenant_id, created_at)
       VALUES ('rew-1', 'Giảm 10k', 50, 'fixed', 10000, 0, 1, 'default', ?)`
    ).run(now);

    raw.prepare(
      `INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, tenant_id, created_at)
       VALUES ('ur-rb', 'cust-2', 'rew-1', 'VCH-ROLLBACK', 'active', '2099-12-31T23:59:59.000Z', 'default', ?)`
    ).run(now);

    raw.prepare(
      `INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at)
       VALUES ('wallet-2', 'cust-2', 5000, 5000, 0, 'default', ?, ?)`
    ).run(now, now);

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Trần Thị B',
        customer_phone: '0909876543',
        payment_method: 'cod',
        items: [{ id: 'prod-1', name: 'Latte', price: 60000, quantity: 1 }],
        promo_code: 'VCH-ROLLBACK',
        use_cashback: true,
        cashback_amount: 20000, // Exceeds 5000 balance -> triggers early errorResponse after voucher reservation
      }),
    });

    const res = await createOrder(
      req,
      { AURA_DB: d1 },
      undefined,
      { id: 'cust-2', role: 'customer', phone: '0909876543' },
    );

    expect(res.status).toBe(400);
    const voucherRow = raw.prepare('SELECT status FROM user_rewards WHERE id = ?').get('ur-rb') as { status: string };
    expect(voucherRow.status).toBe('active');
  });

  it('prevents non-staff caller from spoofing customer_id in POST /api/promotions/validate (IDOR)', async () => {
    const { d1, raw } = createSqliteD1();
    const now = '2026-11-23T05:00:00.000Z';

    raw.prepare(
      `INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id, created_at, updated_at)
       VALUES ('cust-victim', 'Victim', '0901112222', 100, 'silver', 'default', ?, ?)`
    ).run(now, now);

    raw.prepare(
      `INSERT INTO rewards (id, title, point_cost, discount_type, discount_value, min_order, is_active, tenant_id, created_at)
       VALUES ('rew-idor', 'Giảm 20k', 100, 'fixed', 20000, 0, 1, 'default', ?)`
    ).run(now);

    raw.prepare(
      `INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, tenant_id, created_at)
       VALUES ('ur-idor', 'cust-victim', 'rew-idor', 'VCH-VICTIM', 'active', '2099-12-31T23:59:59.000Z', 'default', ?)`
    ).run(now);

    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('tenantId' as never, 'default' as never);
      await next();
    });
    registerPromotionValidationHandlers(app);

    const res = await app.request(
      '/validate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'VCH-VICTIM',
          order_total: 100000,
          customer_id: 'cust-victim', // Spoofed by anonymous caller
        }),
      },
      { AURA_DB: d1 } as Env,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { valid: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(false);
  });

  it('rejects unauthenticated guest redeeming another customer voucher or points via phone lookup (403)', async () => {
    const { d1, raw } = createSqliteD1();
    const now = '2026-11-23T05:00:00.000Z';

    raw.prepare(
      `INSERT INTO categories (id, name, slug, tenant_id, created_at)
       VALUES ('cat-sec', 'Coffee', 'coffee-sec', 'default', ?)`
    ).run(now);

    raw.prepare(
      `INSERT INTO products (id, name, price, category_id, is_available, tenant_id, created_at, updated_at)
       VALUES ('prod-sec', 'Americano', 50000, 'cat-sec', 1, 'default', ?, ?)`
    ).run(now, now);

    raw.prepare(
      `INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id, created_at, updated_at)
       VALUES ('cust-sec', 'Victim Member', '0905556666', 500, 'gold', 'default', ?, ?)`
    ).run(now, now);

    raw.prepare(
      `INSERT INTO rewards (id, title, point_cost, discount_type, discount_value, min_order, is_active, tenant_id, created_at)
       VALUES ('rew-sec', 'Giảm 15k', 50, 'fixed', 15000, 0, 1, 'default', ?)`
    ).run(now);

    raw.prepare(
      `INSERT INTO user_rewards (id, customer_id, reward_id, code, status, expires_at, tenant_id, created_at)
       VALUES ('ur-sec', 'cust-sec', 'rew-sec', 'VCH-SEC-ONLY', 'active', '2099-12-31T23:59:59.000Z', 'default', ?)`
    ).run(now);

    // 1. Non-POS staff (kitchen) with staff_override attempting to use customer's voucher -> 403
    const voucherReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: 'cust-sec',
        customer_name: 'Victim Member',
        customer_phone: '0905556666',
        customer_address: '123 Sa Đéc',
        payment_method: 'cod',
        total: 35000,
        items: [{ id: 'prod-sec', name: 'Americano', price: 50000, quantity: 1 }],
        promo_code: 'VCH-SEC-ONLY',
      }),
    });
    const voucherRes = await createOrder(
      voucherReq,
      { AURA_DB: d1 },
      undefined,
      { id: 'kitchen-1', role: 'kitchen' },
    );
    expect(voucherRes.status).toBe(403);
    const vRow = raw.prepare('SELECT status FROM user_rewards WHERE id = ?').get('ur-sec') as { status: string };
    expect(vRow.status).toBe('active');

    // 2. Non-POS staff (kitchen) with staff_override attempting to redeem customer's loyalty points -> 403
    const pointsReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: 'cust-sec',
        customer_name: 'Victim Member',
        customer_phone: '0905556666',
        customer_address: '123 Sa Đéc',
        payment_method: 'cod',
        total: 40000,
        items: [{ id: 'prod-sec', name: 'Americano', price: 50000, quantity: 1 }],
        redeem_points: 100,
      }),
    });
    const pointsRes = await createOrder(
      pointsReq,
      { AURA_DB: d1 },
      undefined,
      { id: 'kitchen-1', role: 'kitchen' },
    );
    expect(pointsRes.status).toBe(403);
    const cRow = raw.prepare('SELECT loyalty_points FROM customers WHERE id = ?').get('cust-sec') as { loyalty_points: number };
    expect(cRow.loyalty_points).toBe(500);

    // 3. Unauthenticated guest with victim's phone cannot redeem voucher or points either
    const guestVoucherRes = await createOrder(
      new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest Attacker',
          customer_phone: '0905556666',
          customer_address: '123 Sa Đéc',
          payment_method: 'cod',
          total: 35000,
          items: [{ id: 'prod-sec', name: 'Americano', price: 50000, quantity: 1 }],
          promo_code: 'VCH-SEC-ONLY',
        }),
      }),
      { AURA_DB: d1 },
    );
    expect([400, 403]).toContain(guestVoucherRes.status);
    const vRowAfterGuest = raw.prepare('SELECT status FROM user_rewards WHERE id = ?').get('ur-sec') as { status: string };
    expect(vRowAfterGuest.status).toBe('active');

    const guestPointsRes = await createOrder(
      new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest Attacker',
          customer_phone: '0905556666',
          customer_address: '123 Sa Đéc',
          payment_method: 'cod',
          total: 40000,
          items: [{ id: 'prod-sec', name: 'Americano', price: 50000, quantity: 1 }],
          redeem_points: 100,
        }),
      }),
      { AURA_DB: d1 },
    );
    expect([400, 403]).toContain(guestPointsRes.status);
    const cRowAfterGuest = raw.prepare('SELECT loyalty_points FROM customers WHERE id = ?').get('cust-sec') as { loyalty_points: number };
    expect(cRowAfterGuest.loyalty_points).toBe(500);
  });
});
