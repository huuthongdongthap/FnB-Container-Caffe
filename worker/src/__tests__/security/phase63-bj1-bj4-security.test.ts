// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { issueStaffSession, type StaffAccount } from '../../lib/staff-session';
import { realtimeOrdersRouter } from '../../routes/realtime-orders';
import { handleGetKdsOrders } from '../../routes/orders-hono-handlers/kds-handlers';
import { resolveOpenApiOrdersTenant } from '../../routes/openapi-orders-handlers/helpers';
import { createOrder } from '../../../../packages/domain/order/commands/create-order';
import { openApiTablesRouter } from '../../routes/openapi-tables-handlers/routes';
import { tableSessionsRouter } from '../../routes/table-sessions';
import { floorPlanRouter } from '../../routes/floor-plan';
import { reservationsRouter } from '../../../../packages/domain/reservation/src/routes/reservations';
import { calBookingWebhookRouter } from '../../routes/cal-booking-webhook';
import { requireAdmin } from '../../tree/subscriptions/middleware';
import { createTenantRoutes } from '../../routes/saas-tenants';
import { registerUsageHandlers } from '../../routes/openapi-promotions-handlers/usage-handlers';
import { registerPromotionValidationHandlers } from '../../routes/promotions-handlers/validation-handlers';
import { redeemReferral, reverseReferralCashback } from '../../../../packages/domain/crm/commands/referral';
import { registerMetricsHandlers } from '../../routes/analytics-handlers/metrics-handlers';
import { getOrdersInRange } from '../../tree/analytics/csv-export';
import { AuditLogger } from '../../lib/audit-logger';
import { getMetricSummary } from '../../lib/metrics-collector';
import { customerAssistantRouter } from '../../routes/customer-assistant';
import { zaloWebhookRouter } from '../../routes/zalo-webhook';

const JWT_SECRET = 'phase63-bj1-bj4-test-jwt-secret-key-2026';

async function makeStaffToken(account: { id: string; role: string; tenantId?: string }) {
  const fullAccount: StaffAccount = {
    id: account.id,
    name: account.id,
    phone: null,
    role: account.role,
    tenant_id: account.tenantId ?? 'default',
    is_active: 1,
    auth_version: 1,
  };
  const session = await issueStaffSession(
    { JWT_SECRET },
    fullAccount,
    { sessionType: 'staff-web', email: `${account.id}@aura.vn` }
  );
  return session.token;
}

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const s = sqlite.prepare(sql);
        const row = s.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
        const s = sqlite.prepare(sql);
        const rows = s.all(...(params as never[])) as unknown as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const s = sqlite.prepare(sql);
        const info = s.run(...(params as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    };
    return stmt;
  };

  return {
    prepare,
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const st of statements) {
        out.push(await st.run());
      }
      return out;
    },
    async exec(script: string) {
      sqlite.exec(script);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

describe('Phase 63 Security Regression Suite (BJ1-BJ4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('BJ1: Orders, KDS, Realtime & Kitchen Stations Hardening', () => {
    it('rejects cross-tenant store_id and wildcard tenant overrides on realtime, KDS, and OpenAPI orders', async () => {
      const mockBroadcaster = {
        idFromName: (name: string) => name,
        get: () => ({ fetch: async () => new Response('ok', { status: 200 }) }),
      };
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { JWT_SECRET, ENVIRONMENT: 'test', ORDER_BROADCASTER: mockBroadcaster } as unknown as Env;
        c.set('user' as never, { id: 'staff_a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.route('/api/realtime', realtimeOrdersRouter);

      const crossRealtimeRes = await app.request('/api/realtime/kds-main?store_id=store-b');
      expect(crossRealtimeRes.status).toBe(403);

      const wildcardApp = new Hono<{ Bindings: Env }>();
      wildcardApp.use('*', async (c, next) => {
        c.env = { JWT_SECRET, ENVIRONMENT: 'test', ORDER_BROADCASTER: mockBroadcaster } as unknown as Env;
        c.set('user' as never, { id: 'staff_wild', role: 'manager', tenantId: '*' } as never);
        c.set('tenantId' as never, '*' as never);
        await next();
      });
      wildcardApp.route('/api/realtime', realtimeOrdersRouter);
      const wildRealtimeRes = await wildcardApp.request('/api/realtime/kds-main');
      expect(wildRealtimeRes.status).toBe(403);

      const kdsApp = new Hono<{ Bindings: Env }>();
      kdsApp.use('*', async (c, next) => {
        c.env = { JWT_SECRET } as unknown as Env;
        c.set('user' as never, { id: 'staff_a', role: 'staff', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      kdsApp.get('/orders', handleGetKdsOrders);
      const crossKdsRes = await kdsApp.request('/orders?store_id=store-b');
      expect(crossKdsRes.status).toBe(403);

      const openApiCtx = {
        get: (key: string) => {
          if (key === 'user') return { id: 'staff_a', role: 'staff', tenantId: 'store-a' };
          if (key === 'tenantId') return 'store-a';
          return undefined;
        },
        req: {
          query: (k: string) => (k === 'store_id' ? 'store-b' : undefined),
          header: () => undefined,
        },
        json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
        env: {},
      };
      const resolved = resolveOpenApiOrdersTenant(openApiCtx as never, 'read');
      expect(resolved.ok).toBe(false);
    });

    it('enforces max_uses when usage_limit is 0 (DEFAULT 0) during order creation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE menu_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          price INTEGER,
          is_available INTEGER DEFAULT 1,
          available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          type TEXT,
          value REAL,
          min_order REAL DEFAULT 0,
          min_order_amount REAL DEFAULT 0,
          max_discount_value REAL,
          usage_limit INTEGER DEFAULT 0,
          max_uses INTEGER DEFAULT 1,
          used_count INTEGER DEFAULT 0,
          current_uses INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          active INTEGER DEFAULT 1,
          start_date TEXT,
          end_date TEXT,
          expires_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          status TEXT,
          order_type TEXT,
          table_id TEXT,
          table_number TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_id TEXT,
          subtotal REAL,
          discount_amount REAL,
          discount REAL,
          loyalty_Skip INTEGER,
          total REAL,
          total_amount REAL,
          payment_method TEXT,
          payment_status TEXT,
          promo_code TEXT,
          notes TEXT,
          items TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          menu_item_id TEXT,
          product_id TEXT,
          name TEXT,
          quantity INTEGER,
          unit_price REAL,
          price REAL,
          subtotal REAL,
          notes TEXT,
          modifiers TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.prepare("INSERT INTO menu_items (id, name, price, tenant_id) VALUES ('item_1', 'Cà phê muối', 50000, 'store-a')").run();
      sqlite.prepare(
        "INSERT INTO promotions (id, code, type, value, usage_limit, max_uses, used_count, current_uses, is_active, active, tenant_id) VALUES ('p_max1', 'ONCEONLY', 'fixed', 10000, 0, 1, 1, 1, 1, 1, 'store-a')"
      ).run();

      const db = createSqliteD1(sqlite);
      const orderApp = new Hono<{ Bindings: Env }>();
      orderApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, { id: 'cashier_a', role: 'cashier', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      orderApp.post('/orders', (c) =>
        createOrder(c.req.raw, c.env as unknown as Record<string, unknown>, undefined, {
          id: 'cashier_a',
          role: 'cashier',
          tenantId: 'store-a',
        })
      );

      const orderRes = await orderApp.request('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Khách Lẻ',
          customer_phone: '0901234567',
          items: [{ id: 'item_1', product_id: 'item_1', menu_item_id: 'item_1', name: 'Cà phê muối', price: 50000, quantity: 1 }],
          total: 50000,
          order_type: 'takeaway',
          payment_method: 'cod',
          promo_code: 'ONCEONLY',
        }),
      });

      // Exhausted max_uses=1 with usage_limit=0 must be rejected with 400
      expect(orderRes.status).toBe(400);
      const orderBody = (await orderRes.json()) as { error?: string };
      expect(orderBody.error).toContain('hết lượt');
    });
  });

  describe('BJ2: Tables, Sessions, Floor Plan & Reservations Hardening', () => {
    it('enforces auth and tenant isolation on OpenAPI tables and blocks waiter total_amount override or unpaid session paid transition', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          number INTEGER,
          zone TEXT,
          capacity INTEGER,
          status TEXT DEFAULT 'Available',
          current_order_id TEXT,
          qr_code TEXT,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE table_sessions (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          table_number INTEGER,
          started_at TEXT,
          ended_at TEXT,
          guest_count INTEGER,
          orders_json TEXT,
          total_amount INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active',
          notes TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          table_number TEXT,
          status TEXT,
          payment_status TEXT,
          total REAL,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.prepare("INSERT INTO users (id, name, role, is_active, auth_version, tenant_id) VALUES ('waiter_1', 'Waiter 1', 'waiter', 1, 1, 'store-a')").run();
      sqlite.prepare("INSERT INTO users (id, name, role, is_active, auth_version, tenant_id) VALUES ('cashier_1', 'Cashier 1', 'cashier', 1, 1, 'store-a')").run();
      sqlite.prepare("INSERT INTO cafe_tables (id, number, zone, capacity, status, tenant_id) VALUES ('t1', 1, 'Indoor', 4, 'Occupied', 'store-a')").run();
      sqlite.prepare("INSERT INTO table_sessions (id, table_id, table_number, started_at, guest_count, orders_json, total_amount, status, tenant_id) VALUES ('sess_1', 't1', 1, datetime('now'), 2, '[\"ord_unpaid\"]', 120000, 'active', 'store-a')").run();
      sqlite.prepare("INSERT INTO orders (id, table_id, table_number, status, payment_status, total, tenant_id) VALUES ('ord_unpaid', 't1', '1', 'preparing', 'pending', 120000, 'store-a')").run();

      const db = createSqliteD1(sqlite);

      // 1. OpenAPI tables requires auth and blocks cross-tenant store_id
      const openApiTables = new Hono<{ Bindings: Env }>();
      openApiTables.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        await next();
      });
      openApiTables.route('/', openApiTablesRouter);

      const unauthRes = await openApiTables.request('/api/tables');
      expect(unauthRes.status).toBe(401);

      const staffToken = await makeStaffToken({ id: 'waiter_1', role: 'waiter', tenantId: 'store-a' });
      const crossTenantRes = await openApiTables.request('/api/tables?store_id=store-b', {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(crossTenantRes.status).toBe(403);

      // 2. Table sessions blocks waiter from overriding total_amount (403) and blocks paid transition with unpaid order (409)
      const sessApp = new Hono<{ Bindings: Env }>();
      sessApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        await next();
      });
      sessApp.route('/', tableSessionsRouter);

      const waiterOverrideRes = await sessApp.request('/sess_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ total_amount: 0 }),
      });
      expect(waiterOverrideRes.status).toBe(403);

      const cashierToken = await makeStaffToken({ id: 'cashier_1', role: 'cashier', tenantId: 'store-a' });
      const unpaidPaidRes = await sessApp.request('/sess_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ status: 'paid' }),
      });
      expect(unpaidPaidRes.status).toBe(409);

      // 3. Floor plan release blocks releasing table with unpaid active order (409)
      const floorApp = new Hono<{ Bindings: Env }>();
      floorApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        c.set('user' as never, { id: 'cashier_1', role: 'cashier', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      floorApp.route('/floor-plan', floorPlanRouter);

      const releaseRes = await floorApp.request('/floor-plan/t1/release', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
      });
      expect(releaseRes.status).toBe(409);
    });

    it('blocks reviving cancelled reservations and prevents slot double-booking on PATCH /reservations/:id and Cal.com reschedule webhook', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE reservations (
          id TEXT PRIMARY KEY,
          customer_name TEXT,
          customer_phone TEXT,
          guest_count INTEGER,
          party_size INTEGER,
          table_id TEXT,
          zone_preference TEXT,
          reservation_time TEXT,
          reserved_date TEXT,
          reserved_time TEXT,
          status TEXT,
          notes TEXT,
          cal_booking_uid TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);
      sqlite.prepare("INSERT INTO users (id, name, role, is_active, auth_version, tenant_id) VALUES ('mgr_1', 'Manager 1', 'manager', 1, 1, 'store-a')").run();
      sqlite.prepare(
        "INSERT INTO reservations (id, customer_name, customer_phone, party_size, table_id, reserved_date, reserved_time, reservation_time, status, cal_booking_uid, tenant_id) VALUES ('res_cancelled', 'Cancelled Guest', '0901111111', 2, 't1', '2026-12-01', '18:00', '2026-12-01T18:00:00', 'cancelled', 'uid_cancelled', 'store-a')"
      ).run();
      sqlite.prepare(
        "INSERT INTO reservations (id, customer_name, customer_phone, party_size, table_id, reserved_date, reserved_time, reservation_time, status, cal_booking_uid, tenant_id) VALUES ('res_active_1', 'Active Guest 1', '0902222222', 4, 't1', '2026-12-01', '19:00', '2026-12-01T19:00:00', 'confirmed', 'uid_active_1', 'store-a')"
      ).run();
      sqlite.prepare(
        "INSERT INTO reservations (id, customer_name, customer_phone, party_size, table_id, reserved_date, reserved_time, reservation_time, status, cal_booking_uid, tenant_id) VALUES ('res_active_2', 'Active Guest 2', '0903333333', 2, 't1', '2026-12-01', '20:00', '2026-12-01T20:00:00', 'confirmed', 'uid_active_2', 'store-a')"
      ).run();

      const db = createSqliteD1(sqlite);
      const mgrToken = await makeStaffToken({ id: 'mgr_1', role: 'manager', tenantId: 'store-a' });
      const resApp = new Hono<{ Bindings: Env }>();
      resApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, { id: 'mgr_1', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      resApp.route('/reservations', reservationsRouter as never);

      // Cannot revive cancelled reservation to confirmed
      const reviveRes = await resApp.request('/reservations/res_cancelled', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      expect(reviveRes.status).toBe(409);

      // Cannot reschedule res_active_2 into res_active_1's table + slot
      const conflictRes = await resApp.request('/reservations/res_active_2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
        body: JSON.stringify({ reserved_time: '19:00' }),
      });
      expect(conflictRes.status).toBe(409);

      // Cal.com webhook BOOKING_RESCHEDULED cannot revive cancelled reservation
      const calApp = new Hono<{ Bindings: Env }>();
      calApp.use('*', async (c, next) => {
        c.env = {
          AURA_DB: db,
          ENVIRONMENT: 'test',
          PILOT_TENANT_ID: 'store-a',
          CAL_WEBHOOK_SECRET: 'cal-secret-2026',
        } as unknown as Env;
        await next();
      });
      calApp.route('/webhooks/cal', calBookingWebhookRouter);

      const calReviveRes = await calApp.request('/webhooks/cal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-webhook-secret': 'cal-secret-2026',
        },
        body: JSON.stringify({
          triggerEvent: 'BOOKING_RESCHEDULED',
          createdAt: '2026-11-05T10:00:00Z',
          payload: {
            uid: 'uid_cancelled',
            title: 'Table Reservation',
            startTime: '2026-12-02T18:00:00Z',
            endTime: '2026-12-02T19:00:00Z',
            organizer: { name: 'AURA Cafe', email: 'host@aura.vn' },
            location: 'Main Hall',
            attendees: [{ name: 'Cancelled Guest', email: 'guest@test.vn', timeZone: 'Asia/Ho_Chi_Minh' }],
          },
        }),
      });
      expect(calReviveRes.status).toBe(409);
    });
  });

  describe('BJ3: SaaS Subscriptions, Tenants, Promotions & Referrals Hardening', () => {
    it('prevents default-tenant admin from acting as HQ on subscriptions and blocks non-HQ tenant creation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.prepare("INSERT INTO users (id, name, role, is_active, auth_version, tenant_id) VALUES ('adm_def', 'Admin Def', 'admin', 1, 1, 'default')").run();
      sqlite.prepare("INSERT INTO users (id, name, role, is_active, auth_version, tenant_id) VALUES ('owner_def', 'Owner Def', 'owner', 1, 1, 'default')").run();
      const db = createSqliteD1(sqlite);

      const adminDefaultToken = await makeStaffToken({ id: 'adm_def', role: 'admin', tenantId: 'default' });
      const subApp = new Hono<{ Bindings: Env }>();
      subApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        const errResp = await requireAdmin(c);
        if (errResp) return errResp;
        await next();
      });
      subApp.get('/sub-check', (c) => c.json({ ok: true, tenantId: c.get('tenantId' as never) }));

      const crossSubRes = await subApp.request('/sub-check?tenant_id=store-b', {
        headers: { Authorization: `Bearer ${adminDefaultToken}` },
      });
      expect(crossSubRes.status).toBe(403);

      const saasApp = new Hono<{ Bindings: Env }>();
      const ownerDefaultToken = await makeStaffToken({ id: 'owner_def', role: 'owner', tenantId: 'default' });
      saasApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        await next();
      });
      saasApp.route('/api/saas/tenants', createTenantRoutes());

      const createTenantRes = await saasApp.request('/api/saas/tenants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerDefaultToken}` },
        body: JSON.stringify({
          name: 'Rogue Store',
          tier: 'pro',
        }),
      });
      expect(createTenantRes.status).toBe(403);
    });

    it('caps fixed discount at order_amount and max_discount_value, enforces usage_limit_per_customer, and guards referral max_uses + reversal', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          type TEXT,
          value REAL,
          min_order_amount REAL DEFAULT 0,
          max_discount_value REAL,
          usage_limit INTEGER,
          used_count INTEGER DEFAULT 0,
          usage_limit_per_customer INTEGER,
          is_active INTEGER DEFAULT 1,
          start_date TEXT,
          end_date TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          promo_code TEXT,
          status TEXT,
          payment_status TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE promotion_redemptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          promotion_id TEXT,
          code TEXT,
          customer_id TEXT,
          order_id TEXT,
          discount_amount REAL,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE referral_codes (
          id TEXT PRIMARY KEY,
          code TEXT,
          customer_id TEXT,
          times_used INTEGER DEFAULT 0,
          max_uses INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          total_points_earned INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE referrals (
          id TEXT PRIMARY KEY,
          referrer_id TEXT,
          referred_customer_id TEXT,
          referral_code TEXT,
          points_awarded INTEGER DEFAULT 0,
          cashback_awarded_vnd INTEGER DEFAULT 0,
          first_order_id TEXT,
          first_order_amount REAL,
          status TEXT,
          bonus_type TEXT,
          reward_paid_at TEXT,
          created_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE loyalty_accounts (
          customer_id TEXT PRIMARY KEY,
          current_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE loyalty_point_logs (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          points_change INTEGER,
          reason TEXT,
          balance_after INTEGER,
          description TEXT,
          order_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
      `);
      sqlite.prepare(
        "INSERT INTO promotions (id, code, type, value, min_order_amount, max_discount_value, usage_limit, used_count, usage_limit_per_customer, is_active, tenant_id) VALUES ('p1', 'FIXED50K', 'fixed', 50000, 0, 30000, 10, 0, 1, 1, 'store-a')"
      ).run();
      sqlite.prepare(
        "INSERT INTO orders (id, customer_id, promo_code, status, payment_status, tenant_id) VALUES ('ord_prev', 'cust_repeat', 'FIXED50K', 'completed', 'paid', 'store-a')"
      ).run();
      sqlite.prepare(
        "INSERT INTO promotion_redemptions (promotion_id, code, customer_id, order_id, discount_amount, tenant_id) VALUES ('p1', 'FIXED50K', 'cust_repeat', 'ord_prev', 30000, 'store-a')"
      ).run();

      const db = createSqliteD1(sqlite);
      const promoApp = new Hono<{ Bindings: Env }>();
      promoApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test', PILOT_TENANT_ID: 'store-a' } as unknown as Env;
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerPromotionValidationHandlers(promoApp);

      // Fixed discount capped by max_discount_value (30000) and order_total (25000)
      const valRes = await promoApp.request('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'FIXED50K', order_total: 25000, customer_id: 'cust_fresh' }),
      });
      expect(valRes.status).toBe(200);
      const valBody = (await valRes.json()) as { data: { valid: boolean; discount_amount: number } };
      expect(valBody.data.valid).toBe(true);
      expect(valBody.data.discount_amount).toBe(25000);

      // Repeat customer blocked by usage_limit_per_customer = 1
      const repeatRes = await promoApp.request('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'FIXED50K', order_total: 100000, customer_id: 'cust_repeat' }),
      });
      expect(repeatRes.status).toBe(200);
      const repeatBody = (await repeatRes.json()) as { data: { valid: boolean } };
      expect(repeatBody.data.valid).toBe(false);

      // OpenAPI /promotions/use rejects cross-tenant store_id
      const openApiPromos = new OpenAPIHono<{ Bindings: Env }>();
      const staffToken = await makeStaffToken({ id: 'staff_a', role: 'staff', tenantId: 'store-a' });
      openApiPromos.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, { id: 'staff_a', role: 'staff', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerUsageHandlers(openApiPromos);
      const crossUseRes = await openApiPromos.request('/api/promotions/use?store_id=store-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({
          promotionId: '11111111-1111-4111-8111-111111111111',
          orderId: '22222222-2222-4222-8222-222222222222',
          discountAmount: 10000,
        }),
      });
      expect(crossUseRes.status).toBe(403);

      // Referral max_uses atomic check + reversal decrements times_used
      sqlite.prepare("INSERT INTO customers (id, loyalty_points, lifetime_points, tenant_id) VALUES ('ref_owner', 100, 100, 'store-a')").run();
      sqlite.prepare("INSERT INTO customers (id, loyalty_points, lifetime_points, tenant_id) VALUES ('ref_guest_1', 0, 0, 'store-a')").run();
      sqlite.prepare("INSERT INTO customers (id, loyalty_points, lifetime_points, tenant_id) VALUES ('ref_guest_2', 0, 0, 'store-a')").run();
      sqlite.prepare(
        "INSERT INTO referral_codes (id, code, customer_id, times_used, max_uses, is_active, total_points_earned, tenant_id) VALUES ('rc_1', 'REF1', 'ref_owner', 0, 1, 1, 50, 'store-a')"
      ).run();

      const firstRedeem = await redeemReferral(db, 'REF1', 'ref_guest_1', 'store-a');
      expect(firstRedeem.success).toBe(true);

      const secondRedeem = await redeemReferral(db, 'REF1', 'ref_guest_2', 'store-a');
      expect(secondRedeem.success).toBe(false);

      sqlite
        .prepare("UPDATE referrals SET status = 'completed', bonus_type = 'points', points_awarded = 50, cashback_awarded_vnd = 0 WHERE id = ?")
        .run(firstRedeem.referral_id!);

      const reversal = await reverseReferralCashback(db, firstRedeem.referral_id!, 'store-a');
      expect(reversal.success).toBe(true);

      const codeRow = sqlite.prepare("SELECT times_used FROM referral_codes WHERE code = 'REF1'").get() as { times_used: number };
      expect(codeRow.times_used).toBe(0);
    });
  });

  describe('BJ4: Analytics, Reports, Audit Logs, Metrics, AI Assistant & Zalo Webhook Hardening', () => {
    it('excludes cancelled and refunded orders from payout total_orders and CSV export getOrdersInRange', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          created_at TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          status TEXT,
          payment_method TEXT,
          payment_status TEXT,
          is_cod INTEGER DEFAULT 0,
          subtotal REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          items TEXT DEFAULT '[]',
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.prepare("INSERT INTO users (id, name, role, is_active, auth_version, tenant_id) VALUES ('owner_a', 'Owner A', 'owner', 1, 1, 'store-a')").run();
      sqlite.prepare(
        "INSERT INTO orders (id, created_at, status, payment_method, payment_status, is_cod, total, tenant_id) VALUES ('o_paid', '2026-11-05T10:00:00Z', 'completed', 'payos', 'paid', 0, 100000, 'store-a')"
      ).run();
      sqlite.prepare(
        "INSERT INTO orders (id, created_at, status, payment_method, payment_status, is_cod, total, tenant_id) VALUES ('o_cancel', '2026-11-05T11:00:00Z', 'cancelled', 'payos', 'failed', 0, 200000, 'store-a')"
      ).run();
      sqlite.prepare(
        "INSERT INTO orders (id, created_at, status, payment_method, payment_status, is_cod, total, tenant_id) VALUES ('o_refund', '2026-11-05T12:00:00Z', 'completed', 'payos', 'refunded', 0, 50000, 'store-a')"
      ).run();

      const db = createSqliteD1(sqlite);
      const analyticsApp = new Hono<{ Bindings: Env }>();
      const ownerToken = await makeStaffToken({ id: 'owner_a', role: 'owner', tenantId: 'store-a' });
      analyticsApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, { id: 'owner_a', role: 'owner', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerMetricsHandlers(analyticsApp);

      const payoutRes = await analyticsApp.request('/payout', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(payoutRes.status).toBe(200);
      const payoutBody = (await payoutRes.json()) as { data: { total_orders: number; payos: number; refunded: number } };
      expect(payoutBody.data.total_orders).toBe(1);

      const csvOrders = await getOrdersInRange(db, '2026-11-01', '2026-11-06', 'store-a');
      expect(csvOrders.map((o) => o.id)).toEqual(['o_paid']);
    });

    it('prevents cross-tenant fallback leaks in AuditLogger.query and getMetricSummary', async () => {
      // Legacy schema without tenant_id column on audit_logs and with non-JSON tags on _metrics
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id TEXT,
          actor_name TEXT,
          action TEXT,
          resource_type TEXT,
          created_at TEXT
        );
      `);
      sqlite.prepare(
        "INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, created_at) VALUES ('u_def', 'Default Admin', 'admin.post', 'orders', datetime('now'))"
      ).run();

      const db = createSqliteD1(sqlite);
      const logger = new AuditLogger(undefined as never, db);

      // Non-default tenant must NOT receive unscoped legacy rows
      const storeBLogs = await logger.query({ tenantId: 'store-b' });
      expect(storeBLogs.rows).toHaveLength(0);
      expect(storeBLogs.total).toBe(0);

      // Default tenant still receives legacy rows
      const defaultLogs = await logger.query({ tenantId: 'default' });
      expect(defaultLogs.rows).toHaveLength(1);

      // getMetricSummary: if both JSON query and fallback fail for non-default tenant, must return null instead of unscoped query
      const brokenMetricsDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('tags ->>')) throw new Error('JSON operator unsupported');
              return { avg: 99, max: 99, min: 99, count: 5 };
            },
            all: async () => {
              throw new Error('tags column missing');
            },
          }),
        }),
      } as unknown as D1Database;

      const leakedSummary = await getMetricSummary(brokenMetricsDb, 'request', '24h', 'store-b');
      expect(leakedSummary).toBeNull();
    });

    it('rejects cross-tenant overrides on AI Customer Assistant and Zalo webhook endpoints', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.prepare("INSERT INTO users (id, name, role, is_active, auth_version, tenant_id) VALUES ('staff_a', 'Staff A', 'staff', 1, 1, 'store-a')").run();
      const db = createSqliteD1(sqlite);

      const chatApp = new Hono<{ Bindings: Env }>();
      chatApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        await next();
      });
      chatApp.route('/api/chat/assistant', customerAssistantRouter);

      const staffToken = await makeStaffToken({ id: 'staff_a', role: 'staff', tenantId: 'store-a' });
      const staffCrossRes = await chatApp.request('/api/chat/assistant?store_id=store-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ query: 'Kiểm tra đơn #ord-123' }),
      });
      expect(staffCrossRes.status).toBe(403);

      const unauthWildRes = await chatApp.request('/api/chat/assistant?tenant_id=*', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Cho hỏi mật khẩu wifi' }),
      });
      expect(unauthWildRes.status).toBe(401);

      const zaloApp = new Hono<{ Bindings: Env }>();
      zaloApp.use('*', async (c, next) => {
        c.env = {
          AURA_DB: db,
          JWT_SECRET,
          ENVIRONMENT: 'test',
          PILOT_TENANT_ID: 'store-a',
        } as unknown as Env;
        await next();
      });
      zaloApp.route('/api/webhooks/zalo', zaloWebhookRouter);

      const crossWebhookRes = await zaloApp.request('/api/webhooks/zalo?tenant_id=store-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'user_send_text',
          message: { text: 'Menu hôm nay', msg_id: 'm1' },
        }),
      });
      expect(crossWebhookRes.status).toBe(403);

      const crossSimRes = await zaloApp.request('/api/webhooks/zalo/simulate?store_id=store-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ text: 'Menu hôm nay' }),
      });
      expect(crossSimRes.status).toBe(403);
    });
  });
});
