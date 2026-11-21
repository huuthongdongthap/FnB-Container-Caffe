// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  nowPaymentsIPN,
  processNowPaymentsIpn,
} from '../../../packages/domain/payment/commands/nowpayments-ipn';

function paymentFixture(tenantColumns = true) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/008_subscription_tables.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/013_invoice_payment_status.sql', import.meta.url), 'utf8'));
  if (tenantColumns) {
    sqlite.exec("ALTER TABLE subscriptions ADD COLUMN tenant_id TEXT DEFAULT 'default'; ALTER TABLE subscription_invoices ADD COLUMN tenant_id TEXT DEFAULT 'default';");
  }
  sqlite.exec(`
    INSERT INTO subscription_plans (id, name, slug, monthly_price_vnd) VALUES ('plan', 'Plan', 'plan', 500000);
    INSERT INTO subscriptions (id, plan_id, customer_name, customer_email, customer_phone, status,
      billing_cycle, current_period_start, current_period_end, next_billing_date, amount_vnd)
      VALUES ('sub', 'plan', 'Customer', 'test@example.test', '000', 'pending', 'monthly',
        '2099-01-01', '2099-02-01', '2099-02-01', 500000);
    INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, payment_ref, period_start, period_end)
      VALUES ('invoice', 'sub', 500000, 'pending', 'payment', '2099-01-01', '2099-02-01');
  `);
  const prepare = (sql: string) => {
    let args: SQLInputValue[] = [];
    const statement = {
      bind(...values: SQLInputValue[]) { args = values; return statement; },
      async first<T = Record<string, unknown>>(): Promise<T | null> {
        return (sqlite.prepare(sql).get(...args) as T | undefined) ?? null;
      },
      async run() {
        return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } };
      },
    };
    return statement;
  };
  const db = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const state = () => ({
    invoice: sqlite.prepare("SELECT status, payment_ref FROM subscription_invoices WHERE id = 'invoice'").get(),
    subscription: sqlite.prepare("SELECT status, current_period_start, current_period_end FROM subscriptions WHERE id = 'sub'").get(),
  });
  return { sqlite, db, state };
}

const payload = {
  payment_id: 'payment', order_id: 'invoice_invoice', payment_status: 'finished',
  price_amount: 500000, price_currency: 'vnd',
};
const openDatabases: DatabaseSync[] = [];
function fixture(tenantColumns = true) {
  const result = paymentFixture(tenantColumns);
  openDatabases.push(result.sqlite);
  return result;
}
afterEach(() => {
  for (const sqlite of openDatabases.splice(0)) sqlite.close();
  vi.restoreAllMocks();
});

describe('NOWPayments settlement integrity', () => {
  it('keeps an initial invoice retryable after activation failure and activates exactly once on retry', async () => {
    const { sqlite, db, state } = fixture();
    sqlite.exec(`CREATE TRIGGER reject_activation BEFORE UPDATE ON subscriptions
      BEGIN SELECT RAISE(ABORT, 'transient activation failure'); END;`);
    const failed = await processNowPaymentsIpn(db, payload);
    expect(failed).toMatchObject({ ok: false, status: 500 });
    expect(state().invoice?.status).toBe('pending');
    expect(state().subscription?.status).toBe('pending');
    sqlite.exec('DROP TRIGGER reject_activation');
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: true });
    expect(state().invoice?.status).toBe('paid');
    expect(state().subscription).toMatchObject({ status: 'active', current_period_end: '2099-02-01' });
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: true, idempotent: true });
    expect(state().subscription?.current_period_end).toBe('2099-02-01');
  });

  it('does not extend a renewal when invoice settlement fails, then extends only once on retry', async () => {
    const { sqlite, db, state } = fixture();
    sqlite.exec(`UPDATE subscriptions SET status = 'active';
      UPDATE subscription_invoices SET period_start = '2099-02-01', period_end = '2099-03-01';
      INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status) VALUES ('prior', 'sub', 500000, 'paid');
      CREATE TRIGGER reject_settlement BEFORE UPDATE ON subscription_invoices
      BEGIN SELECT RAISE(ABORT, 'transient invoice failure'); END;`);
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: false, status: 500 });
    expect(state().invoice?.status).toBe('pending');
    expect(state().subscription?.current_period_end).toBe('2099-02-01');
    sqlite.exec('DROP TRIGGER reject_settlement');
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: true });
    expect(state().subscription?.current_period_end).toBe('2099-03-01');
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ idempotent: true });
    expect(state().subscription?.current_period_end).toBe('2099-03-01');
  });

  it('settles legacy schemas without tenant columns atomically', async () => {
    const { db, state } = fixture(false);
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: true });
    expect(state().invoice?.status).toBe('paid');
    expect(state().subscription?.status).toBe('active');
  });

  it('rejects cross-tenant activation without settling the invoice', async () => {
    const { sqlite, db, state } = fixture();
    sqlite.exec("UPDATE subscription_invoices SET tenant_id = 'store-a'; UPDATE subscriptions SET tenant_id = 'store-b';");
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: false, status: 400 });
    expect(state().invoice?.status).toBe('pending');
    expect(state().subscription?.status).toBe('pending');
  });

  it('keeps missing subscriptions unpaid and retryable', async () => {
    const { sqlite, db, state } = fixture();
    sqlite.exec("PRAGMA foreign_keys = OFF; DELETE FROM subscriptions;");
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: false, status: 500 });
    expect(state().invoice?.status).toBe('pending');
  });

  it('serializes simultaneous deliveries without extending twice', async () => {
    const { db, state } = fixture();
    const results = await Promise.all([processNowPaymentsIpn(db, payload), processNowPaymentsIpn(db, payload)]);
    // A busy batch may require retry, but must never leave a half-settled payment.
    expect(results.some(result => result.ok)).toBe(true);
    expect(await processNowPaymentsIpn(db, payload)).toMatchObject({ ok: true, idempotent: true });
    expect(state().subscription).toMatchObject({ status: 'active', current_period_end: '2099-02-01' });
  });

  for (const tenantColumns of [true, false]) {
    it(`rolls back a refund after cancellation fails and succeeds on retry (tenant columns=${tenantColumns})`, async () => {
      const { sqlite, db, state } = fixture(tenantColumns);
      const refund = { ...payload, payment_status: 'refunded' };
      sqlite.exec(`UPDATE subscription_invoices SET status = 'paid';
        UPDATE subscriptions SET status = 'past_due';
        CREATE TRIGGER reject_cancellation BEFORE UPDATE ON subscriptions
        BEGIN SELECT RAISE(ABORT, 'transient cancellation failure'); END;`);
      expect(await processNowPaymentsIpn(db, refund)).toMatchObject({ ok: false, status: 500 });
      expect(state().invoice?.status).toBe('paid');
      expect(state().subscription?.status).toBe('past_due');
      sqlite.exec('DROP TRIGGER reject_cancellation');
      expect(await processNowPaymentsIpn(db, refund)).toMatchObject({ ok: true });
      expect(state().invoice?.status).toBe('refunded');
      expect(state().subscription?.status).toBe('cancelled');
      expect(await processNowPaymentsIpn(db, refund)).toMatchObject({ ok: true, idempotent: true });
      expect(state().subscription?.status).toBe('cancelled');
    });
  }

  it('returns retryable HTTP failure for unexpected database errors after signature validation', async () => {
    const body = JSON.stringify(payload);
    const secret = 'test-ipn-secret';
    const signature = createHmac('sha512', secret).update(body).digest('hex');
    const response = await nowPaymentsIPN(new Request('https://example.test/api/webhooks/nowpayments', {
      method: 'POST', body, headers: { 'x-nowpayments-sig': signature },
    }), { ENVIRONMENT: 'production', NOWPAYMENTS_IPN_SECRET: secret,
      AURA_DB: { prepare() { throw new Error('database unavailable'); } } });
    expect(response.status).toBe(500);
  });
});
