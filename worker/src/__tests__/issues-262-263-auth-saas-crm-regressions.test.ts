// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { applyAccrual, type LoyaltyPolicy } from '@aura/domain-crm';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const makeStmt = (sql: string, bound: unknown[] = []) => ({
    sql,
    bind(...args: unknown[]) {
      return makeStmt(sql, args);
    },
    async first<T = Record<string, unknown>>() {
      const row = sqlite.prepare(sql).get(...(bound as never[])) as T | undefined;
      return row ?? null;
    },
    async all<T = Record<string, unknown>>() {
      const results = sqlite.prepare(sql).all(...(bound as never[])) as T[];
      return { success: true, results, meta: { changes: 0 } };
    },
    async run() {
      const res = sqlite.prepare(sql).run(...(bound as never[]));
      return { success: true, meta: { changes: Number(res.changes ?? 0), last_row_id: Number(res.lastInsertRowid ?? 0) } };
    },
  });
  return {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(stmts: Array<{ sql?: string; run: () => Promise<unknown>; all: () => Promise<unknown> }>) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) {
          out.push(s.sql && /^\s*SELECT\b/i.test(s.sql) ? await s.all() : await s.run());
        }
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;
}
import { updateAdminCustomer } from '../routes/admin-handlers';
import { chatRouter } from '../routes/chat';
import { createSaasCommercialRoutes } from '../routes/saas-commercial';

const BASE_POLICY: LoyaltyPolicy = {
  tiers: [
    { tierName: 'bronze', minPoints: 0, cashbackRate: 0.02, pointMultiplier: 1 },
    { tierName: 'silver', minPoints: 100, cashbackRate: 0.05, pointMultiplier: 1.2 },
    { tierName: 'gold', minPoints: 500, cashbackRate: 0.08, pointMultiplier: 1.5 },
  ],
  campaignMultiplier: 1,
  maxCapPerTx: 100_000,
  expiresAt: null,
};

describe('Issues #262 & #263 — Auth, SaaS, CRM, Loyalty & Chat regressions', () => {
  it('#262: GET /api/saas/storefront/default resolves flagship tenant instead of 404', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE saas_tenants (id TEXT PRIMARY KEY, slug TEXT, name TEXT, tier TEXT, status TEXT, template_id TEXT, subdomain TEXT, trial_ends_at TEXT, current_period_end TEXT);
      CREATE TABLE tenant_branding (tenant_id TEXT PRIMARY KEY, brand_name TEXT);
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT, slug TEXT, description TEXT, sort_order INTEGER, is_active INTEGER, tenant_id TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, category_id TEXT, name TEXT, slug TEXT, price REAL, description TEXT, image_url TEXT, available INTEGER, is_available INTEGER, sort_order INTEGER, tenant_id TEXT);
      CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, code TEXT, name TEXT, zone TEXT, capacity INTEGER, status TEXT, sort_order INTEGER, is_active INTEGER, tenant_id TEXT);
      CREATE TABLE tenant_payment_configs (tenant_id TEXT PRIMARY KEY, provider TEXT, bank_bin TEXT, bank_account_no TEXT, bank_account_name TEXT, bank_name TEXT, payos_client_id_enc TEXT, payos_api_key_enc TEXT, payos_checksum_key_enc TEXT, is_active INTEGER);
    `);
    const db = createSqliteD1(sqlite);
    const app = new Hono();
    app.route('/api/saas', createSaasCommercialRoutes());

    const res = await app.request(
      'http://localhost/api/saas/storefront/default',
      {},
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { tenant?: { slug?: string } } };
    expect(json.success).toBe(true);
    expect(json.data?.tenant?.slug).toBe('default');
  });

  it('#263: applyAccrual updates customers.total_spent, total_orders, and tier alongside loyalty_tier', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT,
        loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze', tier TEXT DEFAULT 'bronze',
        total_spent REAL DEFAULT 0, total_orders INTEGER DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', updated_at TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, customer_id TEXT, total REAL, status TEXT, payment_status TEXT,
        cashback_earned REAL DEFAULT 0, points_earned INTEGER DEFAULT 0,
        cashback_used REAL DEFAULT 0, tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE cashback_wallets (
        id TEXT PRIMARY KEY, customer_id TEXT, balance REAL DEFAULT 0,
        total_earned REAL DEFAULT 0, total_spent REAL DEFAULT 0,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
      CREATE TABLE cashback_transactions (
        id TEXT PRIMARY KEY, wallet_id TEXT, customer_id TEXT, order_id TEXT,
        type TEXT, amount REAL, balance_after REAL, multiplier_applied REAL,
        campaign_id TEXT, remaining_amount REAL, description TEXT,
        expires_at TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_point_logs (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, points_change INTEGER,
        balance_after INTEGER, reason TEXT, description TEXT, reference_id TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_audit_log (
        id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, action TEXT,
        amount_vnd REAL, points INTEGER, tier_before TEXT, tier_after TEXT, note TEXT,
        entity_type TEXT, entity_id TEXT, actor_id TEXT, metadata TEXT,
        before_json TEXT, after_json TEXT, tenant_id TEXT DEFAULT 'default', created_at TEXT
      );
      CREATE TABLE loyalty_accounts (
        id TEXT PRIMARY KEY, customer_id TEXT, current_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0, tier TEXT DEFAULT 'bronze',
        order_count INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, last_activity_at TEXT,
        tenant_id TEXT DEFAULT 'default', created_at TEXT, updated_at TEXT
      );
    `);
    sqlite.prepare(`INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tier, total_spent, total_orders, tenant_id) VALUES ('c1', 'Alice', '0901234567', 0, 0, 'bronze', 'bronze', 0, 0, 'default')`).run();
    sqlite.prepare(`INSERT INTO orders (id, customer_id, total, status, payment_status, tenant_id) VALUES ('ord1', 'c1', 1050000, 'completed', 'paid', 'default')`).run();

    const db = createSqliteD1(sqlite);
    const res = await applyAccrual(db, BASE_POLICY, {
      orderId: 'ord1',
      customerId: 'c1',
      orderTotalVnd: 1050000,
      tenantId: 'default',
    });
    expect(res).toEqual(expect.objectContaining({ ok: true }));
    if (!res.ok) throw new Error(`${res.reason}: ${res.error}`);

    const cust = sqlite.prepare('SELECT loyalty_points, lifetime_points, loyalty_tier, tier, total_spent, total_orders FROM customers WHERE id = ?').get('c1') as Record<string, unknown>;
    expect(cust.loyalty_points).toBe(105);
    expect(cust.lifetime_points).toBe(105);
    expect(cust.loyalty_tier).toBe('silver');
    expect(cust.tier).toBe('silver');
    expect(cust.total_spent).toBe(1050000);
    expect(cust.total_orders).toBe(1);
  });

  it('#263: updateAdminCustomer rejects invalid tier, returns 404 on missing id, and returns 409 on duplicate phone', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE, email TEXT,
        loyalty_tier TEXT DEFAULT 'bronze', tier TEXT DEFAULT 'bronze',
        birthday TEXT, tenant_id TEXT DEFAULT 'default'
      );
    `);
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id) VALUES ('c1', 'Alice', '0901111111', 'default')`).run();
    sqlite.prepare(`INSERT INTO customers (id, name, phone, tenant_id) VALUES ('c2', 'Bob', '0902222222', 'default')`).run();
    const db = createSqliteD1(sqlite);
    const env = { AURA_DB: db };

    const invalidTierRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/c1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'supervip_invalid' }),
      }),
      env,
      'c1',
      'default',
    );
    expect(invalidTierRes.status).toBe(400);

    const missingRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ghost' }),
      }),
      env,
      'nonexistent',
      'default',
    );
    expect(missingRes.status).toBe(404);

    const dupPhoneRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/c1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0902222222' }),
      }),
      env,
      'c1',
      'default',
    );
    expect(dupPhoneRes.status).toBe(409);

    const validRes = await updateAdminCustomer(
      new Request('http://localhost/api/admin/customers/c1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'gold', birthday: '1995-05-10' }),
      }),
      env,
      'c1',
      'default',
    );
    expect(validRes.status).toBe(200);
    const updated = sqlite.prepare('SELECT loyalty_tier, tier, birthday FROM customers WHERE id = ?').get('c1') as Record<string, unknown>;
    expect(updated.loyalty_tier).toBe('gold');
    expect(updated.tier).toBe('gold');
    expect(updated.birthday).toBe('1995-05-10');
  });

  it('#263: POST /api/chat/messages rejects non-phone strings and normalizes 84... to 0...', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE contact_messages (
        id TEXT PRIMARY KEY, tenant_id TEXT, classification TEXT, name TEXT, phone TEXT,
        message TEXT, direction TEXT, category TEXT, status TEXT DEFAULT 'unread',
        read_at TEXT, created_at TEXT
      );
    `);
    const db = createSqliteD1(sqlite);
    const app = new Hono();
    app.route('/api/chat', chatRouter);

    const badRes = await app.request(
      'http://localhost/api/chat/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', phone: 'audit3notphone', message: 'hi' }),
      },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(badRes.status).toBe(400);

    const okRes = await app.request(
      'http://localhost/api/chat/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', phone: '+84901234567', message: 'xin chao' }),
      },
      { AURA_DB: db } as Record<string, unknown>,
    );
    expect(okRes.status).toBe(201);
    const row = sqlite.prepare('SELECT phone, status FROM contact_messages LIMIT 1').get() as Record<string, unknown>;
    expect(row.phone).toBe('0901234567');
    expect(row.status).toBe('unread');
  });
});
