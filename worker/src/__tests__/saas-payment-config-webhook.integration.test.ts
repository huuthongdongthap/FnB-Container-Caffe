// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { issueStaffSession } from '../lib/staff-session';
import { buildMerchantPayosWebhookUrls, resolveTrustedWorkerOrigin } from '../lib/saas-webhook-url';
import { buildEnv, createMigratedD1, dummyCtx, signupTenant } from './helpers/saas-v3-1-sqlite-fixture';

const workerOrigin = 'https://aura-space-worker.sadec-marketing-hub.workers.dev';
afterEach(() => vi.restoreAllMocks());

describe('Merchant payment-config direct webhook URL', () => {
  it('ignores incoming origin/host and frontend config, encodes the scoped tenant slug and returns no credentials', async () => {
    const { db, sqlite } = createMigratedD1();
    try {
      const env = buildEnv(db, { FE_BASE_URL: 'https://pages.example.test' });
      const owner = await signupTenant(env, { slug: 'webhook-shop', shopName: 'Webhook Shop', ownerEmail: 'webhook@example.test' });
      const other = await signupTenant(env, { slug: 'other-shop', shopName: 'Other Shop', ownerEmail: 'other@example.test' });
      const unusualSlug = 'quán / pilot?#';
      sqlite.prepare('UPDATE saas_tenants SET slug = ? WHERE id = ?').run(unusualSlug, owner.tenantId);
      sqlite.prepare(`INSERT OR REPLACE INTO tenant_payment_configs
        (tenant_id, provider, payos_client_id_enc, payos_api_key_enc, payos_checksum_key_enc)
        VALUES (?, 'payos', 'encrypted-client', 'encrypted-api', 'encrypted-checksum')`).run(owner.tenantId);
      const response = await app.fetch(new Request('https://untrusted.example.test/api/saas/payment-config', {
        headers: { Authorization: `Bearer ${owner.token}`, Host: 'evil.test', Origin: 'https://evil.test',
          'X-Forwarded-Host': 'evil.test', 'X-Tenant-ID': other.tenantId },
      }), env, dummyCtx);
      expect(response.status).toBe(200);
      const text = await response.text();
      const result = JSON.parse(text);
      const path = `/api/webhook/payos/${encodeURIComponent(unusualSlug)}`;
      expect(result).toMatchObject({ success: true, data: {
        webhookUrlPath: path, webhookUrl: `${workerOrigin}${path}`, hasPayosCredentials: true,
      } });
      for (const secret of ['encrypted-client', 'encrypted-api', 'encrypted-checksum',
        env.PAYOS_API_KEY!, env.SAAS_PAYOS_API_KEY!, env.TENANT_SECRETS_KEY!]) {
        expect(text).not.toContain(secret);
      }
      expect(Object.keys(result.data).filter((key) => /(?:_enc|secret|apiKey|checksumKey|clientId)/i.test(key))).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('preserves actual backend role restrictions: tenant staff cannot read config or HQ data', async () => {
    const { db, sqlite } = createMigratedD1();
    try {
      const env = buildEnv(db);
      const owner = await signupTenant(env, { slug: 'role-shop', shopName: 'Role Shop', ownerEmail: 'role@example.test' });
      for (const role of ['staff', 'manager', 'owner', 'admin']) {
        const id = `actor-${role}`;
        sqlite.prepare(`INSERT INTO users (id, name, role, tenant_id, is_active, auth_version)
          VALUES (?, ?, ?, ?, 1, 1)`).run(id, id, role, owner.tenantId);
        const { token } = await issueStaffSession(env, {
          id, name: id, phone: null, role, tenant_id: owner.tenantId, is_active: 1, auth_version: 1,
        }, { email: `${role}@example.test`, sessionType: 'staff-web' });
        const headers = { Authorization: `Bearer ${token}` };
        const config = await app.fetch(new Request('https://auraspace.cafe/api/saas/payment-config', { headers }), env, dummyCtx);
        expect(config.status).toBe(role === 'staff' ? 403 : 200);
        const hq = await app.fetch(new Request('https://auraspace.cafe/api/hq/saas/overview', { headers }), env, dummyCtx);
        expect(hq.status).toBe(403);
      }
      const unauthenticated = await app.fetch(new Request('https://auraspace.cafe/api/saas/payment-config'), env, dummyCtx);
      expect(unauthenticated.status).toBe(401);
    } finally {
      sqlite.close();
    }
  });

  it('uses only existing deployment-policy origins and encodes every tenant path segment', () => {
    expect(resolveTrustedWorkerOrigin({ ENVIRONMENT: 'staging' })).toBe('https://aura-space-worker-staging.sadec-marketing-hub.workers.dev');
    for (const environment of ['local', 'development', 'test']) {
      expect(resolveTrustedWorkerOrigin({ ENVIRONMENT: environment })).toBe('http://localhost:8787');
    }
    expect(resolveTrustedWorkerOrigin({ ENVIRONMENT: 'unknown' })).toBe(workerOrigin);
    expect(resolveTrustedWorkerOrigin()).toBe(workerOrigin);
    expect(buildMerchantPayosWebhookUrls({ ENVIRONMENT: 'production' }, 'shop/a b?#')).toEqual({
      webhookUrl: `${workerOrigin}/api/webhook/payos/shop%2Fa%20b%3F%23`,
      webhookUrlPath: '/api/webhook/payos/shop%2Fa%20b%3F%23',
    });
  });
});
