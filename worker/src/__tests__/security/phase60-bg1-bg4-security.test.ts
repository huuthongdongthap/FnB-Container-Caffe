// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import { pretixRouter } from '../../routes/pretix-handlers/routes';
import { broadcastRouter } from '../../routes/broadcast-handlers/routes';
import { handleMauticBridgeRequest } from '../../tree/mautic/bridge-handler';
import { syncContacts } from '../../tree/mautic/contact-sync';
import { reviewsRouter } from '../../routes/reviews';
import { createWifiRoutes } from '../../routes/wifi';
import { registerFeatureRoutes } from '../../routes/features-router';
import * as pretixClientFactory from '../../tree/pretix/client-factory';
import * as mauticClientFactory from '../../tree/mautic/client-factory';
import type { Env } from '../../types/env';

const TEST_JWT_SECRET = 'phase60-bg1-bg4-jwt-secret-key-minimum-32-chars!!';

async function createSignatureHex(bodyText: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(bodyText));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Phase 60 Security Regression Suite (BG1..BG4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('BG1: Pretix Check-in, Social Generate, Event Detail & Webhook Tenant Isolation', () => {
    it('scopes POST /checkin, POST /generate, and GET /events/:slug to authenticated staff tenant and blocks cross-tenant overrides', async () => {
      const calls: Array<{ op: string; organizer: string; slug: string }> = [];
      vi.spyOn(pretixClientFactory, 'getPretixClient').mockReturnValue({
        getEvent: vi.fn(async (organizer: string, slug: string) => {
          calls.push({ op: 'getEvent', organizer, slug });
          return { slug, name: { vi: 'Coffee Cupping' } };
        }),
        listItems: vi.fn(async (organizer: string, slug: string) => {
          calls.push({ op: 'listItems', organizer, slug });
          return { results: [{ id: 1, name: { vi: 'Standard Ticket' } }] };
        }),
        redeemCheckin: vi.fn(async (organizer: string, slug: string) => {
          calls.push({ op: 'redeemCheckin', organizer, slug });
          return { status: 'ok' };
        }),
      } as any);

      const staffAccountDb = {
        prepare() {
          return {
            bind() {
              return {
                async first() {
                  return {
                    id: 'mgr-sadec-1',
                    name: 'SaDec Manager',
                    phone: null,
                    role: 'manager',
                    active: 1,
                    is_active: 1,
                    tenant_id: 'tenant_sadec_02',
                    auth_version: 1,
                  };
                },
              };
            },
          };
        },
      };

      const env = {
        AURA_DB: staffAccountDb,
        JWT_SECRET: TEST_JWT_SECRET,
        PRETIX_ORGANIZER: 'default',
        PRETIX_API_URL: 'https://pretix.test',
        PRETIX_API_TOKEN: 'tok_test',
      } as unknown as Env;

      const { token: sadecManagerToken } = await issueStaffSession(
        env,
        {
          id: 'mgr-sadec-1',
          name: 'SaDec Manager',
          phone: null,
          role: 'manager',
          tenant_id: 'tenant_sadec_02',
          is_active: 1,
          auth_version: 1,
        },
        { sessionType: 'staff-web' }
      );

      // 1. Standalone GET /events/:slug resolves optionalAuth() and binds to tenant_sadec_02
      const eventRes = await pretixRouter.fetch(
        new Request('https://api.test/events/cupping-2026', {
          headers: { Authorization: `Bearer ${sadecManagerToken}` },
        }),
        env
      );
      expect(eventRes.status).toBe(200);
      expect(calls.find((c) => c.op === 'getEvent')?.organizer).toBe('tenant_sadec_02');

      // 2. Cross-tenant override via X-Tenant-ID on GET /events/:slug is blocked with 403
      const spoofEventRes = await pretixRouter.fetch(
        new Request('https://api.test/events/cupping-2026', {
          headers: {
            Authorization: `Bearer ${sadecManagerToken}`,
            'X-Tenant-ID': 'default',
          },
        }),
        env
      );
      expect(spoofEventRes.status).toBe(403);

      // 3. POST /checkin uses tenant_sadec_02 organizer instead of default
      const checkinRes = await pretixRouter.fetch(
        new Request('https://api.test/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecManagerToken}`,
          },
          body: JSON.stringify({ secret: 'ticket-sec-12345678', event: 'cupping-2026', listId: 1 }),
        }),
        env
      );
      expect(checkinRes.status).toBe(200);
      expect(calls.find((c) => c.op === 'redeemCheckin')?.organizer).toBe('tenant_sadec_02');

      // 4. POST /checkin blocks cross-tenant query override (?organizer=default)
      const spoofCheckinRes = await pretixRouter.fetch(
        new Request('https://api.test/checkin?organizer=default', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecManagerToken}`,
          },
          body: JSON.stringify({ secret: 'ticket-sec-12345678', event: 'cupping-2026', listId: 1 }),
        }),
        env
      );
      expect(spoofCheckinRes.status).toBe(403);

      // 5. POST /generate uses tenant_sadec_02 organizer and blocks cross-tenant ?tenant_id=default
      calls.length = 0;
      const genRes = await pretixRouter.fetch(
        new Request('https://api.test/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecManagerToken}`,
          },
          body: JSON.stringify({ source: 'event', slug: 'cupping-2026' }),
        }),
        env
      );
      expect(genRes.status).toBe(200);
      expect(calls.find((c) => c.op === 'getEvent')?.organizer).toBe('tenant_sadec_02');

      const spoofGenRes = await pretixRouter.fetch(
        new Request('https://api.test/generate?tenant_id=default', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecManagerToken}`,
          },
          body: JSON.stringify({ source: 'event', slug: 'cupping-2026' }),
        }),
        env
      );
      expect(spoofGenRes.status).toBe(403);
    });

    it('rejects wildcard X-Tenant-ID on POST /webhook and deduplicates action-level webhooks when tenant_id column is absent', async () => {
      const secret = 'pretix-wh-secret-60';
      const payload = JSON.stringify({
        organizer: 'aura',
        event: 'cupping-2026',
        code: 'ORD99',
        action: 'pretix.event.order.paid',
      });
      const sig = await createSignatureHex(payload, secret);

      const legacyLogs: Array<{ organizer: string; event: string; code: string; action: string }> = [];
      const legacyDb = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('tenant_id')) {
                    throw new Error('no such column: tenant_id');
                  }
                  if (sql.includes('WHERE code = ? AND action = ? AND organizer = ? AND event = ?')) {
                    const [code, action, organizer, event] = args as string[];
                    return (
                      legacyLogs.find(
                        (r) =>
                          r.code === code &&
                          r.action === action &&
                          r.organizer === organizer &&
                          r.event === event
                      ) ?? null
                    );
                  }
                  return null;
                },
                async run() {
                  if (sql.includes('tenant_id')) {
                    throw new Error('no such column: tenant_id');
                  }
                  const [, organizer, event, code, action] = args as string[];
                  legacyLogs.push({ organizer, event, code, action });
                  return { success: true };
                },
              };
            },
          };
        },
      };

      const env = {
        AURA_DB: legacyDb,
        PRETIX_WEBHOOK_SECRET: secret,
      } as unknown as Env;

      // 1. Wildcard X-Tenant-ID is rejected with 400
      const wildcardRes = await pretixRouter.fetch(
        new Request('https://api.test/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-pretix-Signature': sig,
            'X-Tenant-ID': '*',
          },
          body: payload,
        }),
        env
      );
      expect(wildcardRes.status).toBe(400);

      // 2. First delivery inserts with fallbackOrganizer (tenant_sadec_02:aura)
      const firstRes = await pretixRouter.fetch(
        new Request('https://api.test/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-pretix-Signature': sig,
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: payload,
        }),
        env
      );
      expect(firstRes.status).toBe(200);
      const firstBody = (await firstRes.json()) as { duplicate?: boolean };
      expect(firstBody.duplicate).toBeUndefined();
      expect(legacyLogs).toHaveLength(1);
      expect(legacyLogs[0].organizer).toBe('tenant_sadec_02:aura');

      // 3. Second delivery for same tenant is deduplicated via fallbackOrganizer
      const dupRes = await pretixRouter.fetch(
        new Request('https://api.test/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-pretix-Signature': sig,
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: payload,
        }),
        env
      );
      expect(dupRes.status).toBe(200);
      const dupBody = (await dupRes.json()) as { duplicate?: boolean };
      expect(dupBody.duplicate).toBe(true);
      expect(legacyLogs).toHaveLength(1);
    });
  });

  describe('BG2: Broadcast Bulk Messaging Standalone Auth & Cross-Tenant Guard', () => {
    it('resolves JWT on standalone broadcastRouter and blocks non-HQ cross-tenant overrides', async () => {
      const boundParams: unknown[][] = [];
      const mockDb = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              boundParams.push(args);
              return {
                async first() {
                  if (/FROM users WHERE id = \?/i.test(sql)) {
                    return {
                      id: 'mgr-sadec-2',
                      name: 'SaDec Manager',
                      phone: null,
                      role: 'manager',
                      active: 1,
                      is_active: 1,
                      tenant_id: 'tenant_sadec_02',
                      auth_version: 1,
                    };
                  }
                  return null;
                },
                async all() {
                  return { results: [] };
                },
              };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };

      const env = {
        AURA_DB: mockDb,
        JWT_SECRET: TEST_JWT_SECRET,
      } as unknown as Env;

      const { token: sadecMgrToken } = await issueStaffSession(
        env,
        {
          id: 'mgr-sadec-2',
          name: 'SaDec Manager',
          phone: null,
          role: 'manager',
          tenant_id: 'tenant_sadec_02',
          is_active: 1,
          auth_version: 1,
        },
        { sessionType: 'staff-web' }
      );

      // 1. Spoofing X-Tenant-ID: default as tenant_sadec_02 manager returns 403
      const spoofHeaderRes = await broadcastRouter.fetch(
        new Request('https://api.test/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecMgrToken}`,
            'X-Tenant-ID': 'default',
          },
          body: JSON.stringify({
            segment: 'loyalty_gold',
            channel: 'sms',
            message: 'Promo message',
          }),
        }),
        env
      );
      expect(spoofHeaderRes.status).toBe(403);

      // 2. Spoofing ?tenant_id=* returns 403
      const spoofQueryRes = await broadcastRouter.fetch(
        new Request('https://api.test/send?tenant_id=*', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecMgrToken}`,
          },
          body: JSON.stringify({
            segment: 'loyalty_gold',
            channel: 'sms',
            message: 'Promo message',
          }),
        }),
        env
      );
      expect(spoofQueryRes.status).toBe(403);

      // 3. Valid request for own tenant succeeds and binds tenant_sadec_02
      const validRes = await broadcastRouter.fetch(
        new Request('https://api.test/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecMgrToken}`,
          },
          body: JSON.stringify({
            segment: 'loyalty_gold',
            channel: 'sms',
            message: 'Promo message',
          }),
        }),
        env
      );
      expect(validRes.status).toBe(400);
      const validBody = (await validRes.json()) as { error?: string };
      expect(validBody.error).toContain('Không có khách hàng');
      expect(boundParams.some((args) => args.includes('tenant_sadec_02'))).toBe(true);
    });
  });

  describe('BG3: Mautic Bridge Cross-Tenant Override Guard & Order Status Filtering', () => {
    it('blocks cross-tenant and wildcard overrides in handleMauticBridgeRequest and excludes canceled/refunded orders in syncContacts', async () => {
      // 1. Wildcard override rejected when resolvedTenantId is not '*'
      const wildcardRes = await handleMauticBridgeRequest(
        new Request('https://api.test/api/mautic-bridge/status', {
          headers: { 'X-Tenant-ID': '*' },
        }),
        {} as never,
        'tenant_sadec_02'
      );
      expect(wildcardRes.status).toBe(403);

      // 2. Mismatched X-Tenant-ID rejected when resolvedTenantId is concrete
      const mismatchRes = await handleMauticBridgeRequest(
        new Request('https://api.test/api/mautic-bridge/sync-contacts', {
          method: 'POST',
          headers: { 'X-Tenant-ID': 'default' },
        }),
        {} as never,
        'tenant_sadec_02'
      );
      expect(mismatchRes.status).toBe(403);

      // 3. syncContacts SQL excludes 'canceled' and 'refunded' in both primary and fallback queries
      const executedSqls: string[] = [];
      let callCount = 0;
      const mockDb = {
        prepare(sql: string) {
          executedSqls.push(sql);
          return {
            bind() {
              return {
                async all() {
                  callCount++;
                  if (callCount === 1) {
                    throw new Error('no such column: tier');
                  }
                  return {
                    results: [
                      {
                        id: 'cust_1',
                        name: 'Alice',
                        phone: '0901234567',
                        email: 'alice@aura.vn',
                        tier: 'GOLD',
                        total_spent: 150000,
                        visit_count: 3,
                        tenant_id: 'tenant_sadec_02',
                        last_visit: '2026-11-01T10:00:00.000Z',
                      },
                    ],
                  };
                },
              };
            },
          };
        },
      };

      vi.spyOn(mauticClientFactory, 'getMauticClient').mockReturnValue({
        syncContacts: vi.fn(async () => ({ created: 1, updated: 0, errors: [] })),
      } as any);

      const syncRes = await syncContacts({ AURA_DB: mockDb as any }, 'tenant_sadec_02');
      expect(syncRes.success).toBe(true);
      expect(executedSqls.length).toBeGreaterThanOrEqual(2);
      for (const sql of executedSqls) {
        expect(sql).toContain("'canceled'");
        expect(sql).toContain("'refunded'");
        expect(sql).toContain("'rejected'");
      }
    });
  });

  describe('BG4: Reviews Order Status & Cross-Tenant Guard, WiFi Override Confinement & Admin Notification Settings', () => {
    it('rejects cross-tenant review queries by authenticated users and blocks reviews on rejected/expired/refunded/canceled orders', async () => {
      const custToken = await generateJWT(
        { id: 'cust_sadec_1', role: 'customer', tenantId: 'tenant_sadec_02' },
        TEST_JWT_SECRET,
        3600
      );

      let currentOrderStatus = 'rejected';
      const mockDb = {
        prepare(sql: string) {
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes('FROM orders WHERE id = ?')) {
                    return {
                      id: 'ord_sadec_1',
                      customer_id: 'cust_sadec_1',
                      status: currentOrderStatus,
                      tenant_id: 'tenant_sadec_02',
                    };
                  }
                  return null;
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      };

      const env = {
        AURA_DB: mockDb,
        JWT_SECRET: TEST_JWT_SECRET,
      } as unknown as Env;

      // 1. Authenticated user spoofing X-Tenant-ID: default on GET /reviews gets 403
      const spoofListRes = await reviewsRouter.fetch(
        new Request('https://api.test/?page=1', {
          headers: {
            Authorization: `Bearer ${custToken}`,
            'X-Tenant-ID': 'default',
          },
        }),
        env
      );
      expect(spoofListRes.status).toBe(403);

      // 2. Non-reviewable order statuses ('rejected', 'expired', 'refunded', 'canceled') return 400
      for (const badStatus of ['rejected', 'expired', 'refunded', 'canceled']) {
        currentOrderStatus = badStatus;
        const postRes = await reviewsRouter.fetch(
          new Request('https://api.test/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${custToken}`,
            },
            body: JSON.stringify({
              order_id: 'ord_sadec_1',
              rating: 5,
              comment: 'Trying to review non-completed order',
            }),
          }),
          env
        );
        expect(postRes.status).toBe(400);
      }
    });

    it('blocks cross-tenant WiFi authorize overrides and cross-tenant admin notification settings access', async () => {
      const kvMap = new Map<string, string>();
      const mockKv = {
        get: vi.fn(async (k: string) => kvMap.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => {
          kvMap.set(k, v);
        }),
      };

      const mockDb = {
        prepare(sql: string) {
          return {
            bind() {
              return {
                async first() {
                  if (/FROM users WHERE id = \?/i.test(sql)) {
                    return {
                      id: 'mgr-sadec-4',
                      name: 'SaDec Manager',
                      phone: null,
                      role: 'manager',
                      tenant_id: 'tenant_sadec_02',
                      is_active: 1,
                      active: 1,
                      auth_version: 1,
                    };
                  }
                  return null;
                },
                async run() {
                  return { success: true };
                },
              };
            },
          };
        },
      };

      const env = {
        AURA_DB: mockDb,
        AUTH_KV: mockKv,
        JWT_SECRET: TEST_JWT_SECRET,
      } as unknown as Env;

      const { token: sadecMgrToken } = await issueStaffSession(
        env,
        {
          id: 'mgr-sadec-4',
          name: 'SaDec Manager',
          phone: null,
          role: 'manager',
          tenant_id: 'tenant_sadec_02',
          is_active: 1,
          auth_version: 1,
        },
        { sessionType: 'staff-web' }
      );

      // 1. WiFi POST /authorize blocks cross-tenant X-Tenant-ID override
      const wifiApp = createWifiRoutes();
      const wifiSpoofRes = await wifiApp.fetch(
        new Request('https://api.test/authorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecMgrToken}`,
            'X-Tenant-ID': 'default',
          },
          body: JSON.stringify({
            mac: 'AA:BB:CC:DD:EE:FF',
            action: 'grant',
            duration_seconds: 3600,
          }),
        }),
        env
      );
      expect(wifiSpoofRes.status).toBe(403);

      // 2. Admin notification-settings blocks cross-tenant GET/PATCH and scopes to tenant_sadec_02
      const featureApp = new Hono<{ Bindings: Env }>();
      registerFeatureRoutes(featureApp);

      const notifSpoofGet = await featureApp.fetch(
        new Request('https://api.test/api/admin/notification-settings?tenant_id=default', {
          headers: { Authorization: `Bearer ${sadecMgrToken}` },
        }),
        env
      );
      expect(notifSpoofGet.status).toBe(403);

      const notifSpoofPatch = await featureApp.fetch(
        new Request('https://api.test/api/admin/notification-settings', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecMgrToken}`,
            'X-Tenant-ID': 'default',
          },
          body: JSON.stringify({ autoNotifyNewOrder: true, soundAlerts: true }),
        }),
        env
      );
      expect(notifSpoofPatch.status).toBe(403);

      const notifValidPatch = await featureApp.fetch(
        new Request('https://api.test/api/admin/notification-settings', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sadecMgrToken}`,
          },
          body: JSON.stringify({ autoNotifyNewOrder: true, soundAlerts: false }),
        }),
        env
      );
      expect(notifValidPatch.status).toBe(200);
      expect(kvMap.get('config:notification_settings:tenant_sadec_02')).toBe(
        JSON.stringify({ autoNotifyNewOrder: true, soundAlerts: false })
      );
      expect(kvMap.has('config:notification_settings')).toBe(false);
    });
  });
});
