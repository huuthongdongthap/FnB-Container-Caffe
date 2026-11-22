// @vitest-environment node
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { handleRefund } from '../../routes/refunds-handlers/mutation-handlers';
import { handlePayosWebhook } from '../../routes/webhooks-handlers/payos';
import type { Env } from '../../types/env';

/** Real SQLite D1 transactions with enough canonical CRM schema for PayOS accrual. */
export function refundRaceFixture() {
  const f = paymentSqliteDB();
  f.sqlite.exec(`ALTER TABLE orders ADD COLUMN cashback_used INTEGER DEFAULT 0;
    ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0;
    ALTER TABLE orders ADD COLUMN cashback_earned INTEGER DEFAULT 0;
    CREATE TABLE customers (id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', name TEXT, phone TEXT, email TEXT,
      loyalty_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, loyalty_tier TEXT DEFAULT 'bronze', updated_at TEXT);
    CREATE TABLE cashback_wallets (id TEXT PRIMARY KEY, customer_id TEXT, tenant_id TEXT DEFAULT 'default',
      balance INTEGER DEFAULT 0, total_earned INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE cashback_transactions (id TEXT PRIMARY KEY, wallet_id TEXT, customer_id TEXT, order_id TEXT, type TEXT,
      amount INTEGER, balance_after INTEGER, expires_at TEXT, multiplier_applied REAL, campaign_id TEXT, description TEXT,
      created_at TEXT, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE loyalty_point_logs (id TEXT PRIMARY KEY, customer_id TEXT, order_id TEXT, points_change INTEGER, reason TEXT,
      balance_after INTEGER, description TEXT, created_at TEXT, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE loyalty_audit_log (id TEXT PRIMARY KEY, customer_id TEXT, action TEXT, amount_vnd INTEGER,
      order_id TEXT, metadata TEXT, created_at TEXT, tenant_id TEXT DEFAULT 'default');
    CREATE TABLE loyalty_accounts (customer_id TEXT, tenant_id TEXT DEFAULT 'default', current_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0, tier TEXT, updated_at TEXT);
    INSERT INTO customers (id) VALUES ('member');
    INSERT INTO cashback_wallets (id, customer_id) VALUES ('wallet', 'member');
    INSERT INTO refund_tenant_readiness VALUES ('default', datetime('now'), 'local-test', 'fresh empty test database');`);
  const sqlByStatement = new WeakMap<object, string>();
  let beforeBatch: ((sql: string[]) => Promise<void>) | undefined;
  let afterCreditBatch: (() => Promise<void>) | undefined;
  const db = {
    prepare(sql: string) {
      const stmt = f.db.prepare(sql); sqlByStatement.set(stmt, sql); return stmt;
    },
    async batch(stmts: D1PreparedStatement[]) {
      const sql = stmts.map(stmt => sqlByStatement.get(stmt) ?? '');
      await beforeBatch?.(sql);
      const results = await f.db.batch(stmts);
      if (afterCreditBatch && sql.some(query => query.includes('INSERT INTO cashback_transactions'))) {
        const hook = afterCreditBatch; afterCreditBatch = undefined;
        await hook();
      }
      return results;
    },
  } as D1Database;
  const app = new Hono<{ Bindings: Env }>();
  app.post('/payos', c => handlePayosWebhook(c));
  app.post('/refund', c => {
    c.set('user' as never, { id: 'manager', role: 'manager', tenantId: c.req.header('x-tenant') ?? 'default' } as never);
    return handleRefund(c, true);
  });
  const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: 'local-payos-checksum', ENVIRONMENT: 'test' } as unknown as Env;
  const refund = (body: Record<string, unknown>, tenant = 'default') => app.request('/refund', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant': tenant }, body: JSON.stringify(body),
  }, env);
  return { ...f, db, app, env, refund, onBatch(hook: typeof beforeBatch) { beforeBatch = hook; },
    afterCredit(hook: typeof afterCreditBatch) { afterCreditBatch = hook; } };
}
