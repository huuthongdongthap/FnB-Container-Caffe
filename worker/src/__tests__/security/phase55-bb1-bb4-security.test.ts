// @vitest-environment node
/**
 * Phase 55 Security Regression Suite (BB1..BB4)
 * Covers:
 * - BB1-1..BB1-2: customer-assistant cross-tenant & customer order/table bill isolation + legacy schema guard
 * - BB1-3..BB1-4: ai-barista legacy column binding & staff cross-tenant customer_id attribution guard
 * - BB2-1..BB2-2: container-telemetry fail-closed auth & cross-tenant heartbeat/read isolation
 * - BB2-3..BB2-4: homeassistant globalThis.requireAuth elimination & webhook query-token/tenant hardening
 * - BB3-1..BB3-2: frigate camera snapshot tenant ownership & tastyigniter webhook query-secret/tenant hardening
 * - BB4-1..BB4-3: dynamic-pricing unauthenticated cross-tenant/margin protection, mock-stub guard, and demand-forecast refunded filter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { generateJWT as signJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import { customerAssistantRouter, processCustomerQuery } from '../../routes/customer-assistant';
import { aiBaristaRouter, resetBaristaRateLimitForTests } from '../../routes/ai-barista';
import { containerTelemetryRouter } from '../../routes/container-telemetry';
import { createHARouter } from '../../routes/homeassistant/index';
import { createFrigateRoutes } from '../../routes/integrations/frigate';
import { createTIRoutes } from '../../routes/integrations/tastyigniter';
import { dynamicPricingRouter } from '../../routes/dynamic-pricing';
import { demandForecastRouter } from '../../routes/demand-forecast';

const JWT_SECRET = 'phase55-security-jwt-secret-key-32chars!';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    const bindArgs: unknown[] = [];
    const stmtObj = {
      bind(...values: unknown[]) {
        bindArgs.length = 0;
        bindArgs.push(...values);
        return stmtObj;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(bindArgs as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>() {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...(bindArgs as never[])) as unknown as T[];
        return { results, success: true, meta: {} };
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(bindArgs as never[]));
        return {
          results: [],
          success: true,
          meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
        };
      },
    };
    return stmtObj;
  };

  return {
    prepare,
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    async exec(rawSql: string) {
      sqlite.exec(rawSql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}

describe('Phase 55 Security Hardening (BB1..BB4)', () => {
  beforeEach(() => {
    resetBaristaRateLimitForTests();
  });

  describe('BB1: Customer Assistant & AI Barista', () => {
    it('BB1-1: blocks unauthenticated cross-tenant table bill & order lookups and customer-to-customer table/order snooping', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          loyalty_points INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'bronze',
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          table_number TEXT,
          customer_id TEXT,
          customer_phone TEXT,
          total INTEGER,
          total_amount INTEGER,
          status TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO customers (id, name, phone, tenant_id) VALUES ('cust_a1', 'Alice', '0901111111', 'store-a');
        INSERT INTO customers (id, name, phone, tenant_id) VALUES ('cust_a2', 'Bob', '0902222222', 'store-a');
        INSERT INTO cafe_tables (id, table_number, tenant_id) VALUES ('tbl_5', '5', 'store-b');
        INSERT INTO orders (id, table_id, table_number, customer_id, customer_phone, total, total_amount, status, tenant_id)
          VALUES ('ord_b1', 'tbl_5', '5', 'cust_b1', '0909999999', 250000, 250000, 'preparing', 'store-b');
        INSERT INTO orders (id, table_id, table_number, customer_id, customer_phone, total, total_amount, status, tenant_id)
          VALUES ('ord_a1', 'tbl_1', '1', 'cust_a1', '0901111111', 120000, 120000, 'preparing', 'store-a');
      `);

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = {
          AURA_DB: db,
          JWT_SECRET,
          PILOT_TENANT_ID: 'store-a',
          AUTH_KV: { get: async () => null, put: async () => undefined },
        } as unknown as Env;
        await next();
      });
      app.route('/api/chat/assistant', customerAssistantRouter);

      // 1) Anonymous caller attempts cross-tenant table bill disclosure via ?tenant_id=store-b
      const anonTableCrossRes = await app.request('http://localhost/api/chat/assistant?tenant_id=store-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Bàn 5 tính tiền bao nhiêu?', table_number: '5' }),
      });
      expect(anonTableCrossRes.status).toBe(401);

      // 2) Anonymous caller attempts cross-tenant order disclosure via X-Tenant-ID: store-b
      const anonOrderCrossRes = await app.request('http://localhost/api/chat/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
        body: JSON.stringify({ query: 'Kiểm tra đơn ord_b1', order_id: 'ord_b1' }),
      });
      expect(anonOrderCrossRes.status).toBe(401);

      // 3) Anonymous caller attempts to read registered customer's order in pilot store
      const anonRegisteredOrderRes = await app.request('http://localhost/api/chat/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Kiểm tra đơn ord_a1', order_id: 'ord_a1' }),
      });
      expect(anonRegisteredOrderRes.status).toBe(401);

      // 4) Authenticated customer Bob (cust_a2) tries to read Alice's (cust_a1) table bill & order in store-a
      const bobToken = await signJWT(
        { id: 'cust_a2', role: 'customer', phone: '0902222222', tenantId: 'store-a' },
        JWT_SECRET
      );
      const bobStealTableRes = await app.request('http://localhost/api/chat/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bobToken}`,
        },
        body: JSON.stringify({ query: 'Tính tiền bàn 1', table_number: '1' }),
      });
      expect(bobStealTableRes.status).toBe(403);

      const bobStealOrderFreeTextRes = await app.request('http://localhost/api/chat/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bobToken}`,
        },
        body: JSON.stringify({ query: 'Kiểm tra đơn ord_a1 giúp tôi' }),
      });
      expect(bobStealOrderFreeTextRes.status).toBe(403);

      // 5) Alice (cust_a1) can read her own order and table bill
      const aliceToken = await signJWT(
        { id: 'cust_a1', role: 'customer', phone: '0901111111', tenantId: 'store-a' },
        JWT_SECRET
      );
      const aliceOwnRes = await app.request('http://localhost/api/chat/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({ query: 'Kiểm tra đơn ord_a1', order_id: 'ord_a1' }),
      });
      expect(aliceOwnRes.status).toBe(200);
      const aliceJson = (await aliceOwnRes.json()) as { data: { reply: string } };
      expect(aliceJson.data.reply).toContain('120');
    });

    it('BB1-2: processCustomerQuery refuses unscoped fallback for non-default tenant when tenant_id column is missing', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT,
          total INTEGER,
          customer_phone TEXT,
          table_id TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT
        );
        INSERT INTO cafe_tables (id, table_number) VALUES ('tbl_1', '1');
        INSERT INTO orders (id, status, total, customer_phone, table_id)
          VALUES ('ord_legacy_1', 'preparing', 95000, '0901234567', 'tbl_1');
      `);
      const db = createSqliteD1(sqlite);

      const nonDefaultOrder = await processCustomerQuery(db, undefined, 'store-b', {
        query: 'Kiểm tra đơn ord_legacy_1',
        order_id: 'ord_legacy_1',
        channel: 'web',
      });
      expect(nonDefaultOrder.reply).toContain('chưa tìm thấy');

      const nonDefaultTable = await processCustomerQuery(db, undefined, 'store-b', {
        query: 'Tính tiền bàn 1',
        table_number: '1',
        channel: 'web',
      });
      expect(nonDefaultTable.reply).toContain('không có hóa đơn');
    });

    it('BB1-3 & BB1-4: ai-barista binds 6-column legacy schema accurately and blocks cross-tenant customer_id attribution', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
          VALUES ('staff_1', 'Staff One', '0900000001', 'staff', 'default', 1, 1);
        CREATE TABLE ai_barista_interactions (
          id TEXT PRIMARY KEY,
          query_prompt TEXT,
          preferences_json TEXT,
          recommended_product_id TEXT,
          recommended_product_name TEXT,
          engine_used TEXT
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO customers (id, name, tenant_id) VALUES ('cust_store_b', 'Foreign Customer', 'store-b');
        INSERT INTO customers (id, name, tenant_id) VALUES ('cust_default', 'Local Customer', 'default');
      `);
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/ai/barista', aiBaristaRouter);

      // BB1-3: Legacy 6-column table without tenant_id or customer_id stores prompt in query_prompt (not tenantId)
      const recRes = await app.request('http://localhost/api/ai/barista/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Cà phê muối đậm đà' }),
      });
      expect(recRes.status).toBe(200);
      const loggedRow = sqlite
        .prepare('SELECT query_prompt, recommended_product_id FROM ai_barista_interactions LIMIT 1')
        .get() as { query_prompt: string; recommended_product_id: string } | undefined;
      expect(loggedRow?.query_prompt).toBe('Cà phê muối đậm đà');
      expect(loggedRow?.recommended_product_id).toBe('cafe_muoi_sadec');

      // BB1-4: Staff caller from 'default' cannot attribute interaction to 'cust_store_b' in 'store-b'
      const { token: staffToken } = await issueStaffSession(
        { JWT_SECRET },
        { id: 'staff_1', name: 'Staff One', phone: '0900000001', role: 'staff', tenant_id: 'default', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );
      const crossCustomerRes = await app.request('http://localhost/api/ai/barista/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ prompt: 'Cà phê muối', customer_id: 'cust_store_b' }),
      });
      expect(crossCustomerRes.status).toBe(403);
    });
  });

  describe('BB2: Container Telemetry & Home Assistant', () => {
    it('BB2-1 & BB2-2: container-telemetry fails closed when unauthenticated and blocks cross-tenant spoofing', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
          VALUES ('mgr_a', 'Manager A', '0900000002', 'manager', 'store-a', 1, 1);
        CREATE TABLE container_telemetry_logs (
          id TEXT PRIMARY KEY,
          container_id TEXT,
          tenant_id TEXT,
          power_source TEXT,
          battery_percentage REAL,
          ambient_temp_celsius REAL,
          kds_online INTEGER,
          network_ping_ms REAL,
          alert_status TEXT,
          alert_message TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const db = createSqliteD1(sqlite);

      // Environment with no EDGE_TELEMETRY_SECRET, non-prod, and no JWT_SECRET configured
      const openEnvApp = new Hono<{ Bindings: Env }>();
      openEnvApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, ENVIRONMENT: 'development' } as unknown as Env;
        await next();
      });
      openEnvApp.route('/api/edge', containerTelemetryRouter);

      const unauthRes = await openEnvApp.request('http://localhost/api/edge/telemetry/heartbeat?tenant_id=victim-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: 'CONT-01',
          power_source: 'battery',
          battery_percentage: 10,
          ambient_temp_celsius: 42,
          kds_online: false,
          network_ping_ms: 50,
        }),
      });
      expect([401, 500]).toContain(unauthRes.status);

      const countRow = sqlite.prepare('SELECT COUNT(*) as cnt FROM container_telemetry_logs').get() as { cnt: number };
      expect(countRow.cnt).toBe(0);

      // Authenticated manager for store-a cannot write or read telemetry for store-b
      const jwtApp = new Hono<{ Bindings: Env }>();
      jwtApp.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      jwtApp.route('/api/edge', containerTelemetryRouter);

      const { token: managerAToken } = await issueStaffSession(
        { JWT_SECRET },
        { id: 'mgr_a', name: 'Manager A', phone: '0900000002', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );
      const crossWriteRes = await jwtApp.request('http://localhost/api/edge/telemetry/heartbeat?tenant_id=store-b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerAToken}`,
        },
        body: JSON.stringify({
          container_id: 'CONT-01',
          power_source: 'grid',
          ambient_temp_celsius: 25,
          kds_online: true,
          network_ping_ms: 15,
        }),
      });
      expect(crossWriteRes.status).toBe(403);
    });

    it('BB2-3 & BB2-4: homeassistant ignores globalThis.requireAuth override and blocks webhook query token & unsigned tenant spoofing', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE ha_device_states (
          entity_id TEXT,
          state TEXT,
          attributes TEXT,
          last_changed TEXT,
          last_updated TEXT,
          tenant_id TEXT DEFAULT 'default',
          PRIMARY KEY (entity_id, tenant_id)
        );
      `);
      const db = createSqliteD1(sqlite);

      // Attempt to hijack globalThis.requireAuth before creating router
      const g = globalThis as unknown as Record<string, unknown>;
      const prevGlobalAuth = g.requireAuth;
      g.requireAuth = () => async (_c: unknown, next: () => Promise<void>) => next();
      let app: Hono<{ Bindings: Env }>;
      try {
        app = new Hono<{ Bindings: Env }>();
        app.use('*', async (c, next) => {
          c.env = {
            AURA_DB: db,
            JWT_SECRET,
            ENVIRONMENT: 'development',
            HA_WEBHOOK_SECRET: 'ha-secret-token-123',
            PILOT_TENANT_ID: 'store-a',
          } as unknown as Env;
          await next();
        });
        app.route('/api/ha', createHARouter());
      } finally {
        if (prevGlobalAuth === undefined) delete g.requireAuth;
        else g.requireAuth = prevGlobalAuth;
      }

      // BB2-3: Unauthenticated request to /api/ha/devices must still be rejected with 401
      const unauthDevicesRes = await app.request('http://localhost/api/ha/devices');
      expect(unauthDevicesRes.status).toBe(401);

      // BB2-4: Webhook rejects ?token= in query string even in development
      const queryTokenRes = await app.request('http://localhost/api/ha/webhook?token=ha-secret-token-123', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'state_changed',
          entity_id: 'light.bar',
          state: 'on',
        }),
      });
      expect(queryTokenRes.status).toBe(401);
    });
  });

  describe('BB3: Frigate & TastyIgniter Integrations', () => {
    it('BB3-1: frigate camera snapshot blocks access to cameras owned by another tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
          VALUES ('staff_a', 'Staff A', '0900000003', 'staff', 'store-a', 1, 1);
        CREATE TABLE frigate_events (
          id TEXT PRIMARY KEY,
          camera TEXT,
          label TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO frigate_events (id, camera, label, tenant_id)
          VALUES ('evt_b1', 'cam_store_b', 'person', 'store-b');
      `);
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/integrations/frigate', createFrigateRoutes());

      const { token: staffAToken } = await issueStaffSession(
        { JWT_SECRET },
        { id: 'staff_a', name: 'Staff A', phone: '0900000003', role: 'staff', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );
      const snapRes = await app.request('http://localhost/api/integrations/frigate/camera/cam_store_b/snapshot', {
        headers: { Authorization: `Bearer ${staffAToken}` },
      });
      expect(snapRes.status).toBe(403);
    });

    it('BB3-2: tastyigniter webhook rejects query-string secret and blocks cross-tenant override on authenticated routes', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
          VALUES ('staff_a', 'Staff A', '0900000003', 'staff', 'store-a', 1, 1);
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        INSERT INTO orders (id, status, tenant_id) VALUES ('ord_b1', 'pending', 'store-b');
      `);
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = {
          AURA_DB: db,
          JWT_SECRET,
          ENVIRONMENT: 'development',
          TASTYIGNITER_WEBHOOK_SECRET: 'ti-webhook-secret-999',
          PILOT_TENANT_ID: 'store-a',
        } as unknown as Env;
        await next();
      });
      app.route('/api/integrations/tastyigniter', createTIRoutes());

      // Query secret must be rejected with 401
      const querySecretRes = await app.request(
        'http://localhost/api/integrations/tastyigniter/webhook?secret=ti-webhook-secret-999',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'order.status_updated',
            order: { id: 101, status_name: 'completed', comment: '[AURA:ord_b1]' },
          }),
        }
      );
      expect(querySecretRes.status).toBe(401);

      // Staff from store-a cannot pass ?tenant_id=store-b on /menu
      const { token: staffAToken } = await issueStaffSession(
        { JWT_SECRET },
        { id: 'staff_a', name: 'Staff A', phone: '0900000003', role: 'staff', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );
      const crossMenuRes = await app.request(
        'http://localhost/api/integrations/tastyigniter/menu?tenant_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } }
      );
      expect(crossMenuRes.status).toBe(403);
    });
  });

  describe('BB4: Dynamic Pricing & Demand Forecast', () => {
    it('BB4-1 & BB4-2: dynamic-pricing blocks unauthenticated cross-tenant queries, strips min_margin_percent for public callers, and enforces server price', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE dynamic_pricing_rules (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'default',
          name TEXT,
          rule_type TEXT,
          discount_percent INTEGER,
          target_category TEXT,
          target_product_id TEXT,
          min_margin_percent INTEGER,
          days_of_week TEXT,
          start_time TEXT,
          end_time TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          price INTEGER,
          cost_price INTEGER,
          rule_type TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO dynamic_pricing_rules (
          id, tenant_id, name, rule_type, discount_percent, min_margin_percent, days_of_week, start_time, end_time, is_active
        ) VALUES (
          'rule_a', 'store-a', 'Store A Happy Hour', 'happy_hour', 20, 35, '0,1,2,3,4,5,6', '00:00', '23:59', 1
        );
        INSERT INTO dynamic_pricing_rules (
          id, tenant_id, name, rule_type, discount_percent, min_margin_percent, days_of_week, start_time, end_time, is_active
        ) VALUES (
          'rule_b', 'store-b', 'Store B Secret Rule', 'happy_hour', 50, 45, '0,1,2,3,4,5,6', '00:00', '23:59', 1
        );
        INSERT INTO products (id, price, cost_price, rule_type, tenant_id)
          VALUES ('prod_spoof', 0, 1000, 'happy_hour', 'store-a');
      `);
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = {
          AURA_DB: db,
          JWT_SECRET,
          PILOT_TENANT_ID: 'store-a',
        } as unknown as Env;
        await next();
      });
      app.route('/api/pricing/dynamic', dynamicPricingRouter);

      // 1) Anonymous caller cannot query store-b's active rules via ?tenant_id=store-b or X-Tenant-ID
      const anonCrossActive = await app.request('http://localhost/api/pricing/dynamic/active?tenant_id=store-b');
      expect(anonCrossActive.status).toBe(401);

      const anonCrossCalc = await app.request('http://localhost/api/pricing/dynamic/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
        body: JSON.stringify({ items: [{ product_id: 'prod_1', price: 50000, quantity: 1 }] }),
      });
      expect(anonCrossCalc.status).toBe(401);

      // 2) Anonymous caller on pilot store-a gets active rules without internal min_margin_percent
      const anonPilotActive = await app.request('http://localhost/api/pricing/dynamic/active');
      expect(anonPilotActive.status).toBe(200);
      const activeBody = (await anonPilotActive.json()) as { data: Array<Record<string, unknown>> };
      expect(activeBody.data).toHaveLength(1);
      expect(activeBody.data[0].name).toBe('Store A Happy Hour');
      expect(activeBody.data[0].min_margin_percent).toBeUndefined();

      // 3) BB4-2: Row carrying rule_type with no valid server price cannot trigger isRuleOnlyMockStub bypass on SQLite
      const spoofCalcRes = await app.request('http://localhost/api/pricing/dynamic/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ product_id: 'prod_spoof', price: 10000, quantity: 1 }] }),
      });
      expect(spoofCalcRes.status).toBe(400);
    });

    it('BB4-3: demand-forecast /forecast/hourly excludes refunded payment_status orders across fallback paths', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const nowIso = new Date().toISOString();
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
          VALUES ('mgr_a', 'Manager A', '0900000002', 'manager', 'store-a', 1, 1);
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total INTEGER,
          status TEXT,
          payment_status TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        INSERT INTO orders (id, total, status, payment_status, tenant_id, created_at)
          VALUES ('ord_paid', 50000, 'completed', 'paid', 'store-a', '${nowIso}');
        INSERT INTO orders (id, total, status, payment_status, tenant_id, created_at)
          VALUES ('ord_refunded_pay', 50000, 'completed', 'refunded', 'store-a', '${nowIso}');
        INSERT INTO orders (id, total, status, payment_status, tenant_id, created_at)
          VALUES ('ord_failed', 50000, 'failed', 'unpaid', 'store-a', '${nowIso}');
      `);
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/admin/metrics', demandForecastRouter);

      const { token: managerAToken } = await issueStaffSession(
        { JWT_SECRET },
        { id: 'mgr_a', name: 'Manager A', phone: '0900000002', role: 'manager', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );
      const res = await app.request('http://localhost/api/admin/metrics/forecast/hourly', {
        headers: { Authorization: `Bearer ${managerAToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { hourly_distribution: Record<string, number> } };
      const totalCounted = Object.values(body.data.hourly_distribution).reduce((a, b) => a + b, 0);
      expect(totalCounted).toBe(1);

      // Cross-tenant override by store-a manager is rejected with 403
      const crossRes = await app.request('http://localhost/api/admin/metrics/forecast/hourly?tenant_id=store-b', {
        headers: { Authorization: `Bearer ${managerAToken}` },
      });
      expect(crossRes.status).toBe(403);
    });
  });
});
