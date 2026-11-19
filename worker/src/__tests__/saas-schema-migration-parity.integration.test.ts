// @vitest-environment node
/**
 * SaaS Commercial v3 — Dual-Path Schema & Migration Parity Suite
 *
 * Verifies two independent database initialization paths:
 *   1. Fresh install from `worker/schema.sql` and `db/schema.sql` (no migration needed)
 *   2. Upgrade from pre-v3 schema (`fixtures/pre-v3-schema.sql`) by running
 *      `worker/db/migrations/20261119_01_saas_commercial_v3.sql` verbatim
 *      (must fail loudly on duplicate columns — never swallowed).
 *
 * Compares resulting SaaS tables, columns, and indexes across all paths and runs
 * the complete end-to-end SaaS billing lifecycle on each path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { app } from '../index';
import type { Env } from '../types/env';
import { computeHmacSha256Hex } from '../lib/tenant-secrets';
import { calculatePlanAmountVnd } from '../lib/saas-plans';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const WORKER_SCHEMA_PATH = path.join(REPO_ROOT, 'worker/schema.sql');
const DB_SCHEMA_PATH = path.join(REPO_ROOT, 'db/schema.sql');
const PRE_V3_SCHEMA_PATH = path.join(__dirname, 'fixtures/pre-v3-schema.sql');
const V3_MIGRATION_PATH = path.join(REPO_ROOT, 'worker/db/migrations/20261119_01_saas_commercial_v3.sql');

const SAAS_TABLES = [
  'saas_tenants',
  'tenant_subscriptions',
  'tenant_branding',
  'tenant_domains',
  'tenant_payment_configs',
  'tenant_invoices',
  'saas_billing_transactions',
  'saas_audit_logs',
] as const;

const REQUIRED_SAAS_INDEXES = [
  'idx_saas_tenants_subdomain',
  'idx_tenant_subscriptions_tenant_id',
  'idx_tenant_subscriptions_status',
  'idx_tenant_domains_tenant_id',
  'idx_tenant_domains_status',
  'idx_tenant_invoices_tenant_id',
  'idx_tenant_invoices_status',
  'idx_tenant_invoices_payos_order_code',
  'idx_saas_billing_txn_tenant',
  'idx_saas_billing_txn_status',
  'idx_saas_audit_logs_tenant',
  'idx_saas_audit_logs_created',
] as const;

const JWT_SECRET = 'saas-schema-parity-test-jwt-secret-32chars!';
const TENANT_SECRETS_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
const SAAS_PAYOS_CHECKSUM = 'saas-parity-payos-checksum-secret';

function createMemoryKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      return type === 'json' ? JSON.parse(val) : val;
    },
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

function wrapSqliteAsD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    const createBound = (params: unknown[]) => ({
      bind: (...nextParams: unknown[]) => createBound(nextParams),
      first: async <T = Record<string, unknown>>() => {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(params as (string | number | null)[]));
        return (row ?? null) as T | null;
      },
      all: async <T = Record<string, unknown>>() => {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...(params as (string | number | null)[]));
        return { success: true, results: results as T[], meta: { changes: 0, last_row_id: 0 } };
      },
      run: async () => {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(params as (string | number | null)[]));
        return {
          success: true,
          results: [],
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
      raw: async () => [],
    });
    return createBound([]);
  };

  let batchQueue: Promise<unknown> = Promise.resolve();
  let savepointSeq = 0;

  return {
    prepare,
    batch: (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const runBatch = async () => {
        const sp = `d1_parity_${++savepointSeq}`;
        sqlite.exec(`SAVEPOINT ${sp}`);
        try {
          const out = [];
          for (const s of stmts) {
            out.push(await s.run());
          }
          sqlite.exec(`RELEASE SAVEPOINT ${sp}`);
          return out;
        } catch (e) {
          sqlite.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
          sqlite.exec(`RELEASE SAVEPOINT ${sp}`);
          throw e;
        }
      };
      const next = batchQueue.then(runBatch, runBatch);
      batchQueue = next.catch(() => {});
      return next;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function buildEnv(db: D1Database): Env {
  const kv = createMemoryKV();
  return {
    AURA_DB: db,
    AUTH_KV: kv,
    CACHE_KV: kv,
    JWT_SECRET,
    TENANT_SECRETS_KEY,
    SAAS_PLATFORM_DOMAIN: 'auraspace.cafe',
    FE_BASE_URL: 'https://auraspace.cafe',
    ENVIRONMENT: 'production',
    SAAS_PAYOS_CLIENT_ID: 'saas-parity-client',
    SAAS_PAYOS_API_KEY: 'saas-parity-api-key',
    SAAS_PAYOS_CHECKSUM_KEY: SAAS_PAYOS_CHECKSUM,
  } as unknown as Env;
}

const dummyCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function inspectSaasSchema(sqlite: DatabaseSync) {
  const tables: Record<string, string[]> = {};
  for (const table of SAAS_TABLES) {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    tables[table] = cols.map((c) => c.name).sort();
  }
  const idxRows = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%'`)
    .all() as Array<{ name: string }>;
  const indexes = new Set(idxRows.map((r) => r.name));
  return { tables, indexes };
}

async function signPayosData(data: Record<string, unknown>, checksumKey: string): Promise<string> {
  const sorted = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k] ?? ''}`)
    .join('&');
  return computeHmacSha256Hex(checksumKey, sorted);
}

async function verifyBillingFlowOnSqlite(sqlite: DatabaseSync, slug: string) {
  const db = wrapSqliteAsD1(sqlite);
  const env = buildEnv(db);

  // 1. Self-serve signup
  const signupRes = await app.fetch(
    new Request('https://auraspace.cafe/api/saas/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: `Shop ${slug}`,
        slug,
        ownerName: 'Chủ Quán Parity',
        ownerEmail: `${slug}@example.com`,
        ownerPhone: '0901234567',
        password: 'StrongPassword123!',
        templateId: 'traditional-cafe',
      }),
    }),
    env,
    dummyCtx
  );
  expect(signupRes.status).toBe(201);
  const signupBody = (await signupRes.json()) as {
    data: { tenantId: string; slug: string; token: string };
  };

  // 2. Create PayOS SaaS billing checkout invoice (mocking outbound PayOS API)
  const expectedAmount = calculatePlanAmountVnd('pro', 'monthly');
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        code: '00',
        data: { checkoutUrl: 'https://pay.payos.vn/web/parity-test' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );

  const checkoutRes = await app.fetch(
    new Request('https://auraspace.cafe/api/saas/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signupBody.data.token}`,
        'X-Tenant-ID': signupBody.data.tenantId,
      },
      body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
    }),
    env,
    dummyCtx
  );
  expect(checkoutRes.status).toBe(201);
  const checkoutBody = (await checkoutRes.json()) as {
    data: { invoiceId: string; payosOrderCode: string; amountVnd: number };
  };
  expect(checkoutBody.data.amountVnd).toBe(expectedAmount);

  // 3. Confirm payment via PayOS SaaS webhook
  const webhookData = {
    orderCode: Number(checkoutBody.data.payosOrderCode),
    amount: expectedAmount,
    code: '00',
  };
  const sig = await signPayosData(webhookData, SAAS_PAYOS_CHECKSUM);
  const webhookRes = await app.fetch(
    new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: webhookData, signature: sig }),
    }),
    env,
    dummyCtx
  );
  expect(webhookRes.status).toBe(200);
  expect(((await webhookRes.json()) as { message: string }).message).toBe('SaaS subscription activated');

  // 4. Verify persisted billing state across all 4 tables
  const invoice = sqlite
    .prepare('SELECT status, paid_at FROM tenant_invoices WHERE id = ?')
    .get(checkoutBody.data.invoiceId) as { status: string; paid_at: string | null };
  expect(invoice.status).toBe('paid');
  expect(invoice.paid_at).toBeTruthy();

  const sub = sqlite
    .prepare('SELECT status, tier, current_period_end FROM tenant_subscriptions WHERE tenant_id = ?')
    .get(signupBody.data.tenantId) as { status: string; tier: string; current_period_end: string };
  expect(sub.status).toBe('active');
  expect(sub.tier).toBe('pro');

  const tenant = sqlite
    .prepare('SELECT status, tier, current_period_end FROM saas_tenants WHERE id = ?')
    .get(signupBody.data.tenantId) as { status: string; tier: string; current_period_end: string };
  expect(tenant.status).toBe('active');
  expect(tenant.tier).toBe('pro');
  expect(tenant.current_period_end).toBe(sub.current_period_end);

  const auditCount = sqlite
    .prepare(
      `SELECT COUNT(*) AS cnt FROM saas_audit_logs
       WHERE tenant_id = ? AND action = 'subscription_activated'`
    )
    .get(signupBody.data.tenantId) as { cnt: number };
  expect(Number(auditCount.cnt)).toBe(1);
}

describe('SaaS Commercial v3 — Fresh Schema vs Pre-v3 Upgrade Migration Parity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces identical SaaS v3 tables, columns, and indexes across fresh worker/schema.sql, fresh db/schema.sql, and strict pre-v3 upgrade migration', () => {
    const workerSchemaSql = fs.readFileSync(WORKER_SCHEMA_PATH, 'utf8');
    const dbSchemaSql = fs.readFileSync(DB_SCHEMA_PATH, 'utf8');
    const preV3SchemaSql = fs.readFileSync(PRE_V3_SCHEMA_PATH, 'utf8');
    const migrationSql = fs.readFileSync(V3_MIGRATION_PATH, 'utf8');

    // Path 1: Fresh worker/schema.sql
    const freshWorker = new DatabaseSync(':memory:');
    freshWorker.exec(workerSchemaSql);

    // Path 2: Fresh db/schema.sql
    const freshDb = new DatabaseSync(':memory:');
    freshDb.exec(dbSchemaSql);

    // Path 3: Upgrade from pre-v3 schema by running the migration VERBATIM (must NOT swallow duplicate column errors)
    const upgraded = new DatabaseSync(':memory:');
    upgraded.exec(preV3SchemaSql);
    upgraded.exec(migrationSql);

    const workerInfo = inspectSaasSchema(freshWorker);
    const dbInfo = inspectSaasSchema(freshDb);
    const upgradedInfo = inspectSaasSchema(upgraded);

    // All 3 paths must have identical column sets for every SaaS v3 table (including tenant_invoices)
    for (const table of SAAS_TABLES) {
      expect(workerInfo.tables[table].length, `${table} missing in worker/schema.sql`).toBeGreaterThan(0);
      expect(dbInfo.tables[table], `${table} mismatch between worker/schema.sql and db/schema.sql`).toEqual(
        workerInfo.tables[table]
      );
      expect(upgradedInfo.tables[table], `${table} mismatch between worker/schema.sql and pre-v3+migration`).toEqual(
        workerInfo.tables[table]
      );
    }

    // All required indexes (including tenant_invoices indexes) must exist on all 3 paths
    for (const idx of REQUIRED_SAAS_INDEXES) {
      expect(workerInfo.indexes.has(idx), `${idx} missing in worker/schema.sql`).toBe(true);
      expect(dbInfo.indexes.has(idx), `${idx} missing in db/schema.sql`).toBe(true);
      expect(upgradedInfo.indexes.has(idx), `${idx} missing in upgraded pre-v3 DB`).toBe(true);
    }

    // Strictness proof: re-running the migration on an already-upgraded DB MUST throw duplicate column name
    expect(() => upgraded.exec(migrationSql)).toThrow(/duplicate column name/i);
  });

  it('executes the full SaaS billing lifecycle cleanly on fresh worker/schema.sql', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(fs.readFileSync(WORKER_SCHEMA_PATH, 'utf8'));
    await verifyBillingFlowOnSqlite(sqlite, 'parity-fresh-worker');
  });

  it('executes the full SaaS billing lifecycle cleanly on fresh db/schema.sql', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(fs.readFileSync(DB_SCHEMA_PATH, 'utf8'));
    await verifyBillingFlowOnSqlite(sqlite, 'parity-fresh-db');
  });

  it('executes the full SaaS billing lifecycle cleanly on pre-v3 schema upgraded verbatim with v3 migration', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(fs.readFileSync(PRE_V3_SCHEMA_PATH, 'utf8'));
    sqlite.exec(fs.readFileSync(V3_MIGRATION_PATH, 'utf8'));
    await verifyBillingFlowOnSqlite(sqlite, 'parity-upgraded-v3');
  });
});
