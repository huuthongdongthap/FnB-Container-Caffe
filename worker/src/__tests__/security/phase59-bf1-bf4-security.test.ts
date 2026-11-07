import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { issueStaffSession } from '../../lib/staff-session';
import { dindinRouter } from '../../routes/dindin-handlers/routes';
import { cartKVKey, scopedCartSessionId } from '../../routes/dindin-handlers/types';
import { mixpostRouter } from '../../routes/mixpost-handlers/routes';
import { handleMixpostRequest } from '../../tree/mixpost/legacy-handler';
import { campaignsRouter } from '../../routes/campaigns-handlers/routes';
import { calBookingWebhookRouter } from '../../routes/cal-booking-webhook-handlers/routes';
import { handleCalBookingWebhook } from '../../routes/cal-booking-webhook-handlers/webhook-handler';
import { adminQRRouter } from '../../routes/admin-qr';
import { adminSalesRouter } from '../../routes/admin-sales';
import type { Env, MixpostEnv } from '../../types/env';

const JWT_SECRET = 'phase59-bf1-bf4-security-test-secret-32chars!';

async function makeToken(payload: { id: string; role: string; tenantId: string }): Promise<string> {
  const session = await issueStaffSession(
    { JWT_SECRET },
    { id: payload.id, name: payload.id, phone: '0900000001', role: payload.role, tenant_id: payload.tenantId, is_active: 1, auth_version: 1 },
    { email: `${payload.id}@aura.vn`, sessionType: 'staff-web' }
  );
  return session.token;
}

describe('Phase 59 Security Suite — DinDin, Mixpost, Campaigns, Cal Booking, Admin QR & Sales CSV', () => {
  describe('DinDin Multi-Tenant Isolation, Session Namespace & QC Payment Guard', () => {
    it('prevents default-tenant session IDs containing :: from colliding with non-default tenant cart keys', () => {
      const storeBCartKey = cartKVKey('sess-1', 'store-b');
      const maliciousDefaultCartKey = cartKVKey('store-b::sess-1', 'default');
      expect(storeBCartKey).toBe('dindin:store-b:cart:sess-1');
      expect(maliciousDefaultCartKey).toBe('dindin:cart:default::store-b::sess-1');
      expect(maliciousDefaultCartKey).not.toBe(storeBCartKey);

      const storeBD1Key = scopedCartSessionId('sess-1', 'store-b');
      const maliciousDefaultD1Key = scopedCartSessionId('store-b::sess-1', 'default');
      expect(storeBD1Key).toBe('store-b::sess-1');
      expect(maliciousDefaultD1Key).toBe('default::store-b::sess-1');
      expect(maliciousDefaultD1Key).not.toBe(storeBD1Key);
    });

    it('rejects non-HQ cross-tenant overrides on DinDin cart and config routes with 403', async () => {
      const token = await makeToken({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/dindin', dindinRouter);

      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              first: async () => {
                if (sql.includes('FROM users')) {
                  return { id: 'mgr-a', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
                }
                return null;
              },
              run: async () => ({}),
            }),
          }),
        } as unknown as D1Database,
      } as Env;

      const cartRes = await app.request(
        'http://localhost/api/dindin/carts?tenantId=store-b',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(cartRes.status).toBe(403);

      const configRes = await app.request(
        'http://localhost/api/dindin/config',
        { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-b' } },
        env
      );
      expect(configRes.status).toBe(403);
    });

    it('rejects DinDin QC verification for canceled/rejected orders or refunded/failed COD orders', async () => {
      const token = await makeToken({ id: 'staff-a', role: 'staff', tenantId: 'store-a' });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/dindin', dindinRouter);

      let currentOrder: Record<string, unknown> = {
        id: 'DIN-CANCELED',
        status: 'canceled',
        payment_status: 'paid',
        payment_method: 'cash',
        tenant_id: 'store-a',
      };

      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              first: async () => {
                if (sql.includes('FROM users')) {
                  return { id: 'staff-a', role: 'staff', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
                }
                return currentOrder;
              },
              run: async () => ({ meta: { changes: 1 } }),
            }),
          }),
        } as unknown as D1Database,
      } as Env;

      const canceledRes = await app.request(
        'http://localhost/api/dindin/checkout/DIN-CANCELED/qc',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ verifiedBy: 'staff-a' }),
        },
        env
      );
      expect(canceledRes.status).toBe(409);

      currentOrder = {
        id: 'DIN-COD-REFUNDED',
        status: 'confirmed',
        payment_status: 'refunded',
        payment_method: 'cod',
        tenant_id: 'store-a',
      };

      const refundedCodRes = await app.request(
        'http://localhost/api/dindin/checkout/DIN-COD-REFUNDED/qc',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ verifiedBy: 'staff-a' }),
        },
        env
      );
      expect(refundedCodRes.status).toBe(409);
    });
  });

  describe('Mixpost Social Publishing & Legacy Handler Confinement', () => {
    it('blocks non-HQ cross-tenant overrides and low-privilege staff publishing on mixpostRouter', async () => {
      const staffToken = await makeToken({ id: 'waiter-1', role: 'waiter', tenantId: 'store-a' });
      const managerToken = await makeToken({ id: 'mgr-1', role: 'manager', tenantId: 'store-a' });
      const app = new Hono<{ Bindings: MixpostEnv }>();
      app.route('/api/mixpost', mixpostRouter);

      let activeUser: Record<string, unknown> = { id: 'mgr-1', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 };

      const env = {
        JWT_SECRET,
        MIXPOST_API_URL: 'https://mixpost.example.com',
        MIXPOST_API_TOKEN: 'tok-123',
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              all: async () => ({ results: [] }),
              first: async () => (sql.includes('FROM users') ? activeUser : null),
            }),
          }),
        } as unknown as D1Database,
      } as unknown as MixpostEnv;

      const crossTenantRes = await app.request(
        'http://localhost/api/mixpost/posts?tenantId=store-b',
        { headers: { Authorization: `Bearer ${managerToken}` } },
        env
      );
      expect(crossTenantRes.status).toBe(403);

      activeUser = { id: 'waiter-1', role: 'waiter', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
      const staffPublishRes = await app.request(
        'http://localhost/api/mixpost/posts',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Hello world', accounts: [1] }),
        },
        env
      );
      expect(staffPublishRes.status).toBe(403);
    });

    it('blocks cross-tenant overrides in handleMixpostRequest when resolvedTenantId is concrete', async () => {
      const env = {
        AURA_DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) } as unknown as D1Database,
      } as MixpostEnv;

      const mismatchHeaderReq = new Request('http://localhost/api/mixpost/posts?tenantId=store-b', {
        headers: { 'X-Tenant-ID': 'store-b' },
      });
      const res = await handleMixpostRequest(mismatchHeaderReq, env, 'store-a');
      expect(res.status).toBe(403);

      const wildcardHeaderReq = new Request('http://localhost/api/mixpost/posts', {
        headers: { 'X-Tenant-ID': '*' },
      });
      const resWildcard = await handleMixpostRequest(wildcardHeaderReq, env, 'store-a');
      expect(resWildcard.status).toBe(403);
    });
  });

  describe('Campaigns Multi-Tenant Isolation & Cross-Tenant Override Guard', () => {
    it('rejects non-HQ cross-tenant header/query overrides on /api/campaigns and filters cross-tenant rows', async () => {
      const token = await makeToken({ id: 'mgr-a', role: 'manager', tenantId: 'default' });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/campaigns', campaignsRouter);

      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              all: async () => ({
                results: [
                  { trigger: 'welcome', is_active: 1, channels: '["sms"]', tenant_id: 'default' },
                  { trigger: 'birthday', is_active: 1, channels: '["zalo"]', tenant_id: 'store-b' },
                ],
              }),
              first: async () => {
                if (sql.includes('FROM users')) {
                  return { id: 'mgr-a', role: 'manager', tenant_id: 'default', is_active: 1, auth_version: 1 };
                }
                return {
                  trigger: 'birthday',
                  is_active: 1,
                  channels: '["zalo"]',
                  tenant_id: 'store-b',
                };
              },
              run: async () => ({}),
            }),
          }),
        } as unknown as D1Database,
      } as Env;

      const overrideRes = await app.request(
        'http://localhost/api/campaigns?tenantId=store-b',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(overrideRes.status).toBe(403);

      const crossRowRes = await app.request(
        'http://localhost/api/campaigns/birthday',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(crossRowRes.status).toBe(404);
    });
  });

  describe('Cal Booking Webhook, Admin QR & Admin Sales CSV Hardening', () => {
    it('masks nested PII in booking metadata and blocks cross-tenant overrides on GET /bookings', async () => {
      const waiterToken = await makeToken({ id: 'w-1', role: 'waiter', tenantId: 'store-a' });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/cal-booking-webhook', calBookingWebhookRouter);

      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              first: async () => {
                if (sql.includes('FROM users')) {
                  return { id: 'w-1', role: 'waiter', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
                }
                return null;
              },
              all: async () => ({
                results: [
                  {
                    id: 'rsv-1',
                    cal_uid: 'uid-1',
                    attendee_name: 'Alice',
                    attendee_email: 'alice@example.com',
                    guest_phone: '0901234567',
                    tenant_id: 'store-a',
                    metadata: JSON.stringify({
                      phone: '0901234567',
                      responses: { email: 'alice@example.com', phone: '0901234567' },
                      attendees: [{ email: 'guest2@example.com', phone: '0987654321' }],
                    }),
                  },
                ],
              }),
            }),
          }),
        } as unknown as D1Database,
      } as Env;

      const crossRes = await app.request(
        'http://localhost/api/cal-booking-webhook/bookings?tenantId=store-b',
        { headers: { Authorization: `Bearer ${waiterToken}` } },
        env
      );
      expect(crossRes.status).toBe(403);

      const okRes = await app.request(
        'http://localhost/api/cal-booking-webhook/bookings',
        { headers: { Authorization: `Bearer ${waiterToken}`, 'X-Tenant-ID': 'store-a' } },
        env
      );
      expect(okRes.status).toBe(200);
      const body = (await okRes.json()) as { data: Array<{ attendee_email: string; guest_phone: string; metadata: string }> };
      expect(body.data[0].attendee_email).toBe('a***@example.com');
      expect(body.data[0].guest_phone).toBe('***567');
      const parsedMeta = JSON.parse(body.data[0].metadata);
      expect(parsedMeta.phone).toBe('***567');
      expect(parsedMeta.responses.email).toBe('a***@example.com');
      expect(parsedMeta.responses.phone).toBe('***567');
      expect(parsedMeta.attendees[0].email).toBe('g***@example.com');
      expect(parsedMeta.attendees[0].phone).toBe('***321');
    });

    it('rejects conflicting webhook header vs metadata tenant_id and cross-tenant UID collisions on BOOKING_CREATED', async () => {
      const secret = 'cal-webhook-secret-test';
      const env = {
        CAL_WEBHOOK_SECRET: secret,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              all: async () => {
                if (sql.includes('FROM reservations WHERE cal_booking_uid')) {
                  return { results: [{ id: 'rsv-existing', tenant_id: 'store-a' }] };
                }
                return { results: [] };
              },
              first: async () => {
                if (sql.includes('FROM reservations WHERE cal_booking_uid')) {
                  return { id: 'rsv-existing', tenant_id: 'store-a' };
                }
                return null;
              },
            }),
          }),
        } as unknown as D1Database,
      } as Env;

      const conflictReq = new Request('http://localhost/api/cal-booking-webhook', {
        method: 'POST',
        headers: {
          'x-cal-webhook-secret': secret,
          'X-Tenant-ID': 'store-b',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          triggerEvent: 'BOOKING_CREATED',
          payload: {
            uid: 'uid-conflict-1',
            startTime: '2026-11-04T10:00:00Z',
            endTime: '2026-11-04T11:00:00Z',
            metadata: { tenant_id: 'store-a' },
          },
        }),
      });
      const conflictRes = await handleCalBookingWebhook(conflictReq, env);
      expect(conflictRes.status).toBe(400);

      const collisionReq = new Request('http://localhost/api/cal-booking-webhook', {
        method: 'POST',
        headers: {
          'x-cal-webhook-secret': secret,
          'X-Tenant-ID': 'store-b',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          triggerEvent: 'BOOKING_CREATED',
          payload: {
            uid: 'uid-owned-by-store-a',
            startTime: '2026-11-04T10:00:00Z',
            endTime: '2026-11-04T11:00:00Z',
            metadata: { tenant_id: 'store-b' },
          },
        }),
      });
      const collisionRes = await handleCalBookingWebhook(collisionReq, env);
      expect(collisionRes.status).toBe(409);
    });

    it('blocks non-HQ cross-tenant overrides on adminQRRouter', async () => {
      const token = await makeToken({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/admin/qr', adminQRRouter);

      const env = {
        JWT_SECRET,
        QR_SIGNING_SECRET: 'qr-secret-key-123456',
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              first: async () =>
                sql.includes('FROM users')
                  ? { id: 'mgr-a', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 }
                  : null,
              all: async () => ({ results: [] }),
            }),
          }),
        } as unknown as D1Database,
      } as Env;

      const res = await app.request(
        'http://localhost/api/admin/qr/tables?tenantId=store-b',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(res.status).toBe(403);
    });

    it('blocks camelCase tenantId overrides and filters cross-tenant/canceled/rejected rows in adminSalesRouter CSV export', async () => {
      const token = await makeToken({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/admin/sales', adminSalesRouter);

      const env = {
        JWT_SECRET,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: () => ({
              first: async () =>
                sql.includes('FROM users')
                  ? { id: 'mgr-a', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 }
                  : null,
              all: async () => ({
                results: [
                  {
                    id: 'ORD-VALID-A',
                    customer_name: 'Nguyen Van A',
                    items: '[{"name":"Latte"}]',
                    total: 55000,
                    payment_method: 'cash',
                    status: 'completed',
                    payment_status: 'paid',
                    tenant_id: 'store-a',
                    created_at: '2026-11-04T08:00:00Z',
                  },
                  {
                    id: 'ORD-CANCELED-A',
                    customer_name: 'Canceled Guest',
                    items: '[]',
                    total: 99000,
                    payment_method: 'cash',
                    status: 'canceled',
                    payment_status: 'paid',
                    tenant_id: 'store-a',
                    created_at: '2026-11-04T08:05:00Z',
                  },
                  {
                    id: 'ORD-REJECTED-A',
                    customer_name: 'Rejected Guest',
                    items: '[]',
                    total: 88000,
                    payment_method: 'cash',
                    status: 'rejected',
                    payment_status: 'paid',
                    tenant_id: 'store-a',
                    created_at: '2026-11-04T08:06:00Z',
                  },
                  {
                    id: 'ORD-LEAK-B',
                    customer_name: 'Store B Guest',
                    items: '[]',
                    total: 77000,
                    payment_method: 'cash',
                    status: 'completed',
                    payment_status: 'paid',
                    tenant_id: 'store-b',
                    created_at: '2026-11-04T08:10:00Z',
                  },
                ],
              }),
            }),
          }),
        } as unknown as D1Database,
      } as Env;

      const camelOverrideRes = await app.request(
        'http://localhost/api/admin/sales/csv?range=24h&tenantId=store-b',
        { headers: { Authorization: `Bearer ${token}` } },
        env
      );
      expect(camelOverrideRes.status).toBe(403);

      const okRes = await app.request(
        'http://localhost/api/admin/sales/csv?range=24h',
        { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-a' } },
        env
      );
      expect(okRes.status).toBe(200);
      const csvText = await okRes.text();
      expect(csvText).toContain('ORD-VALID-A');
      expect(csvText).not.toContain('ORD-CANCELED-A');
      expect(csvText).not.toContain('ORD-REJECTED-A');
      expect(csvText).not.toContain('ORD-LEAK-B');
    });
  });
});
