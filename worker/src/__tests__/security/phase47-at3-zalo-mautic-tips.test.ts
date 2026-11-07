import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { issueStaffSession } from '../../lib/staff-session';
import { handleZaloRequest, notifyMember } from '../../routes/zalo';
import { zaloWebhookRouter, verifyZaloSignature } from '../../routes/zalo-webhook';
import * as customerAssistant from '../../routes/customer-assistant';
import * as mauticClientFactory from '../../tree/mautic/client-factory';
import * as mauticClientLib from '../../lib/mautic-client';
import { triggerPromoCampaign } from '../../tree/mautic/promo-campaign';
import { syncContacts } from '../../tree/mautic/contact-sync';
import { syncMauticContacts } from '../../tree/mautic/contact-sync-cron';
import { detectWinbackCandidates } from '../../tree/mautic/campaign-detection';
import { syncSegments } from '../../tree/mautic/segment-sync';
import { staffTipsRouter } from '../../../../packages/domain/staff/commands/staff-tips';
import type { Env } from '../../types/env';

async function signZaloBody(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Zalo ZNS/Webhook Replay & Dedup Safety, Mautic Tenant Isolation & Staff Tips Ledger Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles malformed JSON in /api/zalo/send and enforces default/non-default tenant scoping in notifyMember', async () => {
    const badReq = new Request('https://api.test/api/zalo/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad-json',
    });
    const badRes = await handleZaloRequest(badReq, {});
    expect(badRes.status).toBe(400);
    await expect(badRes.json()).resolves.toMatchObject({ success: false, error: 'Invalid JSON body' });

    const sqlLog: string[] = [];
    const crossTenantDb = {
      prepare: (sql: string) => {
        sqlLog.push(sql);
        return {
          bind: () => ({
            first: async () => ({ id: 'cust_b', name: 'Store B Customer', phone: '0909111222', zalo: null, tenant_id: 'store-b' }),
          }),
        };
      },
    } as unknown as D1Database;

    const crossRes = await notifyMember({ AURA_DB: crossTenantDb }, {
      customer_id: 'cust_b',
      template_key: 'order_confirmed',
      data: { order_id: 'ORD-1' },
    });
    expect(crossRes).toEqual({ ok: false, channel: 'pos_only', reason: 'customer_not_found' });

    const throwingScopedDb = {
      prepare: (sql: string) => {
        sqlLog.push(sql);
        return {
          bind: () => ({
            first: async () => {
              if (sql.includes('COALESCE')) throw new Error('no such column: tenant_id');
              return { id: 'cust_b', name: 'Leaked', phone: '0909111222', zalo: null };
            },
          }),
        };
      },
    } as unknown as D1Database;

    sqlLog.length = 0;
    const failClosedRes = await notifyMember(
      { AURA_DB: throwingScopedDb },
      { customer_id: 'cust_b', template_key: 'order_confirmed', data: {}, tenantId: 'store-a' }
    );
    expect(failClosedRes).toEqual({ ok: false, channel: 'pos_only', reason: 'customer_not_found' });
    expect(sqlLog).toHaveLength(1);
  });

  it('enforces 10-digit Unix seconds replay window and records dedup key only after processCustomerQuery succeeds', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/webhooks/zalo', zaloWebhookRouter);
    const secret = 'zalo_test_secret_key_123';
    const kvStore = new Map<string, string>();
    const env = {
      ENVIRONMENT: 'production',
      PILOT_TENANT_ID: 'store-a',
      ZALO_OA_SECRET: secret,
      AURA_DB: {} as D1Database,
      AUTH_KV: {
        get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v); }),
      },
    } as unknown as Env;

    const staleSeconds = Math.floor((Date.now() - 3600 * 1000) / 1000);
    const staleBody = JSON.stringify({
      event_name: 'user_send_text',
      timestamp: String(staleSeconds),
      message: { text: 'Xin chào', msg_id: 'msg_stale_1' },
    });
    const staleSig = await signZaloBody(staleBody, secret);
    expect(await verifyZaloSignature(staleBody, staleSig, secret)).toBe(true);

    const staleRes = await app.fetch(
      new Request('https://api.test/api/webhooks/zalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ZaloOA-Signature': staleSig },
        body: staleBody,
      }),
      env
    );
    expect(staleRes.status).toBe(401);

    const freshSeconds = Math.floor(Date.now() / 1000);
    const retryBody = JSON.stringify({
      event_name: 'user_send_text',
      timestamp: freshSeconds,
      message: { text: 'Menu hôm nay', msg_id: 'msg_retry_1' },
    });
    const retrySig = await signZaloBody(retryBody, secret);

    const querySpy = vi.spyOn(customerAssistant, 'processCustomerQuery')
      .mockRejectedValueOnce(new Error('Transient D1 timeout'))
      .mockResolvedValue({ intent: 'menu', reply: 'Cà phê sữa đá', engine: 'rule' });

    const firstAttempt = await app.fetch(
      new Request('https://api.test/api/webhooks/zalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ZaloOA-Signature': retrySig, 'X-Tenant-ID': 'store-a' },
        body: retryBody,
      }),
      env
    );
    expect(firstAttempt.status).toBe(500);
    expect(kvStore.has('zalo_msg:store-a:msg_retry_1')).toBe(false);

    const secondAttempt = await app.fetch(
      new Request('https://api.test/api/webhooks/zalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ZaloOA-Signature': retrySig, 'X-Tenant-ID': 'store-a' },
        body: retryBody,
      }),
      env
    );
    expect(secondAttempt.status).toBe(200);
    expect(kvStore.get('zalo_msg:store-a:msg_retry_1')).toBe('1');
    expect(querySpy).toHaveBeenCalledTimes(2);
  });

  it('deduplicates promo campaigns, excludes cancelled orders in Mautic sync/winback, and isolates fallback emails by tenant', async () => {
    const mockClient = {
      createOrUpdateContact: vi.fn().mockResolvedValue(101),
      addContactToCampaign: vi.fn().mockResolvedValue(true),
      addContactToSegment: vi.fn().mockResolvedValue(true),
      syncContacts: vi.fn().mockResolvedValue({ created: 1, updated: 0, errors: [] }),
      batchUpsertContacts: vi.fn().mockResolvedValue({ created: [], updated: [] }),
    };
    vi.spyOn(mauticClientFactory, 'getMauticClient').mockReturnValue(mockClient as never);
    vi.spyOn(mauticClientLib, 'createMauticClient').mockReturnValue(mockClient as never);

    const executedSql: string[] = [];
    const promoDb = {
      prepare: (sql: string) => {
        executedSql.push(sql);
        return {
          bind: (...args: unknown[]) => ({
            all: async () => ({
              results: [
                { id: 'c_enrolled', name: 'Already Enrolled', phone: '0901111111', email: 'e1@aura.vn', loyalty_tier: 'gold', tenant_id: 'store-a' },
                { id: 'c_fresh', name: 'Fresh Member', phone: '0902222222', email: 'e2@aura.vn', loyalty_tier: 'gold', tenant_id: 'store-a' },
              ],
            }),
            first: async () => (args[0] === 'c_enrolled' ? { 1: 1 } : null),
            run: async () => ({ success: true }),
          }),
        };
      },
    } as unknown as D1Database;

    const promoRes = await triggerPromoCampaign(
      { AURA_DB: promoDb, MAUTIC_CAMPAIGN_PROMO: '30' },
      { segment: { tier: 'gold' }, templateName: 'vip', promoTitle: 'VIP', promoDesc: 'Desc' },
      'store-a'
    );
    expect(promoRes.enrolled).toBe(1);
    expect(mockClient.createOrUpdateContact).toHaveBeenCalledTimes(1);

    executedSql.length = 0;
    const syncDb = {
      prepare: (sql: string) => {
        executedSql.push(sql);
        return {
          bind: () => ({
            all: async () => ({
              results: [{ id: 'c_no_email', name: 'No Email', phone: '0903333333', email: null, tier: 'GOLD', tenant_id: 'store-a' }],
            }),
          }),
        };
      },
    } as unknown as D1Database;

    await syncContacts({ AURA_DB: syncDb }, 'store-a');
    expect(executedSql[0]).toContain("NOT IN ('cancelled', 'rejected', 'failed', 'expired')");
    expect(mockClient.syncContacts).toHaveBeenCalledWith([
      expect.objectContaining({ email: 'store-a+0903333333@aura-cafe.internal' }),
    ]);

    await syncMauticContacts({ AURA_DB: syncDb, MAUTIC_BASE_URL: 'https://m.test', MAUTIC_CLIENT_ID: 'id', MAUTIC_CLIENT_SECRET: 'sec' }, 'store-a');
    await detectWinbackCandidates({ AURA_DB: syncDb, MAUTIC_CAMPAIGN_WINBACK: '10' }, 'store-a');
    const orderQueries = executedSql.filter((q) => q.includes('FROM orders'));
    expect(orderQueries.length).toBeGreaterThanOrEqual(3);
    expect(orderQueries.every((q) => q.includes("NOT IN ('cancelled', 'rejected', 'failed', 'expired')"))).toBe(true);

    const assigned = await syncSegments(
      { MAUTIC_SEGMENT_LOYALTY_GOLD: 5 },
      mockClient as never,
      [
        { id: 'c_a', phone: '0903333333', email: null, loyalty_tier: 'gold', tenant_id: 'store-a' },
        { id: 'c_b', phone: '0903333333', email: null, loyalty_tier: 'gold', tenant_id: 'store-b' },
      ],
      { 'store-a+0903333333@aura-cafe.internal': 501, '0903333333@aura-cafe.internal': 999 }
    );
    expect(assigned).toBe(1);
    expect(mockClient.addContactToSegment).toHaveBeenCalledWith(501, 5);
  });

  it('enforces fail-closed staff-tips RBAC, integer tip_amount, refunded/rejected order guards, and tenant-scoped UPDATE', async () => {
    const jwtSecret = 'test_jwt_secret_for_staff_tips_32_bytes_long!';
    const sqlLog: string[] = [];
    const makeTipsSetup = (role: string, userId = 'staff_1', tenantId = 'store-a', orderRow: Record<string, unknown> | null = null, throwOnScopedUpdate = false) => {
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/staff-tips', staffTipsRouter);
      const db = {
        prepare: (sql: string) => {
          sqlLog.push(sql);
          return {
            bind: (...args: unknown[]) => ({
              all: async () => ({ results: [] }),
              first: async () => {
                if (sql.includes('FROM users WHERE id = ?')) {
                  return { id: String(args[0] || userId), name: 'Staff', phone: '0900000000', role, tenant_id: tenantId, is_active: 1, auth_version: 1 };
                }
                if (sql.includes('FROM orders WHERE id = ?')) return orderRow;
                return null;
              },
              run: async () => {
                if (throwOnScopedUpdate && sql.includes('COALESCE')) throw new Error('D1 write error');
                return { success: true };
              },
            }),
          };
        },
      } as unknown as D1Database;
      return { app, env: { AURA_DB: db, JWT_SECRET: jwtSecret } as unknown as Env };
    };

    const makeAuthHeader = async (id: string, role: string, tenantId = 'store-a') => {
      const s = await issueStaffSession(
        { JWT_SECRET: jwtSecret },
        { id, name: 'Staff', phone: '0900000000', role, tenant_id: tenantId, is_active: 1, auth_version: 1 },
        { email: `${id}@aura.vn`, sessionType: 'staff-web' }
      );
      return `Bearer ${s.token}`;
    };

    const { app: waiterApp, env: waiterEnv } = makeTipsSetup('waiter', 'waiter_1');
    const waiterToken = await makeAuthHeader('waiter_1', 'waiter');
    const crossListRes = await waiterApp.fetch(
      new Request('https://api.test/api/staff-tips?staff_id=waiter_2', { headers: { Authorization: waiterToken } }),
      waiterEnv
    );
    expect(crossListRes.status).toBe(403);
    const crossHistRes = await waiterApp.fetch(
      new Request('https://api.test/api/staff-tips/waiter_2', { headers: { Authorization: waiterToken } }),
      waiterEnv
    );
    expect(crossHistRes.status).toBe(403);

    const mgrToken = await makeAuthHeader('mgr_1', 'manager');
    const { app: mgrApp, env: mgrEnv } = makeTipsSetup(
      'manager',
      'mgr_1',
      'store-a',
      { id: 'ord_1', status: 'completed', payment_status: 'refunded', total: 100000, tenant_id: 'store-a' },
      true
    );
    sqlLog.length = 0;
    await mgrApp.fetch(new Request('https://api.test/api/staff-tips', { headers: { Authorization: mgrToken } }), mgrEnv);
    expect(sqlLog.some((s) => s.includes("COALESCE(o.payment_status, '') != 'refunded'"))).toBe(true);

    const fracRes = await mgrApp.fetch(
      new Request('https://api.test/api/staff-tips/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: mgrToken },
        body: JSON.stringify({ order_id: 'ord_1', staff_id: 'staff_1', tip_amount: 1500.5 }),
      }),
      mgrEnv
    );
    expect(fracRes.status).toBe(400);

    const refundedPaymentRes = await mgrApp.fetch(
      new Request('https://api.test/api/staff-tips/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: mgrToken },
        body: JSON.stringify({ order_id: 'ord_1', staff_id: 'staff_1', tip_amount: 15000 }),
      }),
      mgrEnv
    );
    expect(refundedPaymentRes.status).toBe(400);

    const { app: failClosedApp, env: failClosedEnv } = makeTipsSetup(
      'manager',
      'mgr_1',
      'store-a',
      { id: 'ord_2', status: 'completed', payment_status: 'paid', total: 100000, tenant_id: 'store-a' },
      true
    );
    sqlLog.length = 0;
    const updateFailRes = await failClosedApp.fetch(
      new Request('https://api.test/api/staff-tips/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: mgrToken },
        body: JSON.stringify({ order_id: 'ord_2', staff_id: 'staff_1', tip_amount: 15000 }),
      }),
      failClosedEnv
    );
    expect(updateFailRes.status).toBe(500);
    expect(sqlLog.some((s) => s === 'UPDATE orders SET tip_amount = ?, updated_by = ?, updated_at = ? WHERE id = ?')).toBe(false);
  });
});
