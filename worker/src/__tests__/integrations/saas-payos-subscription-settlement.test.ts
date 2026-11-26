// @vitest-environment node
/**
 * Platform PayOS -> merchant subscription invoice settlement.
 *
 * `subscription_invoices` are paid on the platform PayOS account and carry
 * `payment_ref = 'payos:<orderCode>'`. They must settle through the SaaS billing
 * webhook; otherwise a paid container renewal stays `pending` forever because the
 * merchant webhook only looks at `payments`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { settleSubscriptionInvoiceByPayOS } from '../../tree/subscriptions/saas-payos-subscription-settlement';
import { app } from '../../index';
import type { Env } from '../../types/env';
import { computeHmacSha256Hex } from '../../lib/tenant-secrets';

const JWT_SECRET = 'saas-payos-subscription-settlement-jwt-secret-32ch!';
const SAAS_PAYOS_CHECKSUM = 'saas-platform-checksum-subscription-settlement';
const NOW = '2026-11-25T03:00:00.000Z';

function createMigratedD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  const repoRoot = path.resolve(__dirname, '../../../..');
  sqlite.exec(fs.readFileSync(path.join(repoRoot, 'worker/schema.sql'), 'utf8'));

  const prepare = (sql: string) => {
    const bound = (params: unknown[]) => ({
      bind: (...next: unknown[]) => bound(next),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const row = sqlite.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        return (colName ? (row[colName] ?? null) : row) as unknown as T;
      },
      all: async <T = Record<string, unknown>>() => ({
        results: sqlite.prepare(sql).all(...(params as never[])) as unknown as T[],
        success: true,
        meta: { changes: 0 },
      }),
      run: async () => {
        const info = sqlite.prepare(sql).run(...(params as never[]));
        return {
          success: true,
          results: [],
          meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
        };
      },
      raw: async () => [],
    });
    return bound([]);
  };

  const db = {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec('BEGIN');
      try {
        const out: unknown[] = [];
        for (const stmt of stmts) out.push(await stmt.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;

  return { db, sqlite };
}

function createMemoryKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, String(value));
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async (key: string) => ({ value: store.get(key) ?? null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function seedSubscription(
  sqlite: DatabaseSync,
  input: {
    tenantId: string;
    subscriptionId: string;
    billingCycle?: string;
    /** The subscription's currently paid period. */
    subPeriodStart?: string;
    subPeriodEnd?: string;
    /** The period the invoice bills — after `subPeriodEnd` means a renewal. */
    invoicePeriodStart?: string;
    invoicePeriodEnd?: string;
    invoiceId: string;
    orderCode: string;
    amountVnd?: number;
    invoiceStatus?: string;
    paymentRef?: string | null;
  }
) {
  const {
    tenantId,
    subscriptionId,
    billingCycle = 'monthly',
    subPeriodStart = '2026-11-01',
    subPeriodEnd = '2026-11-30',
    invoicePeriodStart = subPeriodStart,
    invoicePeriodEnd = subPeriodEnd,
    invoiceId,
    orderCode,
    amountVnd = 1_500_000,
    invoiceStatus = 'pending',
    paymentRef = `payos:${orderCode}`,
  } = input;

  sqlite
    .prepare(
      `INSERT INTO subscription_plans (tenant_id, id, name, slug, container_size, monthly_price_vnd, sort_order)
       VALUES (?, ?, 'Container Pro', ?, 'standard', ?, 1)
       ON CONFLICT(id) DO NOTHING`
    )
    .run(tenantId, `plan-${tenantId}`, `pro-${tenantId}`, amountVnd);

  sqlite
    .prepare(
      `INSERT INTO subscriptions
         (tenant_id, id, plan_id, customer_name, customer_email, customer_phone, status, billing_cycle,
          current_period_start, current_period_end, next_billing_date, amount_vnd)
       VALUES (?, ?, ?, 'Khách Container', ?, '0901112222', 'active', ?, ?, ?, ?, ?)`
    )
    .run(
      tenantId,
      subscriptionId,
      `plan-${tenantId}`,
      `${tenantId}@example.com`,
      billingCycle,
      subPeriodStart,
      subPeriodEnd,
      subPeriodEnd,
      amountVnd
    );

  sqlite
    .prepare(
      `INSERT INTO subscription_invoices
         (tenant_id, id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, payment_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      tenantId,
      invoiceId,
      subscriptionId,
      amountVnd,
      invoiceStatus,
      invoicePeriodStart,
      invoicePeriodEnd,
      `INV-${invoiceId}`,
      paymentRef
    );
}

const invoiceRow = (sqlite: DatabaseSync, id: string) =>
  sqlite
    .prepare('SELECT status, paid_at, payment_method, payment_ref FROM subscription_invoices WHERE id = ?')
    .get(id) as { status: string; paid_at: string | null; payment_method: string | null; payment_ref: string | null };

const subscriptionRow = (sqlite: DatabaseSync, id: string) =>
  sqlite
    .prepare('SELECT status, current_period_start, current_period_end, next_billing_date FROM subscriptions WHERE id = ?')
    .get(id) as {
    status: string;
    current_period_start: string;
    current_period_end: string;
    next_billing_date: string;
  };

describe('SaaS PayOS settlement for merchant subscription invoices', () => {
  const sqlites: DatabaseSync[] = [];

  afterEach(() => {
    while (sqlites.length) sqlites.pop()?.close();
  });

  it('marks a renewal invoice paid and extends the subscription exactly once, replay is a no-op', async () => {
    const { db, sqlite } = createMigratedD1();
    sqlites.push(sqlite);
    seedSubscription(sqlite, {
      tenantId: 'default',
      subscriptionId: 'sub-1',
      invoiceId: 'inv-1',
      orderCode: '700100200',
      // The invoice bills the period after the one currently paid.
      invoicePeriodStart: '2026-12-01',
      invoicePeriodEnd: '2026-12-31',
    });

    const first = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '700100200',
      amountPaid: 1_500_000,
      isPaid: true,
      nowIso: NOW,
    });
    expect(first).toEqual({
      handled: true,
      message: 'Subscription renewed',
      subscriptionAdvanced: true,
      tenantId: 'default',
    });

    const inv = invoiceRow(sqlite, 'inv-1');
    expect(inv.status).toBe('paid');
    expect(inv.paid_at).toBe(NOW);
    expect(inv.payment_method).toBe('payos');
    expect(inv.payment_ref).toBe('payos:700100200');

    const sub = subscriptionRow(sqlite, 'sub-1');
    expect(sub.status).toBe('active');
    expect(sub.current_period_start).toBe('2026-11-30');
    expect(sub.current_period_end).toBe('2026-12-30');
    expect(sub.next_billing_date).toBe('2026-12-30');

    const replay = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '700100200',
      amountPaid: 1_500_000,
      isPaid: true,
      nowIso: '2026-11-26T03:00:00.000Z',
    });
    expect(replay).toEqual({ handled: true, message: 'Already processed', tenantId: 'default' });

    expect(invoiceRow(sqlite, 'inv-1').paid_at).toBe(NOW);
    expect(subscriptionRow(sqlite, 'sub-1').current_period_end).toBe('2026-12-30');
  });

  it('does not move a subscription when the invoice only covers the period already paid', async () => {
    const { db, sqlite } = createMigratedD1();
    sqlites.push(sqlite);
    seedSubscription(sqlite, {
      tenantId: 'default',
      subscriptionId: 'sub-initial',
      invoiceId: 'inv-initial',
      orderCode: '700100205',
    });

    const result = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '700100205',
      amountPaid: 1_500_000,
      isPaid: true,
      nowIso: NOW,
    });
    expect(result).toEqual({
      handled: true,
      message: 'Invoice paid, subscription not advanced',
      subscriptionAdvanced: false,
      tenantId: 'default',
    });
    expect(invoiceRow(sqlite, 'inv-initial').status).toBe('paid');
    expect(subscriptionRow(sqlite, 'sub-initial')).toMatchObject({
      current_period_start: '2026-11-01',
      current_period_end: '2026-11-30',
    });
  });

  it('rejects a mismatched amount without touching the invoice or the subscription', async () => {
    const { db, sqlite } = createMigratedD1();
    sqlites.push(sqlite);
    seedSubscription(sqlite, {
      tenantId: 'default',
      subscriptionId: 'sub-2',
      invoiceId: 'inv-2',
      orderCode: '700100201',
    });

    const result = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '700100201',
      amountPaid: 1_000_000,
      isPaid: true,
      nowIso: NOW,
    });
    expect(result.handled).toBe(true);
    expect(result.amountMismatch).toBe(true);
    expect(result.message).toBe('Amount mismatch: expected 1500000, received 1000000');

    expect(invoiceRow(sqlite, 'inv-2').status).toBe('pending');
    expect(subscriptionRow(sqlite, 'sub-2').current_period_end).toBe('2026-11-30');
  });

  it('parks a cancelled payment link as failed so the invoice stays retryable', async () => {
    const { db, sqlite } = createMigratedD1();
    sqlites.push(sqlite);
    seedSubscription(sqlite, {
      tenantId: 'default',
      subscriptionId: 'sub-3',
      invoiceId: 'inv-3',
      orderCode: '700100202',
      invoiceStatus: 'processing',
      invoicePeriodStart: '2026-12-01',
      invoicePeriodEnd: '2026-12-31',
    });

    const failed = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '700100202',
      amountPaid: 0,
      isPaid: false,
      nowIso: NOW,
    });
    expect(failed).toEqual({ handled: true, message: 'Marked failed', tenantId: 'default' });
    expect(invoiceRow(sqlite, 'inv-3')).toMatchObject({ status: 'failed', payment_ref: 'payos:700100202' });

    // A later successful callback for the same code still settles.
    const settled = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '700100202',
      amountPaid: 1_500_000,
      isPaid: true,
      nowIso: NOW,
    });
    expect(settled.subscriptionAdvanced).toBe(true);
    expect(invoiceRow(sqlite, 'inv-3').status).toBe('paid');
  });

  it('refuses to advance a subscription that belongs to another tenant', async () => {
    const { db, sqlite } = createMigratedD1();
    sqlites.push(sqlite);
    seedSubscription(sqlite, {
      tenantId: 'tenant-a',
      subscriptionId: 'sub-a',
      invoiceId: 'inv-a',
      orderCode: '700100203',
    });
    // Deliberate cross-tenant data corruption: the invoice claims tenant-a but the
    // subscription row was re-homed to tenant-b.
    sqlite.prepare("UPDATE subscriptions SET tenant_id = 'tenant-b' WHERE id = 'sub-a'").run();

    const result = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '700100203',
      amountPaid: 1_500_000,
      isPaid: true,
      nowIso: NOW,
    });
    expect(result).toEqual({
      handled: true,
      message: 'Subscription unavailable for settlement',
      tenantId: 'tenant-a',
    });
    expect(invoiceRow(sqlite, 'inv-a').status).toBe('pending');
  });

  it('reports handled=false for a code that is not a subscription invoice', async () => {
    const { db, sqlite } = createMigratedD1();
    sqlites.push(sqlite);

    const result = await settleSubscriptionInvoiceByPayOS(db, {
      orderCode: '999999999',
      amountPaid: 1_500_000,
      isPaid: true,
      nowIso: NOW,
    });
    expect(result).toEqual({ handled: false, message: 'Not a subscription invoice' });
  });

  it('settles through POST /api/saas/billing/webhook/payos end to end', async () => {
    const { db, sqlite } = createMigratedD1();
    sqlites.push(sqlite);
    seedSubscription(sqlite, {
      tenantId: 'default',
      subscriptionId: 'sub-wh',
      invoiceId: 'inv-wh',
      orderCode: '700100204',
      invoicePeriodStart: '2026-12-01',
      invoicePeriodEnd: '2026-12-31',
    });

    const kv = createMemoryKV();
    const env = {
      AURA_DB: db,
      AUTH_KV: kv,
      CACHE_KV: kv,
      JWT_SECRET,
      SAAS_PAYOS_CHECKSUM_KEY: SAAS_PAYOS_CHECKSUM,
      SAAS_PLATFORM_DOMAIN: 'auraspace.cafe',
      FE_BASE_URL: 'https://auraspace.cafe',
      ENVIRONMENT: 'production',
    } as unknown as Env;

    const data = { orderCode: 700100204, amount: 1_500_000, code: '00' };
    const canonical = Object.keys(data)
      .sort()
      .map((key) => `${key}=${String((data as Record<string, unknown>)[key])}`)
      .join('&');
    const signature = await computeHmacSha256Hex(SAAS_PAYOS_CHECKSUM, canonical);

    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
    const send = () =>
      app.fetch(
        new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, data, signature }),
        }),
        env,
        ctx
      );

    const res = await send();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { message: string }).message).toBe('Subscription renewed');
    expect(invoiceRow(sqlite, 'inv-wh').status).toBe('paid');

    const replay = await send();
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { message: string }).message).toBe('Already processed');
    expect(subscriptionRow(sqlite, 'sub-wh').current_period_end).toBe('2026-12-30');
  });
});
