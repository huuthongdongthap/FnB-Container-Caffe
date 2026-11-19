// @vitest-environment node
/**
 * SaaS Commercial v3 — Full-Stack Multi-Tenant Hardening & Integration Suite
 *
 * Executes against the real unified Hono `app` (`worker/src/index.ts`) backed by
 * `node:sqlite` loaded with `worker/schema.sql` + `worker/db/migrations/20261119_02_saas_commercial_v3.sql`.
 *
 * Verifies all commercial go-live gates:
 *  1. 2-tenant self-serve signup, isolated menu/orders/KDS/export, custom domain & subdomain routing, flagship immunity
 *  2. Global `saasWriteGuard` + `requireAuth` enforcement (HTTP 402 `subscription_expired_readonly`) with spoof-proof JWT binding & safe exemptions
 *  3. Strict `SAAS_PAYOS_*` isolation (never falls back to flagship `PAYOS_*`, fails fast 503) + per-tenant drink payment webhook isolation
 *  4. SaaS renewal webhook: `max(now, current_period_end)` period stacking, exact amount match (409 on under/overpay), and single-winner idempotency
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

const JWT_SECRET = 'saas-commercial-v3-integration-jwt-secret-32ch!';
const TENANT_SECRETS_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const FLAGSHIP_PAYOS_CLIENT_ID = 'flagship-payos-client';
const FLAGSHIP_PAYOS_API_KEY = 'flagship-payos-api-key';
const FLAGSHIP_PAYOS_CHECKSUM = 'flagship-payos-checksum-secret-never-use-for-saas';
const SAAS_PAYOS_CLIENT_ID = 'saas-platform-client-id';
const SAAS_PAYOS_API_KEY = 'saas-platform-api-key';
const SAAS_PAYOS_CHECKSUM = 'saas-platform-checksum-secret-dedicated';

function createMemoryKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
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

function createMigratedD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  const repoRoot = path.resolve(__dirname, '../../..');
  const baseSchema = fs.readFileSync(path.join(repoRoot, 'worker/schema.sql'), 'utf8');
  sqlite.exec(baseSchema);

  // Ensure auth_version exists on users for staff session verification
  for (const colDef of ['auth_version INTEGER DEFAULT 1', 'is_active INTEGER DEFAULT 1']) {
    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${colDef}`);
    } catch {
      // already exists
    }
  }

  // Seed flagship default product & table so flagship immunity can be verified
  sqlite.exec(`
    INSERT OR IGNORE INTO categories (id, name, slug, sort_order, is_active, tenant_id)
    VALUES ('cat_default_1', 'Cà Phê Sa Đéc', 'ca-phe-sa-dec', 1, 1, 'default');
    INSERT OR IGNORE INTO products (id, category_id, name, price, is_available, tenant_id)
    VALUES ('prod_default_1', 'cat_default_1', 'Cà Phê Sữa Đá AURA', 35000, 1, 'default');
    INSERT OR IGNORE INTO cafe_tables (id, table_number, name, zone, capacity, status, is_active, tenant_id)
    VALUES ('tbl_default_1', 1, 'Bàn 1', 'Tầng 1', 4, 'available', 1, 'default');
  `);

  const prepare = (sql: string) => {
    const createBound = (params: unknown[]) => ({
      bind: (...next: unknown[]) => createBound(next),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] ?? null) as unknown) as T;
        return (row as unknown) as T;
      },
      all: async <T = Record<string, unknown>>() => {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...(params as never[])) as unknown as T[];
        return { results, success: true, meta: { changes: 0 } };
      },
      run: async () => {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(params as never[]));
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

  const db = {
    prepare,
    batch: (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const runBatch = async () => {
        const sp = `d1_batch_${++savepointSeq}`;
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

  return { db, sqlite };
}

function buildEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
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
    PAYOS_CLIENT_ID: FLAGSHIP_PAYOS_CLIENT_ID,
    PAYOS_API_KEY: FLAGSHIP_PAYOS_API_KEY,
    PAYOS_CHECKSUM_KEY: FLAGSHIP_PAYOS_CHECKSUM,
    SAAS_PAYOS_CLIENT_ID,
    SAAS_PAYOS_API_KEY,
    SAAS_PAYOS_CHECKSUM_KEY: SAAS_PAYOS_CHECKSUM,
    ...overrides,
  } as unknown as Env;
}

const dummyCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

async function signPayosData(data: Record<string, unknown>, checksumKey: string): Promise<string> {
  const sortedKeys = Object.keys(data).sort();
  const raw = sortedKeys
    .map((k) => {
      const val = data[k];
      if (val === null || val === undefined) return `${k}=`;
      if (typeof val === 'object') return `${k}=${JSON.stringify(val)}`;
      return `${k}=${String(val)}`;
    })
    .join('&');
  return computeHmacSha256Hex(checksumKey, raw);
}

async function signupTenant(
  env: Env,
  input: { slug: string; shopName: string; ownerEmail: string; planId?: string; templateId?: string }
) {
  const res = await app.fetch(
    new Request('https://auraspace.cafe/api/saas/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: input.shopName,
        slug: input.slug,
        ownerName: `Chủ ${input.shopName}`,
        ownerEmail: input.ownerEmail,
        ownerPhone: '0901234567',
        password: 'StrongPassword#2026',
        templateId: input.templateId || 'traditional-cafe',
        planId: input.planId || 'pro',
      }),
    }),
    env,
    dummyCtx
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as {
    success: boolean;
    data: { tenantId: string; slug: string; ownerId: string; trialEndsAt: string; token: string };
  };
  expect(body.success).toBe(true);
  expect(body.data.token).toBeTruthy();
  return { ...body, token: body.data.token };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SaaS Commercial Hardening — Multi-Tenant Isolation, Write Guard & Billing', () => {
  it('isolates 2 self-serve tenants across storefront, subdomain/custom domain, orders, KDS & export while keeping flagship intact', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const tenantA = await signupTenant(env, {
      slug: 'ca-phe-mekong-a',
      shopName: 'Cà Phê Mekong A',
      ownerEmail: 'owner-a@mekong.vn',
      planId: 'pro',
    });
    const tenantB = await signupTenant(env, {
      slug: 'tra-sua-saigon-b',
      shopName: 'Trà Sữa Sài Gòn B',
      ownerEmail: 'owner-b@saigon.vn',
      planId: 'starter',
      templateId: 'milk-tea-shop',
    });

    expect(tenantA.data.tenantId).not.toBe(tenantB.data.tenantId);

    // Fetch storefront menus for A and B
    const sfARes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/storefront/ca-phe-mekong-a'),
      env,
      dummyCtx
    );
    expect(sfARes.status).toBe(200);
    const sfA = (await sfARes.json()) as {
      data: { tenant: { id: string }; products: Array<{ id: string; name: string; price: number }> };
    };
    const prodA = sfA.data.products[0];
    expect(prodA).toBeTruthy();

    const sfBRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/storefront/tra-sua-saigon-b'),
      env,
      dummyCtx
    );
    expect(sfBRes.status).toBe(200);
    const sfB = (await sfBRes.json()) as {
      data: { tenant: { id: string }; products: Array<{ id: string; name: string; price: number }> };
    };
    const prodB = sfB.data.products[0];
    expect(prodB).toBeTruthy();
    expect(prodA.id).not.toBe(prodB.id);

    // Verify subdomain resolution (`ca-phe-mekong-a.auraspace.cafe`) creates guest takeaway order in Tenant A
    const guestOrderARes = await app.fetch(
      new Request('https://ca-phe-mekong-a.auraspace.cafe/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: 'ca-phe-mekong-a.auraspace.cafe',
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cod',
          total: prodA.price * 2,
          customer_name: 'Khách Mekong A',
          customer_phone: '0911111111',
          items: [{ id: prodA.id, name: prodA.name, price: prodA.price, quantity: 2 }],
        }),
      }),
      env,
      dummyCtx
    );
    expect(guestOrderARes.status).toBe(201);
    const guestOrderAJson = (await guestOrderARes.json()) as {
      orderId?: string;
      id?: string;
      order?: { id: string };
      data?: { id?: string; orderId?: string };
    };
    const guestOrderAId =
      guestOrderAJson.orderId || guestOrderAJson.id || guestOrderAJson.order?.id || guestOrderAJson.data?.id || guestOrderAJson.data?.orderId;
    expect(guestOrderAId).toBeTruthy();

    // Verify verified custom domain resolution (`order.trasuab.vn`) routes to Tenant B
    sqlite
      .prepare(
        `INSERT INTO tenant_domains (id, tenant_id, domain, verification_token, status, verified_at)
         VALUES ('dom_b_1', ?, 'order.trasuab.vn', 'tok_b', 'verified', datetime('now'))`
      )
      .run(tenantB.data.tenantId);

    const guestOrderBRes = await app.fetch(
      new Request('https://order.trasuab.vn/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: 'order.trasuab.vn',
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cod',
          total: prodB.price,
          customer_name: 'Khách Sài Gòn B',
          customer_phone: '0922222222',
          items: [{ id: prodB.id, name: prodB.name, price: prodB.price, quantity: 1 }],
        }),
      }),
      env,
      dummyCtx
    );
    expect(guestOrderBRes.status).toBe(201);
    const guestOrderBJson = (await guestOrderBRes.json()) as {
      orderId?: string;
      id?: string;
      order?: { id: string };
      data?: { id?: string; orderId?: string };
    };
    const guestOrderBId =
      guestOrderBJson.orderId || guestOrderBJson.id || guestOrderBJson.order?.id || guestOrderBJson.data?.id || guestOrderBJson.data?.orderId;
    expect(guestOrderBId).toBeTruthy();

    // Cross-tenant product injection attempt: ordering Tenant B's product on Tenant A must fail
    const crossProdRes = await app.fetch(
      new Request('https://ca-phe-mekong-a.auraspace.cafe/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: 'ca-phe-mekong-a.auraspace.cafe',
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cod',
          total: prodB.price,
          customer_name: 'Cross Product Probe',
          customer_phone: '0933333333',
          items: [{ id: prodB.id, name: prodB.name, price: prodB.price, quantity: 1 }],
        }),
      }),
      env,
      dummyCtx
    );
    expect(crossProdRes.status).toBe(400);

    // Owner A only sees Tenant A's order; Owner B only sees Tenant B's order
    const adminOrdersARes = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/orders', {
        headers: { Authorization: `Bearer ${tenantA.token}` },
      }),
      env,
      dummyCtx
    );
    expect(adminOrdersARes.status).toBe(200);
    const adminOrdersA = (await adminOrdersARes.json()) as { orders: Array<{ id: string }> };
    expect(adminOrdersA.orders.map((o) => o.id)).toContain(guestOrderAId);
    expect(adminOrdersA.orders.map((o) => o.id)).not.toContain(guestOrderBId);

    // Owner A attempting `?tenant_id=<tenantB>` override on KDS must be rejected 403
    const kdsCrossRes = await app.fetch(
      new Request(`https://auraspace.cafe/api/orders/kds?tenant_id=${tenantB.data.tenantId}`, {
        headers: { Authorization: `Bearer ${tenantA.token}` },
      }),
      env,
      dummyCtx
    );
    expect(kdsCrossRes.status).toBe(403);

    // Flagship `default` order creation at `/` continues to work unaffected
    const flagshipOrderRes = await app.fetch(
      new Request('https://auraspace.cafe/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cod',
          total: 35000,
          customer_name: 'Khách Sa Đéc Flagship',
          customer_phone: '0999888777',
          items: [{ id: 'prod_default_1', name: 'Cà Phê Sữa Đá AURA', price: 35000, quantity: 1 }],
        }),
      }),
      env,
      dummyCtx
    );
    expect(flagshipOrderRes.status).toBe(201);
  });

  it('enforces HTTP 402 subscription_expired_readonly on expired/suspended tenants across guest & JWT writes while preserving reads, export & billing', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const tenant = await signupTenant(env, {
      slug: 'quan-het-han',
      shopName: 'Quán Hết Hạn Trial',
      ownerEmail: 'expired@quan.vn',
      planId: 'starter',
    });

    const sfRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/storefront/quan-het-han'),
      env,
      dummyCtx
    );
    const sf = (await sfRes.json()) as { data: { products: Array<{ id: string; name: string; price: number }> } };
    const prod = sf.data.products[0];

    // Fast-forward past 14-day trial + 3-day grace window (20 days in the past)
    const pastTrial = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const pastGrace = new Date(Date.now() - 17 * 86_400_000).toISOString();
    sqlite
      .prepare(
        `UPDATE tenant_subscriptions
         SET status = 'trial', trial_ends_at = ?, current_period_end = ?, grace_ends_at = ?
         WHERE tenant_id = ?`
      )
      .run(pastTrial, pastTrial, pastGrace, tenant.data.tenantId);
    sqlite
      .prepare(`UPDATE saas_tenants SET status = 'trial', trial_ends_at = ?, current_period_end = ? WHERE id = ?`)
      .run(pastTrial, pastTrial, tenant.data.tenantId);

    // 1. Guest storefront order via subdomain -> 402 subscription_expired_readonly
    const guestBlockedRes = await app.fetch(
      new Request('https://quan-het-han.auraspace.cafe/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: 'quan-het-han.auraspace.cafe',
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cod',
          total: prod.price,
          customer_name: 'Khách Thử Đặt',
          customer_phone: '0944444444',
          items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
        }),
      }),
      env,
      dummyCtx
    );
    expect(guestBlockedRes.status).toBe(402);
    const guestBlockedJson = (await guestBlockedRes.json()) as { code: string; lifecycleState: string };
    expect(guestBlockedJson.code).toBe('subscription_expired_readonly');
    expect(guestBlockedJson.lifecycleState).toBe('readonly');

    // 2. Authenticated owner write (even when spoofing `X-Tenant-ID: default`!) -> 402 via requireAuth JWT check
    const ownerSpoofWriteRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant.token}`,
          'X-Tenant-ID': 'default',
        },
        body: JSON.stringify({ displayName: 'Spoof Attempt' }),
      }),
      env,
      dummyCtx
    );
    expect(ownerSpoofWriteRes.status).toBe(402);

    // 3. Authenticated owner creating order -> 402 via createOrder authoritative JWT guard
    const ownerOrderWriteRes = await app.fetch(
      new Request('https://auraspace.cafe/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant.token}`,
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cod',
          total: prod.price,
          customer_name: 'Chủ Tạo Đơn',
          customer_phone: '0955555555',
          items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
        }),
      }),
      env,
      dummyCtx
    );
    expect(ownerOrderWriteRes.status).toBe(402);

    // 4. Safe read/export/billing exemptions remain accessible (200)
    const readOrdersRes = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/orders', {
        headers: { Authorization: `Bearer ${tenant.token}` },
      }),
      env,
      dummyCtx
    );
    expect(readOrdersRes.status).toBe(200);

    const exportRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/export', {
        headers: { Authorization: `Bearer ${tenant.token}` },
      }),
      env,
      dummyCtx
    );
    expect(exportRes.status).toBe(200);

    const billingStatusRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/billing/status', {
        headers: { Authorization: `Bearer ${tenant.token}` },
      }),
      env,
      dummyCtx
    );
    expect(billingStatusRes.status).toBe(200);

    // 5. Flagship `default` remains 100% writable even if someone inserts an expired row for 'default'
    sqlite
      .prepare(
        `INSERT OR REPLACE INTO saas_tenants (id, name, slug, tier, status, trial_ends_at, current_period_end)
         VALUES ('default', 'AURA Sa Đéc', 'default', 'chain', 'suspended', ?, ?)`
      )
      .run(pastTrial, pastTrial);

    const flagshipRes = await app.fetch(
      new Request('https://auraspace.cafe/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cod',
          total: 35000,
          customer_name: 'Flagship Immune',
          customer_phone: '0988777666',
          items: [{ id: 'prod_default_1', name: 'Cà Phê Sữa Đá AURA', price: 35000, quantity: 1 }],
        }),
      }),
      env,
      dummyCtx
    );
    expect(flagshipRes.status).toBe(201);
  });

  it('never falls back from SAAS_PAYOS_* to flagship PAYOS_* and isolates per-tenant drink payment webhooks', async () => {
    const { db, sqlite } = createMigratedD1();
    // Env has flagship PAYOS_* populated, but SAAS_PAYOS_* intentionally missing
    const envWithoutSaasPayos = buildEnv(db, {
      SAAS_PAYOS_CLIENT_ID: undefined,
      SAAS_PAYOS_API_KEY: undefined,
      SAAS_PAYOS_CHECKSUM_KEY: undefined,
    });

    const tenantA = await signupTenant(envWithoutSaasPayos, {
      slug: 'quan-payos-a',
      shopName: 'Quán PayOS A',
      ownerEmail: 'payos-a@quan.vn',
    });
    const tenantB = await signupTenant(envWithoutSaasPayos, {
      slug: 'quan-payos-b',
      shopName: 'Quán PayOS B',
      ownerEmail: 'payos-b@quan.vn',
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // 1. Checkout fails fast with 503 `saas_billing_not_configured` — zero PayOS API calls, zero orphan invoices
    const checkoutMissingRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantA.token}`,
        },
        body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
      }),
      envWithoutSaasPayos,
      dummyCtx
    );
    expect(checkoutMissingRes.status).toBe(503);
    const checkoutMissingJson = (await checkoutMissingRes.json()) as { code: string };
    expect(checkoutMissingJson.code).toBe('saas_billing_not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();

    const invoiceCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM tenant_invoices').get() as { cnt: number };
    expect(Number(invoiceCount.cnt)).toBe(0);

    // 2. SaaS billing webhook fails fast with 503 when SAAS_PAYOS_CHECKSUM_KEY is unset (even if signed with flagship PAYOS_CHECKSUM_KEY!)
    const forgedData = { orderCode: 123456, amount: 499000, code: '00' };
    const flagshipSig = await signPayosData(forgedData, FLAGSHIP_PAYOS_CHECKSUM);
    const webhookMissingRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: forgedData, signature: flagshipSig }),
      }),
      envWithoutSaasPayos,
      dummyCtx
    );
    expect(webhookMissingRes.status).toBe(503);

    // 3. Configure per-tenant drink PayOS credentials for Tenant A & Tenant B (encrypted AES-256-GCM)
    const fullEnv = buildEnv(db);
    const savePayARes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/payment-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantA.token}`,
        },
        body: JSON.stringify({
          provider: 'payos',
          bankBin: '970422',
          bankName: 'MB Bank',
          bankAccountNo: '111122223333',
          bankAccountName: 'QUAN PAYOS A',
          payosClientId: 'cli_a',
          payosApiKey: 'api_a',
          payosChecksumKey: 'checksum_secret_tenant_a_only',
        }),
      }),
      fullEnv,
      dummyCtx
    );
    expect(savePayARes.status).toBe(200);

    // Verify raw secret is NOT stored in plaintext in D1
    const rawRow = sqlite
      .prepare('SELECT payos_checksum_key_enc FROM tenant_payment_configs WHERE tenant_id = ?')
      .get(tenantA.data.tenantId) as { payos_checksum_key_enc: string };
    expect(rawRow.payos_checksum_key_enc).not.toContain('checksum_secret_tenant_a_only');

    // Webhook to Tenant A signed with Flagship checksum key must be rejected (401)
    const drinkData = {
      orderCode: 998877,
      amount: 45000,
      description: 'ORD1',
      accountNumber: '111122223333',
      reference: 'REF1',
      transactionDateTime: '2026-11-19 10:00:00',
      currency: 'VND',
      paymentLinkId: 'plink_1',
      code: '00',
      desc: 'success',
    };
    const wrongDrinkSig = await signPayosData(drinkData, FLAGSHIP_PAYOS_CHECKSUM);
    const tenantADrinkReject = await app.fetch(
      new Request(`https://auraspace.cafe/api/webhook/payos/${tenantA.data.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '00',
          desc: 'success',
          success: true,
          data: drinkData,
          signature: wrongDrinkSig,
        }),
      }),
      fullEnv,
      dummyCtx
    );
    expect(tenantADrinkReject.status).toBe(401);

    // Tenant B has NOT configured PayOS -> drink webhook to Tenant B must NOT fall back to Flagship PAYOS_CHECKSUM_KEY
    const tenantBUnconfiguredRes = await app.fetch(
      new Request(`https://auraspace.cafe/api/webhook/payos/${tenantB.data.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '00',
          desc: 'success',
          success: true,
          data: drinkData,
          signature: wrongDrinkSig,
        }),
      }),
      fullEnv,
      dummyCtx
    );
    expect([400, 401, 503]).toContain(tenantBUnconfiguredRes.status);
  });

  it('stacks early renewal from max(now, current_period_end), rejects under/overpaid amounts (409), and is idempotent under replay', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const tenant = await signupTenant(env, {
      slug: 'quan-gia-han',
      shopName: 'Quán Gia Hạn Sớm',
      ownerEmail: 'renew@quan.vn',
      planId: 'pro',
    });

    // Set current active subscription with 10 days remaining in the future
    const tenDaysAheadMs = Date.now() + 10 * 86_400_000;
    const tenDaysAheadIso = new Date(tenDaysAheadMs).toISOString();
    sqlite
      .prepare(
        `UPDATE tenant_subscriptions
         SET status = 'active', tier = 'pro', current_period_end = ?
         WHERE tenant_id = ?`
      )
      .run(tenDaysAheadIso, tenant.data.tenantId);
    sqlite
      .prepare(`UPDATE saas_tenants SET status = 'active', tier = 'pro', current_period_end = ? WHERE id = ?`)
      .run(tenDaysAheadIso, tenant.data.tenantId);

    // Mock PayOS link creation for `/api/saas/billing/checkout`
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: '00',
          data: {
            checkoutUrl: 'https://pay.payos.vn/web/mock-saas-checkout',
            qrCode: '000201010212MOCKQR',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const expectedAmount = calculatePlanAmountVnd('pro', 'monthly'); // 499_000
    const checkoutRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant.token}`,
        },
        body: JSON.stringify({
          planId: 'pro',
          billingCycle: 'monthly',
          amount: 1000, // tampered client amount must be ignored!
        }),
      }),
      env,
      dummyCtx
    );
    expect(checkoutRes.status).toBe(201);
    const checkoutBody = (await checkoutRes.json()) as {
      data: { invoiceId: string; payosOrderCode: string; amountVnd: number };
    };
    expect(checkoutBody.data.amountVnd).toBe(expectedAmount);
    const orderCode = Number(checkoutBody.data.payosOrderCode);

    // 1. Underpayment -> 409 amount_mismatch
    const underpayData = { orderCode, amount: expectedAmount - 1000, code: '00' };
    const underpaySig = await signPayosData(underpayData, SAAS_PAYOS_CHECKSUM);
    const underpayRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: underpayData, signature: underpaySig }),
      }),
      env,
      dummyCtx
    );
    expect(underpayRes.status).toBe(409);

    // 2. Overpayment -> 409 amount_mismatch (exact match required)
    const overpayData = { orderCode, amount: expectedAmount + 5000, code: '00' };
    const overpaySig = await signPayosData(overpayData, SAAS_PAYOS_CHECKSUM);
    const overpayRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: overpayData, signature: overpaySig }),
      }),
      env,
      dummyCtx
    );
    expect(overpayRes.status).toBe(409);

    // 3. Valid exact-amount webhook -> extends from `tenDaysAhead` (+30d = ~40 days from now, NOT 30 days!)
    const validData = { orderCode, amount: expectedAmount, code: '00' };
    const validSig = await signPayosData(validData, SAAS_PAYOS_CHECKSUM);
    const validWebhookReq = () =>
      app.fetch(
        new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, data: validData, signature: validSig }),
        }),
        env,
        dummyCtx
      );

    const firstRes = await validWebhookReq();
    expect(firstRes.status).toBe(200);
    const firstJson = (await firstRes.json()) as { message: string };
    expect(firstJson.message).toBe('SaaS subscription activated');

    const updatedSub = sqlite
      .prepare('SELECT current_period_end, grace_ends_at, status FROM tenant_subscriptions WHERE tenant_id = ?')
      .get(tenant.data.tenantId) as { current_period_end: string; grace_ends_at: string; status: string };
    expect(updatedSub.status).toBe('active');

    const expectedStackedMs = tenDaysAheadMs + 30 * 86_400_000;
    const actualPeriodEndMs = Date.parse(updatedSub.current_period_end);
    // Must match tenDaysAhead + 30 days within 2 seconds tolerance
    expect(Math.abs(actualPeriodEndMs - expectedStackedMs)).toBeLessThan(2000);

    // 4. Replay / duplicate delivery -> idempotent: period_end unchanged, audit log count stays 1
    const replayRes1 = await validWebhookReq();
    const replayRes2 = await validWebhookReq();
    expect(replayRes1.status).toBe(200);
    expect(replayRes2.status).toBe(200);
    const replayJson = (await replayRes1.json()) as { message: string };
    expect(replayJson.message).toBe('Already processed');

    const afterReplaySub = sqlite
      .prepare('SELECT current_period_end FROM tenant_subscriptions WHERE tenant_id = ?')
      .get(tenant.data.tenantId) as { current_period_end: string };
    expect(afterReplaySub.current_period_end).toBe(updatedSub.current_period_end);

    const auditRows = sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt FROM saas_audit_logs
         WHERE tenant_id = ? AND action = 'subscription_activated'`
      )
      .get(tenant.data.tenantId) as { cnt: number };
    expect(Number(auditRows.cnt)).toBe(1);
  });

  it('handles concurrent duplicate delivery of the same invoice atomically (single extension, single audit log)', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const tenant = await signupTenant(env, {
      slug: 'quan-concurrent-same',
      shopName: 'Quán Concurrent Same',
      ownerEmail: 'owner-concurrent-same@example.com',
    });

    const baseDateMs = Date.now() + 5 * 86_400_000;
    const baseDateIso = new Date(baseDateMs).toISOString();
    sqlite
      .prepare(`UPDATE tenant_subscriptions SET current_period_end = ?, status = 'active' WHERE tenant_id = ?`)
      .run(baseDateIso, tenant.data.tenantId);
    sqlite
      .prepare(`UPDATE saas_tenants SET current_period_end = ?, status = 'active' WHERE id = ?`)
      .run(baseDateIso, tenant.data.tenantId);

    const expectedAmount = calculatePlanAmountVnd('starter', 'monthly');
    const orderCode = 900100101;
    sqlite
      .prepare(
        `INSERT INTO tenant_invoices (id, tenant_id, tier, billing_cycle, amount_vnd, status, payos_order_code)
         VALUES (?, ?, 'starter', 'monthly', ?, 'pending', ?)`
      )
      .run('inv_conc_same_1', tenant.data.tenantId, expectedAmount, String(orderCode));

    const payloadData = { orderCode, amount: expectedAmount, code: '00' };
    const sig = await signPayosData(payloadData, SAAS_PAYOS_CHECKSUM);
    const sendWebhook = () =>
      app.fetch(
        new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, data: payloadData, signature: sig }),
        }),
        env,
        dummyCtx
      );

    // Fire 4 concurrent deliveries of the exact same invoice
    const responses = await Promise.all([sendWebhook(), sendWebhook(), sendWebhook(), sendWebhook()]);
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
    const messages = await Promise.all(
      responses.map(async (r) => ((await r.json()) as { message: string }).message)
    );
    expect(messages.filter((m) => m === 'SaaS subscription activated')).toHaveLength(1);
    expect(messages.filter((m) => m === 'Already processed')).toHaveLength(3);

    const sub = sqlite
      .prepare('SELECT current_period_end, status FROM tenant_subscriptions WHERE tenant_id = ?')
      .get(tenant.data.tenantId) as { current_period_end: string; status: string };
    expect(sub.status).toBe('active');
    expect(Math.abs(Date.parse(sub.current_period_end) - (baseDateMs + 30 * 86_400_000))).toBeLessThan(2000);

    const auditCount = sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt FROM saas_audit_logs
         WHERE tenant_id = ? AND action = 'subscription_activated'`
      )
      .get(tenant.data.tenantId) as { cnt: number };
    expect(Number(auditCount.cnt)).toBe(1);
  });

  it('stacks periods cleanly when two distinct valid invoices for the same tenant arrive concurrently', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const tenant = await signupTenant(env, {
      slug: 'quan-concurrent-two',
      shopName: 'Quán Concurrent Two',
      ownerEmail: 'owner-concurrent-two@example.com',
    });

    const baseDateMs = Date.now() + 7 * 86_400_000;
    const baseDateIso = new Date(baseDateMs).toISOString();
    sqlite
      .prepare(`UPDATE tenant_subscriptions SET current_period_end = ?, status = 'active' WHERE tenant_id = ?`)
      .run(baseDateIso, tenant.data.tenantId);
    sqlite
      .prepare(`UPDATE saas_tenants SET current_period_end = ?, status = 'active' WHERE id = ?`)
      .run(baseDateIso, tenant.data.tenantId);

    const amount = calculatePlanAmountVnd('pro', 'monthly');
    const orderCode1 = 900200201;
    const orderCode2 = 900200202;
    sqlite
      .prepare(
        `INSERT INTO tenant_invoices (id, tenant_id, tier, billing_cycle, amount_vnd, status, payos_order_code)
         VALUES (?, ?, 'pro', 'monthly', ?, 'pending', ?)`
      )
      .run('inv_conc_two_1', tenant.data.tenantId, amount, String(orderCode1));
    sqlite
      .prepare(
        `INSERT INTO tenant_invoices (id, tenant_id, tier, billing_cycle, amount_vnd, status, payos_order_code)
         VALUES (?, ?, 'pro', 'monthly', ?, 'pending', ?)`
      )
      .run('inv_conc_two_2', tenant.data.tenantId, amount, String(orderCode2));

    const data1 = { orderCode: orderCode1, amount, code: '00' };
    const data2 = { orderCode: orderCode2, amount, code: '00' };
    const [sig1, sig2] = await Promise.all([
      signPayosData(data1, SAAS_PAYOS_CHECKSUM),
      signPayosData(data2, SAAS_PAYOS_CHECKSUM),
    ]);

    const [res1, res2] = await Promise.all([
      app.fetch(
        new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, data: data1, signature: sig1 }),
        }),
        env,
        dummyCtx
      ),
      app.fetch(
        new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, data: data2, signature: sig2 }),
        }),
        env,
        dummyCtx
      ),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(((await res1.json()) as { message: string }).message).toBe('SaaS subscription activated');
    expect(((await res2.json()) as { message: string }).message).toBe('SaaS subscription activated');

    // Both invoices paid, period extended by +60 days (30 + 30), tenant matches subscription, 2 audit logs
    const paidInvoices = sqlite
      .prepare(`SELECT COUNT(*) AS cnt FROM tenant_invoices WHERE tenant_id = ? AND status = 'paid'`)
      .get(tenant.data.tenantId) as { cnt: number };
    expect(Number(paidInvoices.cnt)).toBe(2);

    const sub = sqlite
      .prepare('SELECT current_period_end, status FROM tenant_subscriptions WHERE tenant_id = ?')
      .get(tenant.data.tenantId) as { current_period_end: string; status: string };
    const tenantRow = sqlite
      .prepare('SELECT current_period_end, status FROM saas_tenants WHERE id = ?')
      .get(tenant.data.tenantId) as { current_period_end: string; status: string };

    expect(sub.status).toBe('active');
    expect(tenantRow.status).toBe('active');
    expect(tenantRow.current_period_end).toBe(sub.current_period_end);
    // Must be baseDate + 60 days (both 30-day invoices stacked!)
    expect(Math.abs(Date.parse(sub.current_period_end) - (baseDateMs + 60 * 86_400_000))).toBeLessThan(2000);

    const auditCount = sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt FROM saas_audit_logs
         WHERE tenant_id = ? AND action = 'subscription_activated'`
      )
      .get(tenant.data.tenantId) as { cnt: number };
    expect(Number(auditCount.cnt)).toBe(2);
  });

  it('rolls back invoice paid status on mid-transaction update failure and succeeds cleanly on webhook retry', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const tenant = await signupTenant(env, {
      slug: 'quan-rollback-retry',
      shopName: 'Quán Rollback Retry',
      ownerEmail: 'owner-rollback-retry@example.com',
    });

    const baseDateMs = Date.now() + 4 * 86_400_000;
    const baseDateIso = new Date(baseDateMs).toISOString();
    sqlite
      .prepare(`UPDATE tenant_subscriptions SET current_period_end = ?, status = 'trial' WHERE tenant_id = ?`)
      .run(baseDateIso, tenant.data.tenantId);
    sqlite
      .prepare(`UPDATE saas_tenants SET current_period_end = ?, status = 'trial' WHERE id = ?`)
      .run(baseDateIso, tenant.data.tenantId);

    const amount = calculatePlanAmountVnd('pro', 'monthly');
    const orderCode = 900300301;
    sqlite
      .prepare(
        `INSERT INTO tenant_invoices (id, tenant_id, tier, billing_cycle, amount_vnd, status, payos_order_code)
         VALUES (?, ?, 'pro', 'monthly', ?, 'pending', ?)`
      )
      .run('inv_rollback_1', tenant.data.tenantId, amount, String(orderCode));

    const payloadData = { orderCode, amount, code: '00' };
    const sig = await signPayosData(payloadData, SAAS_PAYOS_CHECKSUM);
    const sendWebhook = () =>
      app.fetch(
        new Request('https://auraspace.cafe/api/saas/billing/webhook/payos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, data: payloadData, signature: sig }),
        }),
        env,
        dummyCtx
      );

    // Inject transient failure mid-transaction on `saas_tenants` update
    sqlite.exec(`
      CREATE TRIGGER fail_saas_tenant_update_once
      BEFORE UPDATE ON saas_tenants
      BEGIN
        SELECT RAISE(ABORT, 'simulated_mid_tx_failure');
      END;
    `);

    const failedRes = await sendWebhook();
    expect(failedRes.status).toBe(500);

    // Verify full atomic rollback: invoice stays pending, subscription untouched, 0 audit logs
    const invAfterFail = sqlite
      .prepare('SELECT status, paid_at FROM tenant_invoices WHERE id = ?')
      .get('inv_rollback_1') as { status: string; paid_at: string | null };
    expect(invAfterFail.status).toBe('pending');
    expect(invAfterFail.paid_at).toBeNull();

    const subAfterFail = sqlite
      .prepare('SELECT status, current_period_end FROM tenant_subscriptions WHERE tenant_id = ?')
      .get(tenant.data.tenantId) as { status: string; current_period_end: string };
    expect(subAfterFail.status).toBe('trial');
    expect(subAfterFail.current_period_end).toBe(baseDateIso);

    const auditAfterFail = sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt FROM saas_audit_logs
         WHERE tenant_id = ? AND action = 'subscription_activated'`
      )
      .get(tenant.data.tenantId) as { cnt: number };
    expect(Number(auditAfterFail.cnt)).toBe(0);

    // Clear the transient failure and retry the exact same webhook
    sqlite.exec('DROP TRIGGER fail_saas_tenant_update_once;');

    const retryRes = await sendWebhook();
    expect(retryRes.status).toBe(200);
    expect(((await retryRes.json()) as { message: string }).message).toBe('SaaS subscription activated');

    const invAfterRetry = sqlite
      .prepare('SELECT status, paid_at FROM tenant_invoices WHERE id = ?')
      .get('inv_rollback_1') as { status: string; paid_at: string | null };
    expect(invAfterRetry.status).toBe('paid');
    expect(invAfterRetry.paid_at).toBeTruthy();

    const subAfterRetry = sqlite
      .prepare('SELECT status, current_period_end FROM tenant_subscriptions WHERE tenant_id = ?')
      .get(tenant.data.tenantId) as { status: string; current_period_end: string };
    expect(subAfterRetry.status).toBe('active');
    expect(Math.abs(Date.parse(subAfterRetry.current_period_end) - (baseDateMs + 30 * 86_400_000))).toBeLessThan(2000);

    const auditAfterRetry = sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt FROM saas_audit_logs
         WHERE tenant_id = ? AND action = 'subscription_activated'`
      )
      .get(tenant.data.tenantId) as { cnt: number };
    expect(Number(auditAfterRetry.cnt)).toBe(1);
  });

  it('blocks cross-tenant IDOR via X-Tenant-Slug on /api/saas/export and /api/saas/payment-config', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const tenantA = await signupTenant(env, {
      slug: 'idor-tenant-a',
      shopName: 'Quán IDOR A',
      ownerEmail: 'idor-a@quan.vn',
    });
    const tenantB = await signupTenant(env, {
      slug: 'idor-tenant-b',
      shopName: 'Quán IDOR B',
      ownerEmail: 'idor-b@quan.vn',
    });

    // Seed a distinct product name for Tenant B so any leak is immediately detectable
    sqlite
      .prepare('UPDATE products SET name = ? WHERE tenant_id = ?')
      .run('SECRET_TENANT_B_DRINK', tenantB.data.tenantId);

    // Tenant A tries to exfiltrate Tenant B's data by sending X-Tenant-Slug: idor-tenant-b
    const exportRes = await app.fetch(
      new Request('https://idor-tenant-b.auraspace.cafe/api/saas/export?slug=idor-tenant-b', {
        headers: {
          Authorization: `Bearer ${tenantA.token}`,
          'X-Tenant-Slug': 'idor-tenant-b',
          Host: 'idor-tenant-b.auraspace.cafe',
        },
      }),
      env,
      dummyCtx
    );
    expect(exportRes.status).toBe(200);
    const exportJson = (await exportRes.json()) as {
      tenantId: string;
      data: { products: Array<{ name: string }> };
    };
    expect(exportJson.tenantId).toBe(tenantA.data.tenantId);
    expect(exportJson.data.products.some((p) => p.name === 'SECRET_TENANT_B_DRINK')).toBe(false);

    // Tenant A tries to overwrite Tenant B's payment config using X-Tenant-Slug: idor-tenant-b
    const hijackPayRes = await app.fetch(
      new Request('https://idor-tenant-b.auraspace.cafe/api/saas/payment-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantA.token}`,
          'X-Tenant-Slug': 'idor-tenant-b',
          Host: 'idor-tenant-b.auraspace.cafe',
        },
        body: JSON.stringify({
          provider: 'vietqr',
          bankBin: '970436',
          bankAccountNo: '9999999999',
          bankAccountName: 'ATTACKER ACCOUNT',
          bankName: 'Vietcombank',
        }),
      }),
      env,
      dummyCtx
    );
    expect(hijackPayRes.status).toBe(200);

    // Tenant B must NOT have Tenant A's bank account
    const tenantBPay = sqlite
      .prepare('SELECT bank_account_no FROM tenant_payment_configs WHERE tenant_id = ?')
      .get(tenantB.data.tenantId) as { bank_account_no: string | null } | undefined;
    expect(tenantBPay?.bank_account_no ?? null).not.toBe('9999999999');

    // Tenant A's own config was updated instead
    const tenantAPay = sqlite
      .prepare('SELECT bank_account_no FROM tenant_payment_configs WHERE tenant_id = ?')
      .get(tenantA.data.tenantId) as { bank_account_no: string | null } | undefined;
    expect(tenantAPay?.bank_account_no).toBe('9999999999');
  });

  it('blocks POST /api/orders/guest-checkin with 402 for expired tenant even when Authorization header is sent', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const tenant = await signupTenant(env, {
      slug: 'checkin-expired-shop',
      shopName: 'Quán Hết Hạn Checkin',
      ownerEmail: 'checkin-exp@quan.vn',
    });

    const past = new Date(Date.now() - 10 * 86_400_000).toISOString();
    sqlite
      .prepare("UPDATE tenant_subscriptions SET status = 'trial', trial_ends_at = ?, current_period_end = ?, grace_ends_at = ? WHERE tenant_id = ?")
      .run(past, past, past, tenant.data.tenantId);

    const table = sqlite
      .prepare('SELECT id FROM cafe_tables WHERE tenant_id = ? LIMIT 1')
      .get(tenant.data.tenantId) as { id: string };

    const checkinRes = await app.fetch(
      new Request('https://checkin-expired-shop.auraspace.cafe/api/orders/guest-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant.token}`,
          Host: 'checkin-expired-shop.auraspace.cafe',
        },
        body: JSON.stringify({
          table_id: table.id,
          customer_name: 'Khách Hết Hạn',
          customer_phone: '0901234567',
        }),
      }),
      env,
      dummyCtx
    );
    expect(checkinRes.status).toBe(402);
  });

  it('enforces table plan quota on POST /api/tables and fails closed (502) when PayOS billing checkout gateway errors', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const tenant = await signupTenant(env, {
      slug: 'quota-gateway-shop',
      shopName: 'Quán Quota Gateway',
      ownerEmail: 'quota-gw@quan.vn',
    });

    // Switch tenant to starter plan (max 15 tables) and fill up to 15 tables
    sqlite
      .prepare("UPDATE tenant_subscriptions SET tier = 'starter', status = 'active' WHERE tenant_id = ?")
      .run(tenant.data.tenantId);
    const existingCount = (
      sqlite.prepare('SELECT COUNT(*) AS cnt FROM cafe_tables WHERE tenant_id = ?').get(tenant.data.tenantId) as { cnt: number }
    ).cnt;
    for (let i = existingCount; i < 15; i++) {
      sqlite
        .prepare("INSERT INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES (?, ?, 'indoor', 4, 'Available', ?)")
        .run(`tbl_fill_${i}`, `T${i + 1}`, tenant.data.tenantId);
    }

    // 16th table via POST /api/tables must be blocked with 402
    const overQuotaRes = await app.fetch(
      new Request('https://auraspace.cafe/api/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant.token}`,
        },
        body: JSON.stringify({ table_number: 'T16', capacity: 4, zone: 'indoor' }),
      }),
      env,
      dummyCtx
    );
    expect(overQuotaRes.status).toBe(402);

    // Billing checkout must fail closed with 502 and insert ZERO invoices when PayOS gateway returns error
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: '20', desc: 'Gateway rejected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    try {
      const checkoutRes = await app.fetch(
        new Request('https://auraspace.cafe/api/saas/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tenant.token}`,
          },
          body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
        }),
        env,
        dummyCtx
      );
      expect(checkoutRes.status).toBe(502);
      const invCount = (
        sqlite.prepare('SELECT COUNT(*) AS cnt FROM tenant_invoices WHERE tenant_id = ?').get(tenant.data.tenantId) as { cnt: number }
      ).cnt;
      expect(invCount).toBe(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
