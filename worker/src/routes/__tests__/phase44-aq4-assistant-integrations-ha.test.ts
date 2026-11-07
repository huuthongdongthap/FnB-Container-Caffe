// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { DatabaseSync } from 'node:sqlite';
import { customerAssistantRouter, processCustomerQuery } from '../customer-assistant';
import { createTIRoutes } from '../integrations/tastyigniter';
import { processTIWebhook } from '../../tree/integrations/tastyigniter/webhook';
import { syncFrigateEvents, getFrigateEvents } from '../../tree/integrations/frigate/sync';
import { createHARouter } from '../homeassistant/index';
import { getDeviceState, toggleDevice, getZoneDevices } from '../../tree/homeassistant/devices';
import { getAutomationLog } from '../../tree/homeassistant/automations';
import { handleHAWebhook } from '../../tree/homeassistant/presence';
import { generateJWT } from '../../lib/jwt';

const TEST_JWT_SECRET = 'assistant-integrations-ha-test-jwt-secret-min-32-chars!!';

function createSqliteD1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      const makeBound = (args: unknown[]) => ({
        async first<T = Record<string, unknown>>(): Promise<T | null> {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...(args as any[])) as T | undefined;
          return row ? ({ ...(row as object) } as T) : null;
        },
        async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
          const stmt = sqlite.prepare(sql);
          const rows = stmt.all(...(args as any[])) as T[];
          return { results: rows.map((r) => ({ ...(r as object) } as T)), success: true };
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...(args as any[]));
          return { success: true, meta: { changes: Number(info.changes ?? 0) } };
        },
      });
      return {
        ...makeBound([]),
        bind(...args: unknown[]) {
          return makeBound(args);
        },
      };
    },
  };
}

describe('AI Customer Assistant, TastyIgniter, Frigate & HomeAssistant Hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AI Customer Assistant PII protection & table_bill fallback isolation', () => {
    it('blocks authenticated non-staff customer from querying another customer phone while allowing own phone and staff queries', async () => {
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
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_phone TEXT,
          total_amount REAL,
          total REAL,
          status TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE customer_support_interactions (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          channel TEXT,
          customer_phone TEXT,
          user_query TEXT,
          detected_intent TEXT,
          bot_response TEXT,
          engine_used TEXT
        );
      `);
      sqlite
        .prepare("INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run('cust-alice', 'Alice Nguyen', '0901111111', 120, 'silver', 'default');
      sqlite
        .prepare("INSERT INTO customers (id, name, phone, loyalty_points, loyalty_tier, tenant_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run('cust-bob', 'Bob Tran', '0902222222', 850, 'gold', 'default');
      sqlite
        .prepare("INSERT INTO orders (id, customer_id, customer_phone, total_amount, total, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('ord-bob-1001', 'cust-bob', '0902222222', 95000, 95000, 'preparing', 'default');
      sqlite
        .prepare("INSERT INTO orders (id, customer_id, customer_phone, total_amount, total, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('ord-alice-1002', 'cust-alice', '0901111111', 55000, 55000, 'ready', 'default');

      const d1 = createSqliteD1(sqlite);
      let currentUser: Record<string, unknown> | undefined;

      const app = new Hono<{ Bindings: Record<string, unknown> }>();
      app.use('*', async (c, next) => {
        if (currentUser) {
          c.set('user' as never, currentUser as never);
        }
        await next();
      });
      app.route('/api/chat/assistant', customerAssistantRouter);

      // 1. Authenticated customer Alice trying to enumerate Bob's phone gets 403
      currentUser = { id: 'cust-alice', sub: 'cust-alice', role: 'customer', tenantId: 'default' };
      const crossPhoneRes = await app.fetch(
        new Request('https://test.local/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'Kiểm tra điểm tích lũy',
            phone: '0902222222',
          }),
        }),
        { AURA_DB: d1 }
      );
      expect(crossPhoneRes.status).toBe(403);
      const crossPhoneBody = (await crossPhoneRes.json()) as { success: boolean; error: string };
      expect(crossPhoneBody.success).toBe(false);

      // 2. Authenticated customer Alice querying her own phone succeeds (200)
      const ownPhoneRes = await app.fetch(
        new Request('https://test.local/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'Kiểm tra đơn hàng của tôi',
            phone: '0901111111',
          }),
        }),
        { AURA_DB: d1 }
      );
      expect(ownPhoneRes.status).toBe(200);
      const ownPhoneBody = (await ownPhoneRes.json()) as { success: boolean; data: { intent: string; reply: string } };
      expect(ownPhoneBody.data.intent).toBe('order_status');
      expect(ownPhoneBody.data.reply).toContain('55');

      // 3. Authenticated staff member can query Bob's phone (200)
      currentUser = { id: 'staff-1', sub: 'staff-1', role: 'staff', tenantId: 'default' };
      const staffPhoneRes = await app.fetch(
        new Request('https://test.local/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'Kiểm tra đơn hàng khách',
            phone: '0902222222',
          }),
        }),
        { AURA_DB: d1 }
      );
      expect(staffPhoneRes.status).toBe(200);
    });

    it('does not match customer_id against data.phone and isolates table_bill fallback query across tenants', async () => {
      const sqlite = new DatabaseSync(':memory:');
      // Legacy orders schema without total_amount so processCustomerQuery enters the fallback catch branch
      sqlite.exec(`
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT,
          tenant_id TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_phone TEXT,
          table_id TEXT,
          table_number TEXT,
          total REAL,
          status TEXT,
          tenant_id TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // Order whose customer_id happens to look like a phone number, while actual customer_phone is different
      sqlite
        .prepare("INSERT INTO orders (id, customer_id, customer_phone, total, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run('ord-cid-match', '0909888777', '0900000000', 120000, 'preparing', 'default');

      // Cross-tenant table in cafe_tables with table_number 'VIP8' linked to a default-tenant order via colliding table_id
      sqlite
        .prepare("INSERT INTO cafe_tables (id, table_number, tenant_id) VALUES (?, ?, ?)")
        .run('tbl-shared-id', 'VIP8', 'tenant_other');
      sqlite
        .prepare("INSERT INTO orders (id, customer_id, customer_phone, table_id, table_number, total, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run('ord-def-tbl1', 'cust-1', '0901111111', 'tbl-shared-id', 'A01', 88000, 'preparing', 'default');

      const d1 = createSqliteD1(sqlite);

      // 1. Querying phone '0909888777' must NOT match customer_id = '0909888777'
      const phoneLookup = await processCustomerQuery(d1 as any, undefined, 'default', {
        query: 'Kiểm tra đơn hàng',
        phone: '0909888777',
        channel: 'web',
      });
      expect(phoneLookup.intent).toBe('order_status');
      expect(phoneLookup.reply).toContain('chưa tìm thấy đơn hàng');

      // 2. Fallback table_bill query for tenant 'default' on 'VIP8' (which belongs to 'tenant_other' in cafe_tables) must NOT match
      const crossTenantTableRes = await processCustomerQuery(d1 as any, undefined, 'default', {
        query: 'Tính tiền bàn VIP8',
        table_number: 'VIP8',
        channel: 'web',
      });
      expect(crossTenantTableRes.intent).toBe('table_bill');
      expect(crossTenantTableRes.reply).toContain('không có hóa đơn');

      // 3. Fallback table_bill query for tenant 'default' on o.table_number = 'A01' succeeds
      const ownTableNumberRes = await processCustomerQuery(d1 as any, undefined, 'default', {
        query: 'Tính tiền bàn A01',
        table_number: 'A01',
        channel: 'web',
      });
      expect(ownTableNumberRes.intent).toBe('table_bill');
      expect(ownTableNumberRes.reply).toContain('88');
    });
  });

  describe('TastyIgniter menu route tenant propagation & webhook bridge status guard', () => {
    it('propagates authenticated tenantId from GET /menu and POST /sync/menu into ti_menu_cache queries', async () => {
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
          tenant_id TEXT
        );
        CREATE TABLE ti_menu_cache (
          id TEXT PRIMARY KEY,
          name TEXT,
          sku TEXT,
          price REAL,
          active INTEGER DEFAULT 1,
          cached_at TEXT,
          tenant_id TEXT
        );
      `);
      const nowIso = new Date().toISOString();
      sqlite
        .prepare('INSERT INTO users (id, role, is_active, tenant_id) VALUES (?, ?, 1, ?)')
        .run('sup-sadec', 'supervisor', 'tenant_sadec_02');
      sqlite
        .prepare('INSERT INTO ti_menu_cache (id, name, sku, price, active, cached_at, tenant_id) VALUES (?, ?, ?, ?, 1, ?, ?)')
        .run('item-def', 'Default Espresso', 'ESP-DEF', 35000, nowIso, 'default');
      sqlite
        .prepare('INSERT INTO ti_menu_cache (id, name, sku, price, active, cached_at, tenant_id) VALUES (?, ?, ?, ?, 1, ?, ?)')
        .run('item-sad', 'SaDec Lotus Latte', 'LAT-SAD', 55000, nowIso, 'tenant_sadec_02');

      const d1 = createSqliteD1(sqlite);
      const token = await generateJWT(
        {
          id: 'sup-sadec',
          sub: 'sup-sadec',
          role: 'supervisor',
          email: 'supervisor@test.aura',
          name: 'User supervisor',
          tenantId: 'tenant_sadec_02',
          authVersion: 1,
          authTime: Math.floor(Date.now() / 1000),
          sessionType: 'staff-web',
        } as any,
        TEST_JWT_SECRET,
        3600
      );

      const app = new Hono<{ Bindings: Record<string, unknown> }>();
      app.route('/api/integrations/tastyigniter', createTIRoutes());

      const res = await app.fetch(
        new Request('https://test.local/api/integrations/tastyigniter/menu', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { AURA_DB: d1, JWT_SECRET: TEST_JWT_SECRET }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ id: string; name: string }> };
      expect(body.items.map((i) => i.id)).toEqual(['item-sad']);
    });

    it('does not mutate ti_order_bridge.status when webhook transition is invalid or cross-tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE ti_order_bridge (
          id TEXT PRIMARY KEY,
          local_order_id TEXT,
          ti_order_id TEXT,
          status TEXT,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          synced_at TEXT,
          created_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT,
          order_type TEXT,
          payment_status TEXT,
          tenant_id TEXT,
          updated_at TEXT
        );
      `);
      sqlite
        .prepare("INSERT INTO ti_order_bridge (id, local_order_id, ti_order_id, status, tenant_id, synced_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))")
        .run('br-1', 'ord-completed-1', 'ti-101', 'completed', 'default');
      sqlite
        .prepare("INSERT INTO orders (id, status, order_type, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?)")
        .run('ord-completed-1', 'completed', 'dine_in', 'paid', 'default');

      sqlite
        .prepare("INSERT INTO ti_order_bridge (id, local_order_id, ti_order_id, status, tenant_id, synced_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))")
        .run('br-2', 'ord-sadec-2', 'ti-202', 'confirmed', 'tenant_sadec_02');
      sqlite
        .prepare("INSERT INTO orders (id, status, order_type, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?)")
        .run('ord-sadec-2', 'confirmed', 'dine_in', 'paid', 'tenant_sadec_02');

      const d1 = createSqliteD1(sqlite);

      // 1. Terminal order ('completed') receiving regressive 'pending' webhook must NOT corrupt ti_order_bridge.status
      await processTIWebhook(
        { AURA_DB: d1 as any },
        { order_id: 'ti-101', status: 'received' },
        'default'
      );
      const br1 = sqlite.prepare('SELECT status FROM ti_order_bridge WHERE id = ?').get('br-1') as { status: string };
      expect(br1.status).toBe('completed');

      // 2. Cross-tenant webhook ('default' tenant context targeting 'tenant_sadec_02' order) must NOT mutate ti_order_bridge.status
      await processTIWebhook(
        { AURA_DB: d1 as any },
        { event: 'order.status_updated', order_id: 'ti-202', status: 'preparing' },
        'default'
      );
      const br2 = sqlite.prepare('SELECT status FROM ti_order_bridge WHERE id = ?').get('br-2') as { status: string };
      const ord2 = sqlite.prepare('SELECT status FROM orders WHERE id = ?').get('ord-sadec-2') as { status: string };
      expect(br2.status).toBe('confirmed');
      expect(ord2.status).toBe('confirmed');

      // 3. Matching tenant with valid transition ('confirmed' -> 'preparing') updates both ti_order_bridge and orders
      await processTIWebhook(
        { AURA_DB: d1 as any },
        { event: 'order.status_updated', order_id: 'ti-202', status: 'preparing' },
        'tenant_sadec_02'
      );
      const br2After = sqlite.prepare('SELECT status FROM ti_order_bridge WHERE id = ?').get('br-2') as { status: string };
      const ord2After = sqlite.prepare('SELECT status FROM orders WHERE id = ?').get('ord-sadec-2') as { status: string };
      expect(br2After.status).toBe('preparing');
      expect(ord2After.status).toBe('preparing');
    });
  });

  describe('Frigate sync default-tenant row hijack prevention & SQL tenant filtering before LIMIT', () => {
    it('prevents non-default tenant syncFrigateEvents from hijacking existing default-tenant events with empty/null tenant_id', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE frigate_events (
          id TEXT PRIMARY KEY,
          camera TEXT,
          label TEXT,
          start_time REAL,
          end_time REAL,
          score REAL,
          payload TEXT,
          received_at TEXT,
          tenant_id TEXT
        );
      `);
      // Existing event belonging to default tenant (legacy empty string tenant_id)
      sqlite
        .prepare("INSERT INTO frigate_events (id, camera, label, start_time, end_time, score, payload, received_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)")
        .run('evt-shared-1', 'cam_entry', 'person', 1700000100, 1700000110, 0.91, '{}', '');

      const d1 = createSqliteD1(sqlite);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'evt-shared-1', camera: 'cam_entry', label: 'person', start_time: 1700000100, end_time: 1700000110, top_score: 0.91 },
            { id: 'evt-sadec-2', camera: 'cam_patio', label: 'car', start_time: 1700000200, end_time: 1700000210, top_score: 0.88 },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const syncRes = await syncFrigateEvents(
        {
          FRIGATE_SYNC_ENABLED: 'true',
          FRIGATE_URL: 'https://frigate.example.com',
          FRIGATE_API_KEY: 'key-123',
          AURA_DB: d1 as any,
        },
        { tenantId: 'tenant_sadec_02' }
      );
      expect(syncRes.ok).toBe(true);

      // Existing default-tenant row must NOT be hijacked to 'tenant_sadec_02'
      const existingRow = sqlite.prepare('SELECT tenant_id FROM frigate_events WHERE id = ?').get('evt-shared-1') as { tenant_id: string };
      expect(existingRow.tenant_id).toBe('');

      // New row is persisted with 'tenant_sadec_02'
      const newRow = sqlite.prepare('SELECT tenant_id FROM frigate_events WHERE id = ?').get('evt-sadec-2') as { tenant_id: string };
      expect(newRow.tenant_id).toBe('tenant_sadec_02');
    });

    it('filters by tenant_id in SQL before LIMIT in getFrigateEvents so newer other-tenant events do not starve results', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE frigate_events (
          id TEXT PRIMARY KEY,
          camera TEXT,
          label TEXT,
          start_time REAL,
          end_time REAL,
          score REAL,
          payload TEXT,
          received_at TEXT,
          tenant_id TEXT
        );
      `);
      // Insert 1 older event for 'default' and 5 newer events for 'tenant_sadec_02'
      sqlite
        .prepare("INSERT INTO frigate_events (id, camera, label, start_time, end_time, score, payload, received_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)")
        .run('evt-def-old', 'cam_1', 'person', 1000, 1005, 0.9, '{}', 'default');
      for (let i = 1; i <= 5; i++) {
        sqlite
          .prepare("INSERT INTO frigate_events (id, camera, label, start_time, end_time, score, payload, received_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)")
          .run(`evt-sad-${i}`, 'cam_1', 'person', 2000 + i, 2010 + i, 0.95, '{}', 'tenant_sadec_02');
      }

      const d1 = createSqliteD1(sqlite);
      const res = await getFrigateEvents({ AURA_DB: d1 as any }, { limit: 2, tenantId: 'default' });
      expect(res.events.map((e) => e.id)).toEqual(['evt-def-old']);
    });
  });

  describe('HomeAssistant wildcard tenant sanitization, webhook log tenant_id, SQL log filtering, and safe JSON parsing', () => {
    it('sanitizes wildcard (*) tenant in POST /api/ha/webhook and handleHAWebhook and persists tenant_id on automation logs', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE ha_device_states (
          entity_id TEXT PRIMARY KEY,
          state TEXT,
          attributes TEXT,
          last_changed TEXT,
          last_updated TEXT,
          tenant_id TEXT
        );
        CREATE TABLE ha_automation_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          automation_id TEXT,
          trigger_entity TEXT,
          payload TEXT,
          result TEXT,
          executed_at TEXT,
          tenant_id TEXT
        );
      `);
      sqlite
        .prepare("INSERT INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated, tenant_id) VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)")
        .run('light.sadec_garden', 'off', '{"brightness":100}', 'tenant_sadec_02');

      const d1 = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Record<string, unknown> }>();
      app.route('/api/ha', createHARouter());

      // 1. Inbound webhook spoofing X-Tenant-ID: * and body.tenant_id: '*' falls back to default store and is blocked from mutating tenant_sadec_02 device
      const webhookRes = await app.fetch(
        new Request('https://test.local/api/ha/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-HA-Token': 'ha-secret-token',
            'X-Tenant-ID': '*',
          },
          body: JSON.stringify({
            entity_id: 'light.sadec_garden',
            state: 'on',
            tenant_id: '*',
          }),
        }),
        { AURA_DB: d1, HA_TOKEN: 'ha-secret-token' }
      );
      expect(webhookRes.status).toBe(200);
      const webhookBody = (await webhookRes.json()) as { action_taken: string };
      expect(webhookBody.action_taken).toBe('cross_tenant_blocked:light.sadec_garden');

      const deviceAfter = sqlite.prepare('SELECT state FROM ha_device_states WHERE entity_id = ?').get('light.sadec_garden') as { state: string };
      expect(deviceAfter.state).toBe('off');

      // 2. Automation feedback webhook persists tenant_id in ha_automation_log
      const autoLogWebhook = await handleHAWebhook(
        { AURA_DB: d1 as any },
        {
          automation_id: 'auto.sadec_evening',
          trigger_entity: 'sensor.lux',
          result: 'triggered',
          payload: { lux: 15 },
        },
        'tenant_sadec_02'
      );
      expect(autoLogWebhook.action_taken).toBe('automation_logged:auto.sadec_evening');
      const logRow = sqlite
        .prepare('SELECT automation_id, tenant_id FROM ha_automation_log WHERE automation_id = ?')
        .get('auto.sadec_evening') as { automation_id: string; tenant_id: string };
      expect(logRow.tenant_id).toBe('tenant_sadec_02');
    });

    it('filters ha_automation_log by tenant_id in SQL before LIMIT and safely handles malformed JSON in attributes and payload', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE ha_device_states (
          entity_id TEXT PRIMARY KEY,
          state TEXT,
          attributes TEXT,
          last_changed TEXT,
          last_updated TEXT,
          tenant_id TEXT
        );
        CREATE TABLE ha_automation_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          automation_id TEXT,
          trigger_entity TEXT,
          payload TEXT,
          result TEXT,
          executed_at TEXT,
          tenant_id TEXT
        );
      `);
      // Device with malformed JSON in attributes
      sqlite
        .prepare("INSERT INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated, tenant_id) VALUES (?, ?, ?, '2026-11-03T00:00:00Z', '2026-11-03T00:00:00Z', ?)")
        .run('light.patio_corrupt', 'on', '{malformed-json', 'default');

      // 1 older log for 'default' (with malformed payload) and 4 newer logs for 'tenant_sadec_02'
      sqlite
        .prepare('INSERT INTO ha_automation_log (automation_id, trigger_entity, payload, result, executed_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run('auto.def_1', 'sensor.temp', '{corrupt-payload', 'ok', '2026-11-03T01:00:00Z', 'default');
      for (let i = 1; i <= 4; i++) {
        sqlite
          .prepare('INSERT INTO ha_automation_log (automation_id, trigger_entity, payload, result, executed_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)')
          .run(`auto.sad_${i}`, 'sensor.temp', '{"ok":true}', 'ok', `2026-11-03T0${i + 1}:00:00Z`, 'tenant_sadec_02');
      }

      const d1 = createSqliteD1(sqlite);
      const env = { AURA_DB: d1 };

      // 1. getDeviceState, toggleDevice, and getZoneDevices do not throw 500 on malformed attributes JSON
      const stateRes = await getDeviceState(env, 'light.patio_corrupt', 'default');
      expect(stateRes.status).toBe(200);
      const stateBody = (await stateRes.json()) as { device: { attributes: Record<string, unknown> } };
      expect(stateBody.device.attributes).toEqual({});

      const toggleRes = await toggleDevice(env, 'light.patio_corrupt', false, 'default');
      expect(toggleRes.status).toBe(200);
      const toggleBody = (await toggleRes.json()) as { result: { state: string; attributes: Record<string, unknown> } };
      expect(toggleBody.result.state).toBe('off');
      expect(toggleBody.result.attributes).toEqual({});

      const zoneRes = await getZoneDevices(env, 'patio', 'default');
      expect(zoneRes.status).toBe(200);
      const zoneBody = (await zoneRes.json()) as { devices: Array<{ entity_id: string; attributes: Record<string, unknown> }> };
      expect(zoneBody.devices).toHaveLength(1);
      expect(zoneBody.devices[0].attributes).toEqual({});

      // 2. getAutomationLog filters by tenant in SQL before LIMIT (limit=2 still returns auto.def_1) and safely parses malformed payload
      const logRes = await getAutomationLog(env, 2, 'default');
      expect(logRes.status).toBe(200);
      const logBody = (await logRes.json()) as { entries: Array<{ automation_id: string; payload: unknown }> };
      expect(logBody.entries).toHaveLength(1);
      expect(logBody.entries[0].automation_id).toBe('auto.def_1');
      expect(logBody.entries[0].payload).toEqual({});
    });
  });
});
