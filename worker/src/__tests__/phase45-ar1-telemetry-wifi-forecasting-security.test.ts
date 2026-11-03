// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createWifiRoutes } from '../routes/wifi';
import { containerTelemetryRouter } from '../routes/container-telemetry';
import { inventoryForecastingRouter } from '../routes/inventory-forecasting';
import { demandForecastRouter } from '../routes/demand-forecast';
import { recommendationsRouter } from '../routes/recommendations';
import { generateJWT } from '../lib/jwt';
import type { Env } from '../types/env';

const JWT_SECRET = 'phase45-ar1-jwt-secret-key-at-least-32-chars!!';

function createSqliteD1(sqlite: DatabaseSync) {
  const makeStmt = (sql: string, boundValues: unknown[] = []) => ({
    bind(...values: unknown[]) {
      return makeStmt(sql, values);
    },
    async first<T = Record<string, unknown>>(): Promise<T | null> {
      if (/FROM users WHERE id = \?/i.test(sql)) {
        const staffId = String(boundValues[0] || '');
        const match = /^user_([a-z]+)_(.+)$/i.exec(staffId);
        if (match) {
          return {
            id: staffId,
            name: `${match[1]} user`,
            phone: '0900000000',
            role: match[1],
            tenant_id: match[2],
            is_active: 1,
            auth_version: 1,
          } as unknown as T;
        }
      }
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...(boundValues as Array<string | number | null>)) as T | undefined;
      return row ?? null;
    },
    async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...(boundValues as Array<string | number | null>)) as T[];
      return { results: rows, success: true };
    },
    async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...(boundValues as Array<string | number | null>));
      return {
        success: true,
        meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
      };
    },
  });

  return {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const s of stmts) {
        results.push(await s.run());
      }
      return results;
    },
  };
}

async function makeAuthHeader(role: string, tenantId = 'default'): Promise<Record<string, string>> {
  const now = Math.floor(Date.now() / 1000);
  const id = `user_${role}_${tenantId}`;
  const token = await generateJWT(
    {
      id,
      sub: id,
      email: `${role}@aura.test`,
      role: role as never,
      name: `${role} user`,
      tenantId,
      authVersion: 1,
      authTime: now,
      sessionType: 'staff-web',
      exp: now + 3600,
    } as never,
    JWT_SECRET,
    3600
  );
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
  };
}

describe('Phase 45 Slice AR1: Telemetry, WiFi Portal, Inventory & Demand Forecasting Security', () => {
  let sqlite: DatabaseSync;
  let env: Env;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT NOT NULL,
        phone TEXT,
        loyalty_points INTEGER DEFAULT 0,
        lifetime_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'BRONZE',
        source TEXT,
        created_at TEXT,
        updated_at TEXT,
        tenant_id TEXT DEFAULT 'default'
      );
      CREATE TABLE wifi_sessions (
        id TEXT PRIMARY KEY,
        client_mac TEXT NOT NULL,
        ip_address TEXT,
        phone TEXT,
        customer_id TEXT,
        status TEXT NOT NULL,
        session_timeout INTEGER NOT NULL,
        authorized_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'default'
      );
      CREATE TABLE container_telemetry_logs (
        id TEXT PRIMARY KEY,
        container_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        power_source TEXT NOT NULL,
        battery_percentage REAL,
        ambient_temp_celsius REAL NOT NULL,
        kds_online INTEGER NOT NULL DEFAULT 1,
        network_ping_ms REAL NOT NULL DEFAULT 20,
        alert_status TEXT NOT NULL,
        alert_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        current_stock REAL NOT NULL DEFAULT 0,
        min_stock REAL DEFAULT 10,
        max_stock REAL,
        unit TEXT DEFAULT 'kg',
        active INTEGER NOT NULL DEFAULT 1,
        tenant_id TEXT NOT NULL DEFAULT 'default'
      );
      CREATE TABLE inventory_transactions (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        created_at TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'default'
      );
      CREATE TABLE inventory_forecast_snapshots (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        item_sku TEXT NOT NULL,
        item_name TEXT NOT NULL,
        daily_run_rate REAL NOT NULL,
        current_stock REAL NOT NULL,
        days_of_supply REAL NOT NULL,
        risk_level TEXT NOT NULL,
        suggested_reorder_qty REAL NOT NULL,
        lead_time_days INTEGER NOT NULL DEFAULT 2,
        snapshot_date TEXT NOT NULL
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        total REAL,
        total_amount REAL,
        status TEXT NOT NULL,
        items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'default'
      );
      CREATE TABLE ai_product_affinities (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        item_a TEXT NOT NULL,
        item_b TEXT NOT NULL,
        co_occurrence_count INTEGER NOT NULL,
        affinity_score REAL NOT NULL,
        updated_at TEXT
      );
    `);

    const d1 = createSqliteD1(sqlite);
    env = {
      DB: d1 as unknown as Env['DB'],
      AURA_DB: d1 as unknown as Env['AURA_DB'],
      JWT_SECRET,
      STAFF_JWT_SECRET: JWT_SECRET,
      ENVIRONMENT: 'development',
    } as unknown as Env;
  });

  describe('WiFi Captive Portal multi-tenant isolation & role enforcement', () => {
    it('isolates synthetic guest emails across tenants and writes tenant_id on primary INSERT', async () => {
      const app = createWifiRoutes();

      const resDefault = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'default' },
          body: JSON.stringify({ mac: 'aa:bb:cc:dd:ee:01', phone: '0901234567', name: 'Guest Default' }),
        },
        env
      );
      expect(resDefault.status).toBe(200);
      const bodyDefault = (await resDefault.json()) as { success: boolean; customer_id: string; session_id: string };
      expect(bodyDefault.success).toBe(true);

      const resFranchise = await app.request(
        '/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_sadec_02' },
          body: JSON.stringify({ mac: 'aa:bb:cc:dd:ee:02', phone: '0901234567', name: 'Guest Franchise' }),
        },
        env
      );
      expect(resFranchise.status).toBe(200);
      const bodyFranchise = (await resFranchise.json()) as { success: boolean; customer_id: string; session_id: string };
      expect(bodyFranchise.success).toBe(true);
      expect(bodyFranchise.customer_id).not.toBe(bodyDefault.customer_id);

      const defaultCustomer = sqlite
        .prepare('SELECT email, tenant_id FROM customers WHERE id = ?')
        .get(bodyDefault.customer_id) as { email: string; tenant_id: string };
      const franchiseCustomer = sqlite
        .prepare('SELECT email, tenant_id FROM customers WHERE id = ?')
        .get(bodyFranchise.customer_id) as { email: string; tenant_id: string };

      expect(defaultCustomer.email).toBe('0901234567@wifi.aura');
      expect(defaultCustomer.tenant_id).toBe('default');
      expect(franchiseCustomer.email).toBe('0901234567+tenant_sadec_02@wifi.aura');
      expect(franchiseCustomer.tenant_id).toBe('tenant_sadec_02');

      const franchiseSession = sqlite
        .prepare('SELECT tenant_id FROM wifi_sessions WHERE id = ?')
        .get(bodyFranchise.session_id) as { tenant_id: string };
      expect(franchiseSession.tenant_id).toBe('tenant_sadec_02');
    });

    it('rejects staff role on POST /authorize while allowing supervisor and manager', async () => {
      const app = createWifiRoutes();

      const staffHeaders = await makeAuthHeader('staff', 'tenant_sadec_02');
      const resStaff = await app.request(
        '/authorize',
        {
          method: 'POST',
          headers: { ...staffHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mac: '11:22:33:44:55:66', action: 'grant', duration_seconds: 3600 }),
        },
        env
      );
      expect(resStaff.status).toBe(403);

      const supervisorHeaders = await makeAuthHeader('supervisor', 'tenant_sadec_02');
      const resSupervisor = await app.request(
        '/authorize',
        {
          method: 'POST',
          headers: { ...supervisorHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mac: '11:22:33:44:55:66', action: 'grant', duration_seconds: 3600 }),
        },
        env
      );
      expect(resSupervisor.status).toBe(200);
      const row = sqlite
        .prepare('SELECT tenant_id, status FROM wifi_sessions WHERE client_mac = ?')
        .get('11:22:33:44:55:66') as { tenant_id: string; status: string };
      expect(row.tenant_id).toBe('tenant_sadec_02');
      expect(row.status).toBe('authorized');
    });
  });

  describe('Edge Container Telemetry authentication, tenant conflict guard & Telegram escaping', () => {
    it('enforces edge secret or non-staff JWT when STAFF_JWT_SECRET / EDGE_SECRET is configured', async () => {
      const telemetryEnv = {
        ...env,
        EDGE_SECRET: 'edge-shared-secret-value-2026',
      } as unknown as Env;

      // Unauthenticated request without secret -> 401
      const unauthRes = await containerTelemetryRouter.request(
        '/telemetry/heartbeat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ container_id: 'CONT_01', ambient_temp_celsius: 26 }),
        },
        telemetryEnv
      );
      expect(unauthRes.status).toBe(401);

      // Wrong X-Edge-Secret -> 401
      const wrongSecretRes = await containerTelemetryRouter.request(
        '/telemetry/heartbeat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Edge-Secret': 'wrong-secret' },
          body: JSON.stringify({ container_id: 'CONT_01', ambient_temp_celsius: 26 }),
        },
        telemetryEnv
      );
      expect(wrongSecretRes.status).toBe(401);

      // Staff role JWT -> 403
      const staffHeaders = await makeAuthHeader('staff', 'default');
      const staffRes = await containerTelemetryRouter.request(
        '/telemetry/heartbeat',
        {
          method: 'POST',
          headers: { ...staffHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ container_id: 'CONT_01', ambient_temp_celsius: 26 }),
        },
        telemetryEnv
      );
      expect(staffRes.status).toBe(403);

      // Valid X-Edge-Secret -> 200
      const validSecretRes = await containerTelemetryRouter.request(
        '/telemetry/heartbeat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Edge-Secret': 'edge-shared-secret-value-2026',
            'X-Tenant-ID': 'tenant_sadec_02',
          },
          body: JSON.stringify({ container_id: 'CONT_01', ambient_temp_celsius: 26 }),
        },
        telemetryEnv
      );
      expect(validSecretRes.status).toBe(200);
    });

    it('blocks cross-tenant telemetry log overwrite on ID conflict while allowing same-tenant update', async () => {
      const telemetryEnv = {
        ...env,
        EDGE_SECRET: 'edge-shared-secret-value-2026',
      } as unknown as Env;

      const firstRes = await containerTelemetryRouter.request(
        '/telemetry/heartbeat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Edge-Secret': 'edge-shared-secret-value-2026',
            'X-Tenant-ID': 'tenant_alpha',
          },
          body: JSON.stringify({
            id: 'tel_fixed_001',
            container_id: 'CONT_ALPHA',
            ambient_temp_celsius: 25,
          }),
        },
        telemetryEnv
      );
      expect(firstRes.status).toBe(200);

      // Cross-tenant attempt with same id -> 409 and does not overwrite tenant_alpha row
      const crossTenantRes = await containerTelemetryRouter.request(
        '/telemetry/heartbeat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Edge-Secret': 'edge-shared-secret-value-2026',
            'X-Tenant-ID': 'tenant_beta',
          },
          body: JSON.stringify({
            id: 'tel_fixed_001',
            container_id: 'CONT_HIJACK',
            ambient_temp_celsius: 45,
          }),
        },
        telemetryEnv
      );
      expect(crossTenantRes.status).toBe(409);

      const stored = sqlite
        .prepare('SELECT container_id, tenant_id, ambient_temp_celsius FROM container_telemetry_logs WHERE id = ?')
        .get('tel_fixed_001') as { container_id: string; tenant_id: string; ambient_temp_celsius: number };
      expect(stored.container_id).toBe('CONT_ALPHA');
      expect(stored.tenant_id).toBe('tenant_alpha');
      expect(stored.ambient_temp_celsius).toBe(25);

      // Same-tenant update with same id -> 200 and updates telemetry values
      const sameTenantRes = await containerTelemetryRouter.request(
        '/telemetry/heartbeat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Edge-Secret': 'edge-shared-secret-value-2026',
            'X-Tenant-ID': 'tenant_alpha',
          },
          body: JSON.stringify({
            id: 'tel_fixed_001',
            container_id: 'CONT_ALPHA',
            ambient_temp_celsius: 29,
          }),
        },
        telemetryEnv
      );
      expect(sameTenantRes.status).toBe(200);
      const updated = sqlite
        .prepare('SELECT ambient_temp_celsius FROM container_telemetry_logs WHERE id = ?')
        .get('tel_fixed_001') as { ambient_temp_celsius: number };
      expect(updated.ambient_temp_celsius).toBe(29);
    });

    it('escapes Markdown special characters in container_id and throttles duplicate CRITICAL Telegram alerts via KV', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      try {
        const kvStore = new Map<string, string>();
        const tgEnv = {
          ...env,
          EDGE_SECRET: 'edge-shared-secret-value-2026',
          TELEGRAM_BOT_TOKEN: 'bot_test_token',
          TELEGRAM_CHAT_ID: 'chat_test_id',
          AUTH_KV: {
            get: async (k: string) => kvStore.get(k) ?? null,
            put: async (k: string, v: string) => {
              kvStore.set(k, v);
            },
          },
        } as unknown as Env;

        const res = await containerTelemetryRouter.request(
          '/telemetry/heartbeat',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Edge-Secret': 'edge-shared-secret-value-2026',
            },
            body: JSON.stringify({
              container_id: 'CONT_`*[INJECT]_1',
              ambient_temp_celsius: 41.5,
            }),
          },
          tgEnv
        );
        expect(res.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body || '{}')) as { text?: string };
        expect(payload.text).toContain('CONT\\_\\`\\*\\[INJECT\\]\\_1');

        // Second immediate CRITICAL heartbeat for same container is throttled by KV cooldown
        const res2 = await containerTelemetryRouter.request(
          '/telemetry/heartbeat',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Edge-Secret': 'edge-shared-secret-value-2026',
            },
            body: JSON.stringify({
              container_id: 'CONT_`*[INJECT]_1',
              ambient_temp_celsius: 42.0,
            }),
          },
          tgEnv
        );
        expect(res2.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Inventory Forecasting max_stock precedence & legacy history fallback', () => {
    it('honors item.max_stock over min_stock * 3 in both /run-rate and /snapshot', async () => {
      const nowIso = new Date().toISOString();
      sqlite
        .prepare(
          `INSERT INTO inventory_items (id, sku, name, current_stock, min_stock, max_stock, unit, active, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'default')`
        )
        .run('item_1', 'SKU_MILK', 'Fresh Milk', 20, 10, 120, 'liter');
      sqlite
        .prepare(
          `INSERT INTO inventory_items (id, sku, name, current_stock, min_stock, max_stock, unit, active, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'default')`
        )
        .run('item_2', 'SKU_SYRUP', 'Vanilla Syrup', 10, 15, null, 'bottle');
      sqlite
        .prepare(
          `INSERT INTO inventory_transactions (id, item_id, type, quantity, created_at, tenant_id)
           VALUES (?, ?, 'out', ?, ?, 'default')`
        )
        .run('tx_1', 'item_1', 14, nowIso);

      const managerHeaders = await makeAuthHeader('manager', 'default');
      const runRateRes = await inventoryForecastingRouter.request(
        '/run-rate?days=7&lead_time_days=2',
        { headers: managerHeaders },
        env
      );
      expect(runRateRes.status).toBe(200);
      const runRateBody = (await runRateRes.json()) as {
        success: boolean;
        data: Array<{ sku: string; suggested_reorder_qty: number }>;
      };
      const milkForecast = runRateBody.data.find((d) => d.sku === 'SKU_MILK')!;
      const syrupForecast = runRateBody.data.find((d) => d.sku === 'SKU_SYRUP')!;

      // SKU_MILK: max_stock = 120, current_stock = 20, daily_run_rate = 14/7 = 2, projectedDepletion = 4 -> 120 - 20 + 4 = 104
      expect(milkForecast.suggested_reorder_qty).toBe(104);
      // SKU_SYRUP: max_stock = null, min_stock = 15 -> maxStock = 45, current_stock = 10, rate = 0 -> 45 - 10 = 35
      expect(syrupForecast.suggested_reorder_qty).toBe(35);

      const snapRes = await inventoryForecastingRouter.request(
        '/snapshot',
        { method: 'POST', headers: managerHeaders },
        env
      );
      expect(snapRes.status).toBe(200);

      const milkSnap = sqlite
        .prepare('SELECT suggested_reorder_qty FROM inventory_forecast_snapshots WHERE item_sku = ?')
        .get('SKU_MILK') as { suggested_reorder_qty: number };
      const syrupSnap = sqlite
        .prepare('SELECT suggested_reorder_qty FROM inventory_forecast_snapshots WHERE item_sku = ?')
        .get('SKU_SYRUP') as { suggested_reorder_qty: number };
      expect(milkSnap.suggested_reorder_qty).toBe(104);
      expect(syrupSnap.suggested_reorder_qty).toBe(35);
    });

    it('supports legacy inventory_forecast_snapshots schema without tenant_id for default tenant while isolating non-default tenants', async () => {
      const legacySqlite = new DatabaseSync(':memory:');
      legacySqlite.exec(`
        CREATE TABLE inventory_forecast_snapshots (
          id TEXT PRIMARY KEY,
          item_sku TEXT NOT NULL,
          item_name TEXT NOT NULL,
          daily_run_rate REAL NOT NULL,
          current_stock REAL NOT NULL,
          days_of_supply REAL NOT NULL,
          risk_level TEXT NOT NULL,
          suggested_reorder_qty REAL NOT NULL,
          lead_time_days INTEGER NOT NULL DEFAULT 2,
          snapshot_date TEXT NOT NULL
        );
        INSERT INTO inventory_forecast_snapshots (
          id, item_sku, item_name, daily_run_rate, current_stock, days_of_supply, risk_level, suggested_reorder_qty, lead_time_days, snapshot_date
        ) VALUES ('snap_1', 'SKU_COFFEE', 'Arabica', 3.5, 10, 2.8, 'WARNING', 47, 2, '2026-11-03');
      `);
      const legacyD1 = createSqliteD1(legacySqlite);
      const legacyEnv = {
        ...env,
        DB: legacyD1 as unknown as Env['DB'],
        AURA_DB: legacyD1 as unknown as Env['AURA_DB'],
      } as unknown as Env;

      const defaultHeaders = await makeAuthHeader('manager', 'default');
      const resDefault = await inventoryForecastingRouter.request('/history', { headers: defaultHeaders }, legacyEnv);
      expect(resDefault.status).toBe(200);
      const bodyDefault = (await resDefault.json()) as { data: unknown[] };
      expect(bodyDefault.data).toHaveLength(1);

      const otherTenantHeaders = await makeAuthHeader('manager', 'tenant_sadec_02');
      const resOther = await inventoryForecastingRouter.request('/history', { headers: otherTenantHeaders }, legacyEnv);
      expect(resOther.status).toBe(200);
      const bodyOther = (await resOther.json()) as { data: unknown[] };
      expect(bodyOther.data).toHaveLength(0);
    });
  });

  describe('Recommendations & Demand Forecast order status filtering, numeric coercion & tenant isolation', () => {
    it('excludes failed/rejected/expired/cancelled orders and coerces string item quantities in recommendations', async () => {
      const nowIso = new Date().toISOString();
      const insertOrder = sqlite.prepare(
        `INSERT INTO orders (id, total, total_amount, status, items, created_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      insertOrder.run(
        'ord_valid_1',
        65000,
        65000,
        'completed',
        JSON.stringify([
          { id: 'cfs_01', name: 'Cà Phê Sữa', quantity: '3' },
          { id: 'croissant_01', name: 'Croissant', quantity: 2 },
        ]),
        nowIso,
        'default'
      );
      insertOrder.run(
        'ord_failed_1',
        90000,
        90000,
        'FAILED',
        JSON.stringify([
          { id: 'cfs_01', name: 'Cà Phê Sữa', quantity: 50 },
          { id: 'poison_item', name: 'Poison Item', quantity: 50 },
        ]),
        nowIso,
        'default'
      );
      insertOrder.run(
        'ord_rejected_1',
        90000,
        90000,
        'rejected',
        JSON.stringify([{ id: 'poison_item', name: 'Poison Item', quantity: 20 }]),
        nowIso,
        'default'
      );
      insertOrder.run(
        'ord_expired_1',
        90000,
        90000,
        'expired',
        JSON.stringify([{ id: 'poison_item', name: 'Poison Item', quantity: 20 }]),
        nowIso,
        'default'
      );

      const trendingRes = await recommendationsRouter.request('/trending?range=24h', {
        headers: { 'X-Tenant-ID': 'default' },
      }, env);
      expect(trendingRes.status).toBe(200);
      const trendingBody = (await trendingRes.json()) as {
        data: Array<{ id: string; orders_count: number }>;
      };
      const cfs = trendingBody.data.find((d) => d.id === 'cfs_01');
      const poison = trendingBody.data.find((d) => d.id === 'poison_item');
      expect(cfs?.orders_count).toBe(3);
      expect(typeof cfs?.orders_count).toBe('number');
      expect(poison).toBeUndefined();

      const managerHeaders = await makeAuthHeader('manager', 'default');
      const mineRes = await recommendationsRouter.request(
        '/mine-affinities',
        { method: 'POST', headers: managerHeaders },
        env
      );
      expect(mineRes.status).toBe(200);
      const affinities = sqlite
        .prepare('SELECT item_a, item_b FROM ai_product_affinities WHERE tenant_id = ?')
        .all('default') as Array<{ item_a: string; item_b: string }>;
      expect(affinities.some((a) => a.item_a === 'poison_item' || a.item_b === 'poison_item')).toBe(false);
      expect(affinities.some((a) => a.item_a === 'cfs_01' && a.item_b === 'croissant_01')).toBe(true);
    });

    it('prevents cross-tenant unscoped affinity mining when tenant_id column is absent and targetTenant !== default', async () => {
      const legacySqlite = new DatabaseSync(':memory:');
      legacySqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          items TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE ai_product_affinities (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          item_a TEXT NOT NULL,
          item_b TEXT NOT NULL,
          co_occurrence_count INTEGER NOT NULL,
          affinity_score REAL NOT NULL,
          updated_at TEXT
        );
        INSERT INTO orders (id, status, items, created_at)
        VALUES ('o1', 'completed', '[{"id":"item_default_a"},{"id":"item_default_b"}]', datetime('now'));
      `);
      const legacyD1 = createSqliteD1(legacySqlite);
      const legacyEnv = {
        ...env,
        DB: legacyD1 as unknown as Env['DB'],
        AURA_DB: legacyD1 as unknown as Env['AURA_DB'],
      } as unknown as Env;

      const franchiseHeaders = await makeAuthHeader('manager', 'tenant_sadec_02');
      const res = await recommendationsRouter.request(
        '/mine-affinities',
        { method: 'POST', headers: franchiseHeaders },
        legacyEnv
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { mined_pairs: number };
      expect(body.mined_pairs).toBe(0);
    });

    it('uses COALESCE(total, total_amount, 0) and excludes failed/rejected/expired orders in demand forecast', async () => {
      const nowIso = new Date().toISOString();
      const insertOrder = sqlite.prepare(
        `INSERT INTO orders (id, total, total_amount, status, items, created_at, tenant_id)
         VALUES (?, ?, ?, ?, '[]', ?, 'default')`
      );
      insertOrder.run('ord_1', null, 140000, 'completed', nowIso);
      insertOrder.run('ord_2', 140000, 140000, 'paid', nowIso);
      insertOrder.run('ord_fail', 999999, 999999, 'failed', nowIso);
      insertOrder.run('ord_rej', 999999, 999999, 'REJECTED', nowIso);
      insertOrder.run('ord_exp', 999999, 999999, 'expired', nowIso);

      const managerHeaders = await makeAuthHeader('manager', 'default');
      const forecastRes = await demandForecastRouter.request('/forecast?days=7', { headers: managerHeaders }, env);
      expect(forecastRes.status).toBe(200);
      const forecastBody = (await forecastRes.json()) as {
        data: { historical_sample_orders: number };
      };
      expect(forecastBody.data.historical_sample_orders).toBe(2);

      const hourlyRes = await demandForecastRouter.request('/forecast/hourly', { headers: managerHeaders }, env);
      expect(hourlyRes.status).toBe(200);
      const hourlyBody = (await hourlyRes.json()) as {
        data: { hourly_distribution: Record<string, number> };
      };
      const totalHourlyOrders = Object.values(hourlyBody.data.hourly_distribution).reduce((a, b) => a + b, 0);
      expect(totalHourlyOrders).toBe(2);
    });
  });
});
