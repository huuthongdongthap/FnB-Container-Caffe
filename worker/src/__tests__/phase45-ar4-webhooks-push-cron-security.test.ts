/**
 * @vitest-environment node
 *
 * Webhooks, Push Notifications, Cron Alerts &
 * Marketing/Ticketing/Booking Bridges Security Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { issueStaffSession, type StaffAccount } from '../lib/staff-session';
import { pushRouter } from '../routes/push';
import { sendPushToCustomer } from '../tree/push/notifier';
import { createReservationFromBooking } from '../tree/cal-booking/process-booking';
import {
  handleCalBookingWebhook,
  registerWebhookHandler as registerCalWebhookHandler,
} from '../routes/cal-booking-webhook-handlers/webhook-handler';
import { registerBookingsHandler } from '../routes/cal-booking-webhook-handlers/bookings-handler';
import { pretixRouter } from '../routes/pretix-handlers/routes';
import { checkOverdueOrders } from '../routes/cron-handlers/order-checks';
import { sendCashbackExpiryWarnings } from '../routes/cron-handlers/cashback-warnings';
import * as mauticClientFactory from '../tree/mautic/client-factory';
import { enrollCampaigns } from '../tree/mautic/campaign-enrollment';
import type { Env } from '../types/env';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}));

const TEST_JWT_SECRET = 'phase45_ar4_test_jwt_secret_32_bytes_long!';

function parseStaffAccountFromId(staffId: string): StaffAccount | null {
  const m = /^staff_([a-z]+)_(.+)$/.exec(staffId);
  if (!m) return null;
  return {
    id: staffId,
    name: `Staff ${m[1]}`,
    phone: '0900000000',
    role: m[1],
    tenant_id: m[2],
    is_active: 1,
    auth_version: 1,
  };
}

async function makeStaffAuthHeader(role: string, tenantId: string): Promise<string> {
  const id = `staff_${role}_${tenantId}`;
  const session = await issueStaffSession(
    { JWT_SECRET: TEST_JWT_SECRET },
    {
      id,
      name: `Staff ${role}`,
      phone: '0900000000',
      role,
      tenant_id: tenantId,
      is_active: 1,
      auth_version: 1,
    },
    { email: `${role}@aura.vn`, sessionType: 'staff-web' }
  );
  return `Bearer ${session.token}`;
}

describe('Webhooks, Push, Cron & Marketing/Ticketing/Booking Bridges Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Push manual staff endpoint tenant namespacing, list RBAC/SQL scoping & customer broadcast filter', () => {
    it('namespaces manual staff endpoints by tenant, deletes tenant-scoped manual entries, enforces manager/supervisor RBAC on list-subscriptions, and filters manual placeholders from sendPushToCustomer', async () => {
      const subs: Array<Record<string, unknown>> = [];
      const executedSqls: Array<{ sql: string; args: unknown[] }> = [];

      const db = {
        prepare: vi.fn((sql: string) => {
          const makeBound = (args: unknown[]) => ({
            all: async () => {
              executedSqls.push({ sql, args });
              if (/FROM push_subscriptions/i.test(sql)) {
                if (/WHERE role != 'customer' AND COALESCE\(NULLIF\(TRIM\(tenant_id\), ''\), 'default'\) = \?/i.test(sql)) {
                  const tid = String(args[0]);
                  return {
                    results: subs.filter(
                      (s) => s.role !== 'customer' && String(s.tenant_id || 'default') === tid
                    ),
                  };
                }
                return { results: [...subs] };
              }
              return { results: [] };
            },
            first: async () => {
              if (/FROM users WHERE id = \?/i.test(sql)) {
                return parseStaffAccountFromId(String(args[0]));
              }
              return null;
            },
            run: async () => {
              executedSqls.push({ sql, args });
              if (/INSERT INTO push_subscriptions/i.test(sql)) {
                const ep = String(args[2]);
                const existing = subs.find((s) => s.endpoint === ep);
                if (existing) {
                  existing.customer_id = args[1];
                  existing.auth_key = args[3];
                  existing.p256dh_key = args[4];
                  existing.user_agent = args[5];
                  existing.role = args[6];
                } else {
                  subs.push({
                    id: args[0],
                    customer_id: args[1],
                    endpoint: ep,
                    auth_key: args[3],
                    p256dh_key: args[4],
                    user_agent: args[5],
                    role: args[6],
                    created_at: args[7],
                    tenant_id: 'default',
                  });
                }
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE push_subscriptions SET tenant_id = \? WHERE endpoint = \?/i.test(sql)) {
                const target = subs.find((s) => s.endpoint === args[1]);
                if (target) target.tenant_id = args[0];
                return { success: true, meta: { changes: target ? 1 : 0 } };
              }
              if (/DELETE FROM push_subscriptions/i.test(sql)) {
                const tid = String(args[args.length - 1]);
                const before = subs.length;
                for (let i = subs.length - 1; i >= 0; i--) {
                  const row = subs[i];
                  const rowTenant = String(row.tenant_id || 'default');
                  const nameMatch = row.user_agent === args[0] || row.customer_id === args[1];
                  const epMatch = row.endpoint === args[2] || row.endpoint === args[3];
                  if (rowTenant === tid && (nameMatch || epMatch)) {
                    subs.splice(i, 1);
                  }
                }
                return { success: true, meta: { changes: before - subs.length } };
              }
              return { success: true, meta: { changes: 1 } };
            },
          });
          return {
            bind: (...args: unknown[]) => makeBound(args),
            all: () => makeBound([]).all(),
            first: () => makeBound([]).first(),
            run: () => makeBound([]).run(),
          };
        }),
      };

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/push', pushRouter);

      const env = {
        AURA_DB: db as unknown as Env['AURA_DB'],
        JWT_SECRET: TEST_JWT_SECRET,
        VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        VAPID_PRIVATE_KEY: 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls',
      } as unknown as Env;

      // 1. Manual staff entry in 'default' vs 'tenant_sadec_02' must not collide on endpoint
      const defAuth = await makeStaffAuthHeader('manager', 'default');
      const franAuth = await makeStaffAuthHeader('manager', 'tenant_sadec_02');

      const subDefRes = await app.fetch(
        new Request('https://api.test/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: defAuth, 'X-Tenant-ID': 'default' },
          body: JSON.stringify({ name: 'Bep', role: 'staff' }),
        }),
        env
      );
      expect(subDefRes.status).toBe(201);

      const subFranRes = await app.fetch(
        new Request('https://api.test/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: franAuth, 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({ name: 'Bep', role: 'staff' }),
        }),
        env
      );
      expect(subFranRes.status).toBe(201);
      expect(subs).toHaveLength(2);
      expect(subs.find((s) => s.tenant_id === 'default')?.endpoint).toBe(
        'https://manual.auraspace.local/staff/bep'
      );
      expect(subs.find((s) => s.tenant_id === 'tenant_sadec_02')?.endpoint).toBe(
        'https://manual.auraspace.local/staff/tenant_sadec_02/bep'
      );

      // 2. Waiter is denied GET /list-subscriptions (403); supervisor is allowed (200) and SQL has tenant filter + LIMIT 500
      const waiterAuth = await makeStaffAuthHeader('waiter', 'tenant_sadec_02');
      const waiterListRes = await app.fetch(
        new Request('https://api.test/api/push/list-subscriptions', {
          headers: { Authorization: waiterAuth, 'X-Tenant-ID': 'tenant_sadec_02' },
        }),
        env
      );
      expect(waiterListRes.status).toBe(403);

      const supAuth = await makeStaffAuthHeader('supervisor', 'tenant_sadec_02');
      const supListRes = await app.fetch(
        new Request('https://api.test/api/push/list-subscriptions', {
          headers: { Authorization: supAuth, 'X-Tenant-ID': 'tenant_sadec_02' },
        }),
        env
      );
      expect(supListRes.status).toBe(200);
      expect(
        executedSqls.some(
          (q) =>
            /FROM push_subscriptions/i.test(q.sql) &&
            /LIMIT 500/i.test(q.sql) &&
            q.args.includes('tenant_sadec_02')
        )
      ).toBe(true);

      // 3. Customer broadcast via sendPushToCustomer skips manual.auraspace.local placeholders
      subs.push({
        id: 'cust_sub_1',
        customer_id: 'cust_1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/real-cust',
        auth_key: 'a_key',
        p256dh_key: 'p_key',
        role: 'customer',
        tenant_id: 'tenant_sadec_02',
      });
      const pushResult = await sendPushToCustomer(
        env,
        null,
        { title: 'Promo', body: '10% off' },
        'tenant_sadec_02'
      );
      expect(pushResult.sent).toBe(1);
      expect(pushResult.failed).toBe(0);

      // 4. DELETE /subscribe by name in 'tenant_sadec_02' deletes only tenant_sadec_02 manual subscription
      const delFranRes = await app.fetch(
        new Request('https://api.test/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: franAuth, 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({ name: 'Bep' }),
        }),
        env
      );
      expect(delFranRes.status).toBe(200);
      expect(subs.some((s) => s.endpoint === 'https://manual.auraspace.local/staff/tenant_sadec_02/bep')).toBe(false);
      expect(subs.some((s) => s.endpoint === 'https://manual.auraspace.local/staff/bep')).toBe(true);
    });
  });

  describe('Cal.com booking conflict check, guest_count sanitization, tenant-scoped UID checks & BOOKING_RESCHEDULED', () => {
    it('sanitizes negative guest_count, skips tables with confirmed time-slot conflicts, scopes UID checks by tenant, and handles BOOKING_RESCHEDULED in handleCalBookingWebhook', async () => {
      const cafeTables = [
        { id: 'T1', zone: 'Indoor', capacity: 2, status: 'available', tenant_id: 'tenant_sadec_02' },
        { id: 'T2', zone: 'Indoor', capacity: 4, status: 'available', tenant_id: 'tenant_sadec_02' },
      ];
      const reservations: Array<Record<string, unknown>> = [
        // Existing confirmed reservation on T1 at 2026-11-04 18:00 for tenant_sadec_02
        {
          id: 'rsv_busy_t1',
          table_id: 'T1',
          date: '2026-11-04',
          time: '18:00',
          status: 'confirmed',
          cal_booking_uid: 'uid_busy_t1',
          tenant_id: 'tenant_sadec_02',
        },
        // Shadowing UID in 'default' store first in table order
        {
          id: 'rsv_def_shadow',
          table_id: 'T_DEF',
          date: '2026-11-04',
          time: '18:00',
          status: 'confirmed',
          cal_booking_uid: 'uid_shared_1',
          tenant_id: 'default',
        },
        // Matching UID in 'tenant_sadec_02' second in table order
        {
          id: 'rsv_fran_shared',
          table_id: 'T2',
          date: '2026-11-04',
          time: '19:00',
          status: 'confirmed',
          cal_booking_uid: 'uid_shared_1',
          tenant_id: 'tenant_sadec_02',
        },
      ];

      const db = {
        prepare: vi.fn((sql: string) => {
          const makeBound = (args: unknown[]) => ({
            first: async () => {
              if (/FROM reservations WHERE table_id = \? AND date = \? AND time = \?/i.test(sql)) {
                const [tableId, date, time] = args;
                return (
                  reservations.find(
                    (r) =>
                      r.table_id === tableId &&
                      r.date === date &&
                      r.time === time &&
                      r.status === 'confirmed'
                  ) || null
                );
              }
              if (/FROM reservations WHERE cal_booking_uid = \? AND/i.test(sql)) {
                const [uid, , tid] = args;
                return (
                  reservations.find(
                    (r) => r.cal_booking_uid === uid && String(r.tenant_id || 'default') === tid
                  ) || null
                );
              }
              if (/FROM reservations WHERE cal_booking_uid = \?/i.test(sql)) {
                const [uid] = args;
                return reservations.find((r) => r.cal_booking_uid === uid) || null;
              }
              if (/FROM users WHERE id = \?/i.test(sql)) {
                return parseStaffAccountFromId(String(args[0]));
              }
              return null;
            },
            all: async () => {
              if (/FROM reservations WHERE cal_booking_uid = \?/i.test(sql)) {
                const [uid] = args;
                return { results: reservations.filter((r) => r.cal_booking_uid === uid) };
              }
              if (/FROM cafe_tables/i.test(sql)) {
                const minCap = Number(args[0] ?? 1);
                return { results: cafeTables.filter((t) => t.capacity >= minCap) };
              }
              if (/FROM reservations WHERE \(\? = '\*'/i.test(sql)) {
                const tid = String(args[1]);
                return {
                  results: reservations.filter((r) => String(r.tenant_id || 'default') === tid),
                };
              }
              return { results: [] };
            },
            run: async () => {
              if (/INSERT INTO reservations/i.test(sql)) {
                reservations.push({
                  id: args[0],
                  table_id: args[1],
                  guest_count: args[4],
                  date: args[5],
                  time: args[6],
                  zone: args[7],
                  cal_booking_uid: args[9],
                  status: 'confirmed',
                  tenant_id: args[13] || 'default',
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (/UPDATE reservations SET date = \?, time = \?/i.test(sql)) {
                const [newDate, newTime, , newUid, , , tid, targetUid] = args;
                const row = reservations.find(
                  (r) =>
                    r.cal_booking_uid === targetUid && String(r.tenant_id || 'default') === tid
                );
                if (row) {
                  row.date = newDate;
                  row.time = newTime;
                  row.cal_booking_uid = newUid;
                  row.status = 'confirmed';
                }
                return { success: true, meta: { changes: row ? 1 : 0 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
          });
          return {
            bind: (...args: unknown[]) => makeBound(args),
            first: () => makeBound([]).first(),
            all: () => makeBound([]).all(),
            run: () => makeBound([]).run(),
          };
        }),
      };

      // 1. Negative guest_count is sanitized to 1, and busy T1 at 18:00 is skipped in favor of T2
      const created = await createReservationFromBooking(
        db as unknown as Env['AURA_DB'],
        {
          uid: 'uid_new_fran',
          startTime: '2026-11-04T18:00:00',
          attendees: [{ name: 'Guest', email: 'g@aura.vn' }],
          metadata: { guest_count: -5, zone: 'Indoor' },
        },
        'tenant_sadec_02'
      );
      expect('error' in created).toBe(false);
      if (!('error' in created)) {
        expect(created.guest_count).toBe(1);
        expect(created.table_id).toBe('T2');
      }

      // 2. handleCalBookingWebhook processes BOOKING_RESCHEDULED for 'uid_shared_1' in 'tenant_sadec_02' despite 'default' row shadowing
      const env = {
        AURA_DB: db as unknown as Env['AURA_DB'],
        CAL_WEBHOOK_SECRET: 'cal_secret_ar4',
      } as unknown as Env;

      const rescheduleRes = await handleCalBookingWebhook(
        new Request('https://api.test/api/cal-booking-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cal-webhook-secret': 'cal_secret_ar4',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: JSON.stringify({
            triggerEvent: 'BOOKING_RESCHEDULED',
            payload: {
              uid: 'uid_shared_1_rescheduled',
              rescheduleUid: 'uid_shared_1',
              startTime: '2026-11-05T20:00:00',
              endTime: '2026-11-05T21:00:00',
              metadata: { tenant_id: 'tenant_sadec_02' },
            },
          }),
        }),
        env
      );
      expect(rescheduleRes.status).toBe(200);
      const rescheduleBody = (await rescheduleRes.json()) as { success: boolean; rescheduled: boolean };
      expect(rescheduleBody.success).toBe(true);
      expect(rescheduleBody.rescheduled).toBe(true);
      expect(reservations.find((r) => r.id === 'rsv_fran_shared')?.cal_booking_uid).toBe(
        'uid_shared_1_rescheduled'
      );
      // Default store's shadowed row remains untouched
      expect(reservations.find((r) => r.id === 'rsv_def_shadow')?.cal_booking_uid).toBe('uid_shared_1');

      // 3. registerWebhookHandler and registerBookingsHandler remain mounted and isolated
      const calApp = new Hono<{ Bindings: Env }>();
      registerCalWebhookHandler(calApp);
      registerBookingsHandler(calApp);
      const listRes = await calApp.fetch(
        new Request('https://api.test/bookings', {
          headers: {
            Authorization: await makeStaffAuthHeader('supervisor', 'tenant_sadec_02'),
            'X-Tenant-ID': 'tenant_sadec_02',
          },
        }),
        { ...env, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env
      );
      expect(listRes.status).toBe(200);
    });
  });

  describe('Pretix STAFF_JWT_SECRET guard, /events optionalAuth & webhook notification_id deduplication', () => {
    it('blocks unauthenticated /orders when only STAFF_JWT_SECRET is set and deduplicates repeated webhook notification_id rows', async () => {
      // 1. When STAFF_JWT_SECRET is set (even without JWT_SECRET), /orders requires staff auth (401)
      const ordersRes = await pretixRouter.fetch(
        new Request('https://api.test/orders'),
        {
          STAFF_JWT_SECRET: TEST_JWT_SECRET,
        } as unknown as Env
      );
      expect(ordersRes.status).toBe(401);

      // 2. Webhook deduplicates repeated notification_id per tenant
      const logs: Array<Record<string, unknown>> = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (/SELECT notification_id FROM pretix_webhook_log/i.test(sql)) {
                const [nid, tid] = args;
                return (
                  logs.find(
                    (l) =>
                      l.notification_id === nid &&
                      (!tid || String(l.tenant_id || 'default') === tid)
                  ) || null
                );
              }
              return null;
            },
            run: async () => {
              if (/INSERT INTO pretix_webhook_log/i.test(sql)) {
                logs.push({
                  notification_id: args[0],
                  organizer: args[1],
                  event: args[2],
                  code: args[3],
                  action: args[4],
                  payload: args[5],
                  tenant_id: args[6] || 'default',
                });
              }
              return { success: true, meta: { changes: 1 } };
            },
          }),
        })),
      };

      const { computeHmacSha256 } = await import('@aura/domain-security');
      const payload = JSON.stringify({
        notification_id: 9001,
        organizer: 'aura',
        event: 'coffee-cupping',
        code: 'ORD9001',
        action: 'pretix.event.order.paid',
      });
      const sig = await computeHmacSha256(payload, 'pretix_secret_ar4');
      const webhookEnv = {
        AURA_DB: db as unknown as Env['AURA_DB'],
        PRETIX_WEBHOOK_SECRET: 'pretix_secret_ar4',
      } as unknown as Env;

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
        webhookEnv
      );
      expect(firstRes.status).toBe(200);
      expect(logs).toHaveLength(1);

      const duplicateRes = await pretixRouter.fetch(
        new Request('https://api.test/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-pretix-Signature': sig,
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: payload,
        }),
        webhookEnv
      );
      expect(duplicateRes.status).toBe(200);
      const duplicateJson = (await duplicateRes.json()) as { duplicate?: boolean };
      expect(duplicateJson.duplicate).toBe(true);
      expect(logs).toHaveLength(1);
    });
  });

  describe('Cashback warning wallet_balance cap & awaited notify, overdue order fallback protection & Mautic enrollment dedup', () => {
    it('caps canonicalScoped cashback warning by wallet_balance, blocks non-default unscoped overdue order marking, namespaces SLA alert key, and deduplicates Mautic campaign enrollments', async () => {
      // 1. checkOverdueOrders does not mark unscoped fallback orders when tenantId !== 'default', and namespaces SLA alert key when scoped
      const updatedOrderIds: string[] = [];
      const recordedAlertKeys: string[] = [];

      const fallbackDb = {
        prepare: vi.fn((sql: string) => {
          if (/SELECT id, customer_name, status, created_at, tenant_id/i.test(sql)) {
            throw new Error('no such column: tenant_id');
          }
          return {
            bind: (...args: unknown[]) => ({
              all: async () => ({
                results: [{ id: 'ord_legacy_def', customer_name: 'Legacy', status: 'pending', created_at: '2026-01-01T00:00:00Z' }],
              }),
              first: async () => null,
              run: async () => ({ success: true, meta: { changes: 1 } }),
              args,
            }),
          };
        }),
        batch: vi.fn(async () => {
          updatedOrderIds.push('should_not_happen');
          return [];
        }),
      };

      await checkOverdueOrders({ AURA_DB: fallbackDb }, 'tenant_sadec_02');
      expect(updatedOrderIds).toHaveLength(0);

      // Now verify tenant-namespaced SLA alert key for 'tenant_sadec_02' when scoped SELECT succeeds
      const scopedDb = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            all: async () => {
              if (/FROM orders/i.test(sql)) {
                return {
                  results: [
                    {
                      id: 'ord_fran_1',
                      customer_name: 'Khach SaDec',
                      status: 'pending',
                      created_at: '2026-01-01T00:00:00Z',
                      tenant_id: 'tenant_sadec_02',
                    },
                  ],
                };
              }
              return { results: [] };
            },
            first: async () => null,
            run: async () => {
              if (/INSERT INTO _alerts/i.test(sql)) {
                recordedAlertKeys.push(String(args[0]));
              }
              return { success: true, meta: { changes: 1, last_row_id: 1 } };
            },
          }),
        })),
        batch: vi.fn(async () => []),
      };

      await checkOverdueOrders({ AURA_DB: scopedDb }, 'tenant_sadec_02');
      expect(recordedAlertKeys).toContain('kds_sla_breach:tenant_sadec_02');

      // 2. sendCashbackExpiryWarnings canonicalScoped fallback includes wallet_balance and caps expiring amount
      const warnedCustomerIds: string[] = [];
      const cashbackDb = {
        prepare: vi.fn((sql: string) => {
          if (/c\.zalo/i.test(sql)) {
            throw new Error('no such column: c.zalo');
          }
          return {
            bind: (...args: unknown[]) => ({
              all: async () => ({
                // total_expiring is 50000, but wallet_balance is 0 -> should be capped to 0 and skipped
                results: [
                  {
                    customer_id: 'cust_zero_bal',
                    phone: '0900000001',
                    name: 'Zero Balance',
                    total_expiring: 50000,
                    wallet_balance: 0,
                    tenant_id: 'tenant_sadec_02',
                  },
                ],
              }),
              run: async () => {
                warnedCustomerIds.push(String(args[1]));
                return { success: true, meta: { changes: 1 } };
              },
            }),
          };
        }),
      };

      const warnRes = await sendCashbackExpiryWarnings({ AURA_DB: cashbackDb }, 'tenant_sadec_02');
      expect(warnRes.notified).toBe(0);
      expect(warnedCustomerIds).toHaveLength(0);

      // 3. Mautic enrollCampaigns deduplicates via isAlreadyEnrolled + trackEnrollment
      const enrollments: Array<{ customer_id: string; campaign_type: string; tenant_id: string }> = [];
      const mauticDb = {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            all: async () => {
              if (/tier = 'MASTER'/i.test(sql)) {
                return {
                  results: [{ id: 'cust_vip_1', email: 'vip@aura.vn', phone: '0901112222', tenant_id: 'tenant_sadec_02' }],
                };
              }
              return { results: [] };
            },
            first: async () => {
              if (/FROM campaign_enrollments/i.test(sql)) {
                const [cid, ctype, , tid] = args;
                return (
                  enrollments.find(
                    (e) =>
                      e.customer_id === cid &&
                      e.campaign_type === ctype &&
                      (!tid || e.tenant_id === tid)
                  ) || null
                );
              }
              return null;
            },
            run: async () => {
              if (/INSERT INTO campaign_enrollments/i.test(sql)) {
                enrollments.push({
                  customer_id: String(args[1]),
                  campaign_type: String(args[2]),
                  tenant_id: 'tenant_sadec_02',
                });
              }
              return { success: true, meta: { changes: 1 } };
            },
          }),
        })),
      };

      const addToCampaignMock = vi.fn().mockResolvedValue(undefined);
      const clientSpy = vi
        .spyOn(mauticClientFactory, 'getMauticClient')
        .mockReturnValue({ addToCampaign: addToCampaignMock } as any);

      const mauticEnv = {
        AURA_DB: mauticDb as unknown as Env['AURA_DB'],
        MAUTIC_BASE_URL: 'https://mautic.aura.vn',
        MAUTIC_CLIENT_ID: 'cid_ar4',
        MAUTIC_CLIENT_SECRET: 'csec_ar4',
      };

      const firstEnroll = await enrollCampaigns(mauticEnv, 'tenant_sadec_02');
      expect(firstEnroll.success).toBe(true);
      expect(firstEnroll.enrolled).toBe(1);
      expect(addToCampaignMock).toHaveBeenCalledTimes(1);

      const secondEnroll = await enrollCampaigns(mauticEnv, 'tenant_sadec_02');
      expect(secondEnroll.success).toBe(true);
      expect(secondEnroll.enrolled).toBe(0);
      expect(addToCampaignMock).toHaveBeenCalledTimes(1);

      clientSpy.mockRestore();
    });
  });
});
