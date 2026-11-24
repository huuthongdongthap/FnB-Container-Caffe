// @vitest-environment node
/**
 * Tenant QR and account guards — Real SQLite Integration Suite.
 *
 * Covers:
 * 1. Atomic signup `table_qr_codes` seeding + rollback on conflict
 * 2. Permanent storefront QR URLs (`/s/<slug>?table=<param>`) for non-default tenants
 *    across `/tables`, `/png`, and `/download` without `QR_SIGNING_SECRET`, ignoring untrusted Host
 * 3. Backfill + regenerate tenant alignment + code-less table `id` fallback + fail-closed missing slug
 * 4. Flagship `'default'` expiring signed QR preservation
 * 5. Cross-tenant denial, HQ wildcard vs explicit override, and misaligned QR/table tenant denial
 * 6. Tenant-scoped PayOS cancellation (merchant decrypted keys, zero flagship leakage, resilient CAS)
 * 7. Atomic last-owner guard blocking passwordless/blank backup owners while preserving login-capable owners
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { hashPassword } from '../lib/jwt';
import { provisionSelfServeTenant } from '../lib/saas-provisioning';
import { staffMutationGuard } from '../lib/staff-account-mutation';
import { issueStaffSession, requireStaffAccount } from '../lib/staff-session';
import { encryptTenantSecret } from '../lib/tenant-secrets';
import { generatePNG } from '../tree/qr/generator';
import { cancelOpenPayOSAttemptForOrder } from '../../../packages/domain/payment/commands/payos-attempt';
import {
  buildEnv,
  createHqToken,
  createMigratedD1,
  dummyCtx,
  SAAS_V31_SECRETS_KEY,
  signupTenant,
} from './helpers/saas-v3-1-sqlite-fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SaaS v3.1.1 — Tenant Permanent Table QR, Isolation, PayOS Cancel & Last-Owner Guard', () => {
  it('atomically seeds table_qr_codes on signup, rolls back cleanly on slug conflict, and emits permanent storefront QR payloads without QR_SIGNING_SECRET', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db, {
      QR_SIGNING_SECRET: undefined,
      FE_BASE_URL: 'https://order.auraspace.cafe',
    });

    const alpha = await signupTenant(env, {
      slug: 'alpha-brew',
      shopName: 'Alpha Brew',
      ownerEmail: 'alpha@brew.vn',
    });

    const seededTables = sqlite
      .prepare('SELECT id, code, table_number, tenant_id FROM cafe_tables WHERE tenant_id = ? ORDER BY code ASC')
      .all(alpha.tenantId) as Array<{ id: string; code: string; table_number: string; tenant_id: string }>;
    const seededQrs = sqlite
      .prepare('SELECT table_id, slug, tenant_id FROM table_qr_codes WHERE tenant_id = ? ORDER BY slug ASC')
      .all(alpha.tenantId) as Array<{ table_id: string; slug: string; tenant_id: string }>;

    expect(seededTables.length).toBeGreaterThan(0);
    expect(seededQrs.length).toBe(seededTables.length);
    for (const tbl of seededTables) {
      const qr = seededQrs.find((row) => row.table_id === tbl.id);
      expect(qr).toBeDefined();
      expect(qr?.slug).toBe(`alpha-brew-${tbl.code.toLowerCase()}`);
      expect(qr?.tenant_id).toBe(alpha.tenantId);
    }

    // Rollback atomicity check: pre-seed a colliding slug in table_qr_codes
    sqlite
      .prepare("INSERT INTO table_qr_codes (table_id, slug, tenant_id) VALUES ('tbl_conflict', 'gamma-brew-t01', 'default')")
      .run();
    await expect(
      provisionSelfServeTenant(db, {
        shopName: 'Gamma Brew',
        slug: 'gamma-brew',
        ownerName: 'Chủ Gamma',
        ownerEmail: 'gamma@brew.vn',
        password: 'StrongPassword#2026',
        templateId: 'traditional-cafe',
      })
    ).rejects.toMatchObject({
      name: 'ProvisionError',
      status: 409,
      code: 'duplicate_registration',
    });
    expect(
      sqlite.prepare("SELECT COUNT(*) AS c FROM saas_tenants WHERE slug = 'gamma-brew'").get()
    ).toMatchObject({ c: 0 });
    expect(
      sqlite.prepare("SELECT COUNT(*) AS c FROM cafe_tables WHERE table_number LIKE 'gamma-brew-%'").get()
    ).toMatchObject({ c: 0 });

    // List endpoint succeeds without QR_SIGNING_SECRET and ignores untrusted Host header
    const listRes = await app.fetch(
      new Request('https://evil.example.com/api/admin/qr/tables', {
        headers: {
          Authorization: `Bearer ${alpha.token}`,
          Host: 'evil.example.com',
        },
      }),
      env,
      dummyCtx
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      success: boolean;
      data: Array<{ id: string; code: string | null; slug: string; signed_url: string; qr_mode: string }>;
    };
    expect(listBody.success).toBe(true);
    expect(listBody.data.length).toBe(seededTables.length);

    // Every emitted ?table= param must resolve cleanly against the public storefront contract
    const storefrontRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/storefront/alpha-brew'),
      env,
      dummyCtx
    );
    expect(storefrontRes.status).toBe(200);
    const storefrontBody = (await storefrontRes.json()) as {
      data: { tables: Array<{ id: string; code: string | null }> };
    };
    const storefrontCodes = new Set(storefrontBody.data.tables.map((t) => String(t.code || '').toLowerCase()));

    for (const item of listBody.data) {
      expect(item.qr_mode).toBe('tenant_permanent');
      expect(item.signed_url).toBe(`https://order.auraspace.cafe/s/alpha-brew?table=${encodeURIComponent(item.code || '')}`);
      expect(item.signed_url).not.toContain('/api/qr/');
      expect(item.signed_url).not.toContain('sig=');
      expect(item.signed_url).not.toContain('evil.example.com');
      expect(storefrontCodes.has(String(item.code || '').toLowerCase())).toBe(true);
    }

    // PNG & Download endpoints encode the exact same permanent storefront URL byte-for-byte
    const expectedUrl = 'https://order.auraspace.cafe/s/alpha-brew?table=T01';
    const expectedPng = Buffer.from(
      await generatePNG('alpha-brew-t01', 'https://order.auraspace.cafe', expectedUrl)
    );

    const pngRes = await app.fetch(
      new Request('https://evil.example.com/api/admin/qr/alpha-brew-t01/png', {
        headers: {
          Authorization: `Bearer ${alpha.token}`,
          Host: 'evil.example.com',
        },
      }),
      env,
      dummyCtx
    );
    expect(pngRes.status).toBe(200);
    expect(pngRes.headers.get('Content-Type')).toBe('image/png');
    expect(pngRes.headers.get('X-QR-Mode')).toBe('tenant_permanent');
    expect(Buffer.from(await pngRes.arrayBuffer()).equals(expectedPng)).toBe(true);

    const dlRes = await app.fetch(
      new Request('https://evil.example.com/api/admin/qr/alpha-brew-t01/download', {
        headers: {
          Authorization: `Bearer ${alpha.token}`,
          Host: 'evil.example.com',
        },
      }),
      env,
      dummyCtx
    );
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers.get('Content-Type')).toBe('image/png');
    expect(dlRes.headers.get('Content-Disposition')).toContain('qr-alpha-brew-t01.png');
    expect(dlRes.headers.get('X-QR-Mode')).toBe('tenant_permanent');
    expect(Buffer.from(await dlRes.arrayBuffer()).equals(expectedPng)).toBe(true);
  });

  it('backfills and regenerates tenant QR rows on the concrete tenant, supports code-less table id fallback, and fails closed when non-default tenant lacks verified slug', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db, {
      QR_SIGNING_SECRET: 'flagship-secret-present-should-not-bypass-fail-closed',
      FE_BASE_URL: 'https://auraspace.cafe',
    });

    const beta = await signupTenant(env, {
      slug: 'beta-roast',
      shopName: 'Beta Roast',
      ownerEmail: 'beta@roast.vn',
    });

    // Simulate pre-existing tenant whose tables exist without table_qr_codes rows
    sqlite.prepare('DELETE FROM table_qr_codes WHERE tenant_id = ?').run(beta.tenantId);

    // Add a manually created table with NULL code (matches admin POST /api/tables behavior)
    sqlite
      .prepare(
        `INSERT INTO cafe_tables (id, table_number, code, name, capacity, zone, is_active, status, tenant_id)
         VALUES ('tbl_beta_manual_99', 'beta-num-99', NULL, 'Bàn 99', 4, 'Sân vườn', 1, 'Available', ?)`
      )
      .run(beta.tenantId);

    const listRes = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/tables', {
        headers: { Authorization: `Bearer ${beta.token}` },
      }),
      env,
      dummyCtx
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      data: Array<{ id: string; code: string | null; slug: string; signed_url: string; qr_mode: string }>;
    };

    const manualItem = listBody.data.find((t) => t.id === 'tbl_beta_manual_99');
    expect(manualItem).toBeDefined();
    // Must encode table.id (supported by storefront.tsx), never table_number ('beta-num-99')
    expect(manualItem?.signed_url).toBe('https://auraspace.cafe/s/beta-roast?table=tbl_beta_manual_99');
    expect(manualItem?.signed_url).not.toContain('beta-num-99');

    // Backfilled rows must belong to beta.tenantId, never stranded on 'default'
    const backfilledDefaultCount = sqlite
      .prepare("SELECT COUNT(*) AS c FROM table_qr_codes WHERE table_id IN (SELECT id FROM cafe_tables WHERE tenant_id = ?) AND tenant_id != ?")
      .get(beta.tenantId, beta.tenantId) as { c: number };
    expect(backfilledDefaultCount.c).toBe(0);

    // Regenerate keeps tenant ownership intact and PNG still works
    const regenRes = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/regenerate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${beta.token}` },
      }),
      env,
      dummyCtx
    );
    expect(regenRes.status).toBe(200);
    const postRegenMismatch = sqlite
      .prepare("SELECT COUNT(*) AS c FROM table_qr_codes WHERE table_id IN (SELECT id FROM cafe_tables WHERE tenant_id = ?) AND tenant_id != ?")
      .get(beta.tenantId, beta.tenantId) as { c: number };
    expect(postRegenMismatch.c).toBe(0);

    const manualPng = await app.fetch(
      new Request(`https://auraspace.cafe/api/admin/qr/${encodeURIComponent(manualItem!.slug)}/png`, {
        headers: { Authorization: `Bearer ${beta.token}` },
      }),
      env,
      dummyCtx
    );
    expect(manualPng.status).toBe(200);
    const expectedManualPng = Buffer.from(
      await generatePNG(manualItem!.slug, 'https://auraspace.cafe', 'https://auraspace.cafe/s/beta-roast?table=tbl_beta_manual_99')
    );
    expect(Buffer.from(await manualPng.arrayBuffer()).equals(expectedManualPng)).toBe(true);

    // Non-default tenant without verified saas_tenants.slug fails closed (never falls back to signed /api/qr/:slug)
    const orphanTenantId = 'ten_unmapped_legacy';
    const hash = await hashPassword('StrongPassword#2026');
    sqlite
      .prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version, password_hash) VALUES ('usr_orphan', 'Orphan Owner', 'owner', ?, 1, 1, ?)")
      .run(orphanTenantId, hash);
    sqlite
      .prepare("INSERT INTO cafe_tables (id, table_number, code, name, capacity, zone, is_active, status, tenant_id) VALUES ('tbl_orphan_1', 'orphan-1', 'O1', 'Bàn O1', 4, 'Main', 1, 'Available', ?)")
      .run(orphanTenantId);
    sqlite
      .prepare("INSERT INTO table_qr_codes (table_id, slug, tenant_id) VALUES ('tbl_orphan_1', 'orphan-o1', ?)")
      .run(orphanTenantId);

    const orphanSession = await issueStaffSession(
      env,
      { id: 'usr_orphan', name: 'Orphan Owner', phone: null, role: 'owner', tenant_id: orphanTenantId, is_active: 1, auth_version: 1 },
      { email: 'orphan@legacy.vn', sessionType: 'staff-web' }
    );

    const orphanList = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/tables', {
        headers: { Authorization: `Bearer ${orphanSession.token}` },
      }),
      env,
      dummyCtx
    );
    expect(orphanList.status).toBe(200);
    const orphanListBody = (await orphanList.json()) as {
      data: Array<{ signed_url: string | null; qr_error_code?: string }>;
    };
    expect(orphanListBody.data[0]?.signed_url).toBeNull();
    expect(orphanListBody.data[0]?.qr_error_code).toBe('tenant_slug_not_found');

    const orphanPng = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/orphan-o1/png', {
        headers: { Authorization: `Bearer ${orphanSession.token}` },
      }),
      env,
      dummyCtx
    );
    expect(orphanPng.status).toBe(404);
    expect(await orphanPng.json()).toMatchObject({ success: false, code: 'tenant_slug_not_found' });

    const orphanDl = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/orphan-o1/download', {
        headers: { Authorization: `Bearer ${orphanSession.token}` },
      }),
      env,
      dummyCtx
    );
    expect(orphanDl.status).toBe(404);
    expect(await orphanDl.json()).toMatchObject({ success: false, code: 'tenant_slug_not_found' });
  });

  it('preserves flagship default signed QR flow and enforces strict cross-tenant & HQ isolation', async () => {
    const { db, sqlite } = createMigratedD1();
    const envNoSecret = buildEnv(db, { QR_SIGNING_SECRET: undefined });
    const envWithSecret = buildEnv(db, { QR_SIGNING_SECRET: 'flagship-qr-hmac-secret-32chars!!' });

    const ownerHash = await hashPassword('StrongPassword#2026');
    sqlite
      .prepare("INSERT INTO users (id, name, role, tenant_id, is_active, auth_version, password_hash) VALUES ('usr_flagship', 'Flagship Owner', 'owner', 'default', 1, 1, ?)")
      .run(ownerHash);
    const flagshipSession = await issueStaffSession(
      envWithSecret,
      { id: 'usr_flagship', name: 'Flagship Owner', phone: null, role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
      { email: 'owner@auraspace.cafe', sessionType: 'staff-web' }
    );

    const alpha = await signupTenant(envWithSecret, {
      slug: 'alpha-iso',
      shopName: 'Alpha Iso',
      ownerEmail: 'alpha-iso@brew.vn',
    });
    const beta = await signupTenant(envWithSecret, {
      slug: 'beta-iso',
      shopName: 'Beta Iso',
      ownerEmail: 'beta-iso@brew.vn',
    });
    const hqToken = await createHqToken(envWithSecret, sqlite);

    // Flagship requires QR_SIGNING_SECRET
    const flagshipNoSecretRes = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/tables', {
        headers: { Authorization: `Bearer ${flagshipSession.token}` },
      }),
      envNoSecret,
      dummyCtx
    );
    expect(flagshipNoSecretRes.status).toBe(503);

    // Flagship with QR_SIGNING_SECRET keeps expiring signed /api/qr/:slug flow
    const flagshipListRes = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/tables', {
        headers: { Authorization: `Bearer ${flagshipSession.token}` },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(flagshipListRes.status).toBe(200);
    const flagshipBody = (await flagshipListRes.json()) as {
      data: Array<{ id: string; slug: string; signed_url: string; qr_mode: string }>;
    };
    expect(flagshipBody.data.length).toBe(1);
    expect(flagshipBody.data[0]?.qr_mode).toBe('flagship_signed');
    expect(flagshipBody.data[0]?.signed_url).toMatch(/^https:\/\/auraspace\.cafe\/api\/qr\/.+\?ts=\d+&sig=[a-f0-9]{64}$/);

    const flagshipSlug = flagshipBody.data[0]!.slug;
    const flagshipPng = await app.fetch(
      new Request(`https://auraspace.cafe/api/admin/qr/${encodeURIComponent(flagshipSlug)}/png`, {
        headers: { Authorization: `Bearer ${flagshipSession.token}` },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(flagshipPng.status).toBe(200);
    expect(flagshipPng.headers.get('X-QR-Mode')).toBe('flagship_signed');

    // Cross-tenant denial: alpha cannot access beta's PNG, download, or override tenant header
    const crossPng = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/beta-iso-t01/png', {
        headers: { Authorization: `Bearer ${alpha.token}` },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(crossPng.status).toBe(404);

    const crossDl = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/beta-iso-t01/download', {
        headers: { Authorization: `Bearer ${alpha.token}` },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(crossDl.status).toBe(404);

    const crossOverride = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/tables', {
        headers: {
          Authorization: `Bearer ${alpha.token}`,
          'X-Tenant-ID': beta.tenantId,
        },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(crossOverride.status).toBe(403);

    // HQ explicit tenant override uses alpha's verified slug (never 'hq' or '*') without needing QR_SIGNING_SECRET
    const hqAlphaRes = await app.fetch(
      new Request(`https://auraspace.cafe/api/admin/qr/tables?tenant_id=${encodeURIComponent(alpha.tenantId)}`, {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      envNoSecret,
      dummyCtx
    );
    expect(hqAlphaRes.status).toBe(200);
    const hqAlphaBody = (await hqAlphaRes.json()) as {
      data: Array<{ signed_url: string; qr_mode: string }>;
    };
    expect(hqAlphaBody.data.every((row) => row.qr_mode === 'tenant_permanent' && row.signed_url.startsWith('https://auraspace.cafe/s/alpha-iso?table='))).toBe(true);

    const hqAlphaPng = await app.fetch(
      new Request(`https://auraspace.cafe/api/admin/qr/alpha-iso-t01/png?tenant_id=${encodeURIComponent(alpha.tenantId)}`, {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      envNoSecret,
      dummyCtx
    );
    expect(hqAlphaPng.status).toBe(200);
    expect(hqAlphaPng.headers.get('X-QR-Mode')).toBe('tenant_permanent');

    // HQ wildcard resolves each table by its actual owning tenant
    const hqWildcardRes = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/tables', {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(hqWildcardRes.status).toBe(200);
    const hqWildcardBody = (await hqWildcardRes.json()) as {
      data: Array<{ id: string; signed_url: string; qr_mode: string }>;
    };
    const defaultRow = hqWildcardBody.data.find((r) => r.id === 'tbl_default_1');
    const alphaRow = hqWildcardBody.data.find((r) => r.id === 'tbl_alpha-iso_t01');
    expect(defaultRow?.qr_mode).toBe('flagship_signed');
    expect(alphaRow?.qr_mode).toBe('tenant_permanent');
    expect(alphaRow?.signed_url).toBe('https://auraspace.cafe/s/alpha-iso?table=T01');

    // Misaligned QR row (table belongs to alpha, QR row claims beta): HQ wildcard must reject
    sqlite
      .prepare("UPDATE table_qr_codes SET tenant_id = ? WHERE slug = 'alpha-iso-t01'")
      .run(beta.tenantId);

    const mismatchedHqPng = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/alpha-iso-t01/png', {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(mismatchedHqPng.status).toBe(404);

    const mismatchedHqDl = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/alpha-iso-t01/download', {
        headers: { Authorization: `Bearer ${hqToken}` },
      }),
      envWithSecret,
      dummyCtx
    );
    expect(mismatchedHqDl.status).toBe(404);
  });

  it('cancels non-default PayOS attempts strictly with merchant decrypted keys, never leaks flagship/platform keys, and preserves local CAS on failure', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const alpha = await signupTenant(env, {
      slug: 'pay-alpha',
      shopName: 'Pay Alpha',
      ownerEmail: 'pay-alpha@brew.vn',
    });
    const beta = await signupTenant(env, {
      slug: 'pay-beta',
      shopName: 'Pay Beta',
      ownerEmail: 'pay-beta@brew.vn',
    });

    const insertOrder = (orderId: string, tenantId: string, total: number) => {
      sqlite
        .prepare(
          `INSERT INTO orders (id, customer_name, customer_phone, items, total, status, payment_method, tenant_id)
           VALUES (?, 'Khách', '0900000001', '[]', ?, 'pending', 'payos', ?)`
        )
        .run(orderId, total, tenantId);
    };

    // 1. Non-default tenant with encrypted merchant PayOS config
    const [encClient, encApi, encChecksum] = await Promise.all([
      encryptTenantSecret('merchant-alpha-client-id', SAAS_V31_SECRETS_KEY, 1, `${alpha.tenantId}:payos_client_id`),
      encryptTenantSecret('merchant-alpha-api-key', SAAS_V31_SECRETS_KEY, 1, `${alpha.tenantId}:payos_api_key`),
      encryptTenantSecret('merchant-alpha-checksum', SAAS_V31_SECRETS_KEY, 1, `${alpha.tenantId}:payos_checksum_key`),
    ]);
    sqlite
      .prepare(
        `UPDATE tenant_payment_configs
         SET provider = 'payos',
             payos_client_id_enc = ?,
             payos_api_key_enc = ?,
             payos_checksum_key_enc = ?,
             is_active = 1
         WHERE tenant_id = ?`
      )
      .run(encClient, encApi, encChecksum, alpha.tenantId);

    insertOrder('ord_alpha_1', alpha.tenantId, 55000);
    sqlite
      .prepare(
        `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id)
         VALUES ('pay_alpha_1', 'ord_alpha_1', 'payos', 55000, 'pending', '123456789', 'https://pay.payos.vn/web/alphaLink1', ?)`
      )
      .run(alpha.tenantId);

    const capturedCalls: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedCalls.push({
          url: String(input),
          headers: (init?.headers ?? {}) as Record<string, string>,
        });
        return new Response(JSON.stringify({ code: '00' }), { status: 200 });
      })
    );

    const alphaRes = await cancelOpenPayOSAttemptForOrder(
      db,
      env as unknown as Record<string, unknown>,
      'ord_alpha_1',
      alpha.tenantId
    );
    expect(alphaRes).toEqual({ cancelled: 1, providerNotified: 1 });
    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0]?.url).toContain('/alphaLink1/cancel');
    expect(capturedCalls[0]?.headers['x-client-id']).toBe('merchant-alpha-client-id');
    expect(capturedCalls[0]?.headers['x-api-key']).toBe('merchant-alpha-api-key');
    expect(capturedCalls[0]?.headers['x-client-id']).not.toBe(env.PAYOS_CLIENT_ID);
    expect(capturedCalls[0]?.headers['x-client-id']).not.toBe(env.SAAS_PAYOS_CLIENT_ID);
    expect(sqlite.prepare("SELECT status FROM payments WHERE id = 'pay_alpha_1'").get()).toMatchObject({ status: 'cancelled' });

    // 2. Non-default tenant on VietQR-only (unconfigured PayOS): closes locally, zero upstream calls, never uses flagship keys
    insertOrder('ord_beta_1', beta.tenantId, 42000);
    sqlite
      .prepare(
        `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id)
         VALUES ('pay_beta_1', 'ord_beta_1', 'payos', 42000, 'pending', '223456789', 'https://pay.payos.vn/web/betaLink1', ?)`
      )
      .run(beta.tenantId);

    capturedCalls.length = 0;
    const betaRes = await cancelOpenPayOSAttemptForOrder(
      db,
      env as unknown as Record<string, unknown>,
      'ord_beta_1',
      beta.tenantId
    );
    expect(betaRes).toEqual({ cancelled: 1, providerNotified: 0 });
    expect(capturedCalls).toHaveLength(0);
    expect(sqlite.prepare("SELECT status FROM payments WHERE id = 'pay_beta_1'").get()).toMatchObject({ status: 'cancelled' });

    // 3. Non-default tenant with missing/wrong TENANT_SECRETS_KEY: decryption fails gracefully, local CAS still closes, zero upstream calls
    insertOrder('ord_alpha_2', alpha.tenantId, 65000);
    sqlite
      .prepare(
        `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id)
         VALUES ('pay_alpha_2', 'ord_alpha_2', 'payos', 65000, 'pending', '323456789', 'https://pay.payos.vn/web/alphaLink2', ?)`
      )
      .run(alpha.tenantId);
    const brokenKeyEnv = buildEnv(db, { TENANT_SECRETS_KEY: undefined });
    const decryptFailRes = await cancelOpenPayOSAttemptForOrder(
      db,
      brokenKeyEnv as unknown as Record<string, unknown>,
      'ord_alpha_2',
      alpha.tenantId
    );
    expect(decryptFailRes).toEqual({ cancelled: 1, providerNotified: 0 });
    expect(capturedCalls).toHaveLength(0);
    expect(sqlite.prepare("SELECT status FROM payments WHERE id = 'pay_alpha_2'").get()).toMatchObject({ status: 'cancelled' });

    // 3b. Upstream PayOS 500 error: local CAS still closes cleanly without throwing
    insertOrder('ord_alpha_3', alpha.tenantId, 75000);
    sqlite
      .prepare(
        `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id)
         VALUES ('pay_alpha_3', 'ord_alpha_3', 'payos', 75000, 'pending', '323456790', 'https://pay.payos.vn/web/alphaLink3', ?)`
      )
      .run(alpha.tenantId);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedCalls.push({
          url: String(input),
          headers: (init?.headers ?? {}) as Record<string, string>,
        });
        return new Response(JSON.stringify({ code: '99' }), { status: 500 });
      })
    );
    const providerFailRes = await cancelOpenPayOSAttemptForOrder(
      db,
      env as unknown as Record<string, unknown>,
      'ord_alpha_3',
      alpha.tenantId
    );
    expect(providerFailRes).toEqual({ cancelled: 1, providerNotified: 0 });
    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0]?.headers['x-client-id']).toBe('merchant-alpha-client-id');
    expect(sqlite.prepare("SELECT status FROM payments WHERE id = 'pay_alpha_3'").get()).toMatchObject({ status: 'cancelled' });

    // 4. Flagship 'default' cancellation preserves flagship env credentials even when PAYOS_CHECKSUM_KEY is absent
    capturedCalls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedCalls.push({
          url: String(input),
          headers: (init?.headers ?? {}) as Record<string, string>,
        });
        return new Response(JSON.stringify({ code: '00' }), { status: 200 });
      })
    );
    insertOrder('ord_default_1', 'default', 35000);
    sqlite
      .prepare(
        `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id)
         VALUES ('pay_default_1', 'ord_default_1', 'payos', 35000, 'pending', '423456789', 'https://pay.payos.vn/web/flagshipLink1', 'default')`
      )
      .run();
    const flagshipEnv = buildEnv(db, {
      PAYOS_CLIENT_ID: 'flagship-client-ok',
      PAYOS_API_KEY: 'flagship-api-ok',
      PAYOS_CHECKSUM_KEY: undefined,
    });
    const defaultRes = await cancelOpenPayOSAttemptForOrder(
      db,
      flagshipEnv as unknown as Record<string, unknown>,
      'ord_default_1',
      'default'
    );
    expect(defaultRes).toEqual({ cancelled: 1, providerNotified: 1 });
    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0]?.headers['x-client-id']).toBe('flagship-client-ok');
    expect(capturedCalls[0]?.headers['x-api-key']).toBe('flagship-api-ok');
    expect(sqlite.prepare("SELECT status FROM payments WHERE id = 'pay_default_1'").get()).toMatchObject({ status: 'cancelled' });
  });

  it('blocks last-owner deactivation/demotion when backup owners lack a real password_hash and preserves atomic protection across login-capable owners', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);

    const shop = await signupTenant(env, {
      slug: 'guard-cafe',
      shopName: 'Guard Cafe',
      ownerEmail: 'owner@guard.vn',
    });

    // Seed two un-loginable backup owner rows: NULL password_hash and whitespace-only password_hash
    sqlite
      .prepare(
        `INSERT INTO users (id, name, role, tenant_id, is_active, auth_version, password_hash)
         VALUES ('usr_owner_null', 'Seed Owner Null', 'owner', ?, 1, 1, NULL)`
      )
      .run(shop.tenantId);
    sqlite
      .prepare(
        `INSERT INTO users (id, name, role, tenant_id, is_active, auth_version, password_hash)
         VALUES ('usr_owner_blank', 'Seed Owner Blank', 'owner', ?, 1, 1, '   ')`
      )
      .run(shop.tenantId);

    // HTTP PATCH deactivate must fail with 409 because no other login-capable owner exists
    const deactivateBlocked = await app.fetch(
      new Request(`https://auraspace.cafe/api/staff/${shop.ownerId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${shop.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: false }),
      }),
      env,
      dummyCtx
    );
    expect(deactivateBlocked.status).toBe(409);

    // HTTP PATCH role demotion must also fail with 409
    const demoteBlocked = await app.fetch(
      new Request(`https://auraspace.cafe/api/staff/${shop.ownerId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${shop.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'manager' }),
      }),
      env,
      dummyCtx
    );
    expect(demoteBlocked.status).toBe(409);

    // Direct SQL guard confirms 0 rows modified for the only login-capable owner
    const primaryOwner = await requireStaffAccount(db, shop.ownerId);
    const guardOnlyReal = staffMutationGuard(primaryOwner, true);
    const sqlBlocked = await db
      .prepare(`UPDATE users SET is_active = 0, auth_version = auth_version + 1 WHERE ${guardOnlyReal.sql}`)
      .bind(...guardOnlyReal.values)
      .run();
    expect(sqlBlocked.meta.changes).toBe(0);

    // Add a real login-capable backup owner (even without staff_login_identities, preserving migrated legacy owners)
    const backupHash = await hashPassword('BackupOwner#2026');
    sqlite
      .prepare(
        `INSERT INTO users (id, name, role, tenant_id, is_active, auth_version, password_hash)
         VALUES ('usr_owner_real_backup', 'Real Backup Owner', 'owner', ?, 1, 1, ?)`
      )
      .run(shop.tenantId, backupHash);

    // Competing batch deactivations between two login-capable owners must allow exactly one
    const firstGuard = staffMutationGuard(await requireStaffAccount(db, shop.ownerId), true);
    const secondGuard = staffMutationGuard(await requireStaffAccount(db, 'usr_owner_real_backup'), true);
    const batchResults = await db.batch(
      [firstGuard, secondGuard].map((guard) =>
        db
          .prepare(`UPDATE users SET is_active = 0, auth_version = auth_version + 1 WHERE ${guard.sql}`)
          .bind(...guard.values)
      )
    );
    expect(batchResults.map((r) => r.meta?.changes ?? 0)).toEqual([1, 0]);

    const remainingLoginCapableOwners = sqlite
      .prepare(
        `SELECT COUNT(*) AS c FROM users
         WHERE tenant_id = ? AND role = 'owner' AND is_active = 1
           AND NULLIF(TRIM(password_hash), '') IS NOT NULL`
      )
      .get(shop.tenantId) as { c: number };
    expect(remainingLoginCapableOwners.c).toBe(1);
  });

  it('chunks admin QR table lookups below D1 bound-parameter limit when a store has more than 60 tables', async () => {
    const { db, sqlite } = createMigratedD1();
    const maxBindsSeen: number[] = [];
    const checkedDb = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'prepare') {
          return (sql: string) => {
            const stmt = target.prepare(sql);
            const origBind = stmt.bind.bind(stmt);
            stmt.bind = (...args: unknown[]) => {
              maxBindsSeen.push(args.length);
              if (args.length > 100) {
                throw new Error(`D1 bound parameter limit exceeded: ${args.length}`);
              }
              return origBind(...args);
            };
            return stmt;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as D1Database;

    const env = buildEnv(checkedDb);
    const largeShop = await signupTenant(env, {
      slug: 'large-qr-shop',
      shopName: 'Large QR Shop',
      ownerEmail: 'large-qr@brew.vn',
    });

    // Seed 65 tables + QR rows (>130 distinct lookup keys across table.id and table_number/code)
    for (let i = 1; i <= 65; i++) {
      const code = `B${String(i).padStart(2, '0')}`;
      const tblId = `tbl_large_${i}`;
      sqlite
        .prepare(
          `INSERT INTO cafe_tables (id, table_number, code, name, capacity, zone, is_active, status, tenant_id)
           VALUES (?, ?, ?, ?, 4, 'Main', 1, 'Available', ?)`,
        )
        .run(tblId, code, code, `Bàn ${code}`, largeShop.tenantId);
      sqlite
        .prepare(
          `INSERT INTO table_qr_codes (table_id, slug, tenant_id)
           VALUES (?, ?, ?)`,
        )
        .run(tblId, `large-qr-${i}`, largeShop.tenantId);
    }

    maxBindsSeen.length = 0;
    const res = await app.fetch(
      new Request('https://auraspace.cafe/api/admin/qr/tables', {
        headers: { Authorization: `Bearer ${largeShop.token}` },
      }),
      env,
      dummyCtx,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; slug: string | null; qr_mode: string }>;
    };
    expect(body.data.length).toBeGreaterThanOrEqual(65);
    const seededRow = body.data.find((r) => r.id === 'tbl_large_65');
    expect(seededRow).toMatchObject({
      id: 'tbl_large_65',
      slug: 'large-qr-65',
      qr_mode: 'tenant_permanent',
    });
    expect(Math.max(...maxBindsSeen)).toBeLessThanOrEqual(100);
  });
});
