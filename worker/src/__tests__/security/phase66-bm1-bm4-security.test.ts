// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { generateJWT } from '../../lib/jwt';
import { optionalAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';

// BM1 imports
import { handleErpnextPosRequest } from '../../routes/erpnext-pos';
import { handleErpnextRequest } from '../../routes/erpnext';
import { handleErpnextInvoicesRequest } from '../../routes/erpnext-invoices';
import { bridgeOrderToTI } from '../../tree/integrations/tastyigniter/sync';
import { processTIWebhook } from '../../tree/integrations/tastyigniter/webhook';
import { createTIRoutes } from '../../routes/integrations/tastyigniter';
import { zaloWebhookRouter } from '../../routes/zalo-webhook';
import { registerWebhookHandler as registerCalWebhookHandler } from '../../routes/cal-booking-webhook-handlers/webhook-handler';
import { handlePayosWebhook } from '../../routes/webhooks-handlers/payos';
import { processErpnextRetryQueue } from '../../routes/cron-handlers/erpnext-sync';

// BM2 imports
import { registerMetricsHandlers } from '../../routes/analytics-handlers/metrics-handlers';
import { resolveAnalyticsTenant } from '../../tree/analytics/summary';
import { payInvoice } from '../../tree/subscriptions/invoice-handlers';
import { cancelSubscription } from '../../tree/subscriptions/sub-handlers';
import { requireAdmin as requireSubAdmin, requireVendor as requireSubVendor } from '../../tree/subscriptions/middleware';
import { updateMRRSnapshot } from '../../tree/subscriptions/mrr-calculator';
import { createTenantRoutes } from '../../routes/saas-tenants';
import { reportsRouter } from '../../routes/reports';
import { adminSalesRouter } from '../../routes/admin-sales';
import adminMetricsRouter from '../../routes/admin-metrics';
import { registerQueryHandler as registerAuditLogQueryHandler } from '../../routes/admin-audit-logs';

// BM3 imports
import { productsRouter } from '../../../../packages/domain/catalog/commands/products';
import { categoriesRouter } from '../../../../packages/domain/catalog/commands/categories';
import { menuModifiersRouter } from '../../../../packages/domain/catalog/commands/menu-modifiers';
import { syncProductToMenuProjection } from '../../../../packages/domain/catalog/policies/menu-projection';
import { resolveServerProductPrice } from '../../../../packages/domain/catalog/policies/pricing-resolver';
import {
  resolveCatalogTenantId as resolveOpenApiProductsTenantId,
  FORBIDDEN_TENANT_SENTINEL as PRODUCTS_FORBIDDEN_SENTINEL,
} from '../../routes/openapi-products-handlers/helpers';
import {
  resolveCatalogTenantId as resolveOpenApiCategoriesTenantId,
  FORBIDDEN_TENANT_SENTINEL as CATEGORIES_FORBIDDEN_SENTINEL,
} from '../../routes/openapi-categories-handlers/helpers';
import { dynamicPricingRouter } from '../../routes/dynamic-pricing';
import { inventoryCRUD } from '../../../../packages/domain/inventory/src/routes/inventory-crud';
import { inventoryTransactions } from '../../../../packages/domain/inventory/src/routes/inventory-transactions';
import { registerIngredientHandlers } from '../../routes/openapi-inventory-handlers/ingredient-handlers';
import { registerSupplierHandlers } from '../../routes/openapi-inventory-handlers/supplier-handlers';
import { inventoryForecastingRouter } from '../../routes/inventory-forecasting';
import { demandForecastRouter } from '../../routes/demand-forecast';

// BM4 imports
import { customerAssistantRouter } from '../../routes/customer-assistant';
import { dindinRouter } from '../../routes/dindin';
import { checkinRouter } from '../../routes/checkin';
import { getNotifications } from '../../routes/notifications-mobile';
import { reviewsRouter } from '../../routes/reviews';
import { renderTemplate } from '../../../../packages/domain/crm/commands/campaign/templates';
import { logSend } from '../../../../packages/domain/crm/commands/campaign/dedup';
import { pushRouter } from '../../routes/push';
import { chatRouter } from '../../routes/chat';
import { recruitmentRouter } from '../../routes/recruitment';
import { campaignsRouter } from '../../routes/campaigns';

const JWT_SECRET = 'phase66-bm1-bm4-security-secret-key-32chars!';

const activeSqlites = new Set<DatabaseSync>();
const issuedStaffAccounts = new Map<string, { id: string; role: string; tenant_id: string }>();

function ensureUsersTable(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT 'Staff',
      email TEXT,
      phone TEXT DEFAULT '0900000000',
      role TEXT DEFAULT 'staff',
      tenant_id TEXT DEFAULT 'default',
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1
    );
  `);
  for (const colDef of [
    "name TEXT DEFAULT 'Staff'",
    'email TEXT',
    "phone TEXT DEFAULT '0900000000'",
    "role TEXT DEFAULT 'staff'",
    "tenant_id TEXT DEFAULT 'default'",
    'is_active INTEGER DEFAULT 1',
    'auth_version INTEGER DEFAULT 1',
  ]) {
    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${colDef}`);
    } catch {
      // column already exists
    }
  }
  for (const acc of issuedStaffAccounts.values()) {
    try {
      sqlite
        .prepare(
          `INSERT OR IGNORE INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
           VALUES (?, 'Staff', '0900000000', ?, ?, 1, 1)`
        )
        .run(acc.id, acc.role, acc.tenant_id);
    } catch {
      // ignore
    }
  }
}

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const role = String(payload.role || '');
  const id = String(payload.id || payload.sub || '');
  const rawTenant = String(payload.tenantId ?? payload.tenant_id ?? 'default');
  const nowSec = Math.floor(Date.now() / 1000);
  if (role && role !== 'customer') {
    issuedStaffAccounts.set(id, { id, role, tenant_id: rawTenant });
    for (const sq of activeSqlites) {
      try {
        ensureUsersTable(sq);
      } catch {
        // ignore
      }
    }
    return generateJWT(
      {
        ...payload,
        id,
        role,
        tenantId: rawTenant,
        tenant_id: rawTenant,
        authTime: (payload.authTime as number | undefined) ?? nowSec,
        authVersion: (payload.authVersion as number | undefined) ?? 1,
        sessionType: (payload.sessionType as string | undefined) ?? 'staff-web',
      } as Parameters<typeof generateJWT>[0],
      secret,
      28800,
      nowSec
    );
  }
  return generateJWT(payload as Parameters<typeof generateJWT>[0], secret);
}

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  activeSqlites.add(sqlite);
  ensureUsersTable(sqlite);
  const prepare = (sql: string) => {
    const createBound = (params: unknown[]) => ({
      bind: (...next: unknown[]) => createBound(next),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] ?? null) as unknown) as T;
        return (row as unknown) as T;
      },
      all: async <T = Record<string, unknown>>() => {
        const stmt = sqlite.prepare(sql);
        const results = stmt.all(...(params as never[])) as unknown as T[];
        return { results, success: true, meta: { changes: 0 } };
      },
      run: async () => {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...(params as never[]));
        return {
          success: true,
          results: [],
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
      raw: async () => [],
    });
    return createBound([]);
  };

  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function createMemoryKV(initial: Record<string, string> = {}): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: async (key: string, type?: string) => {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      if (type === 'json') {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    },
    put: async (key: string, value: string) => {
      store.set(key, String(value));
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async (opts?: { prefix?: string }) => {
      const prefix = opts?.prefix || '';
      const keys = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  } as unknown as KVNamespace & { store: Map<string, string> };
}

async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Phase 66 Security & Multi-Tenant Suite (BM1..BM4)', () => {
  // =========================================================================
  // Cluster BM1: Webhooks, External Integrations & Cron (5 tests)
  // =========================================================================
  describe('BM1 — Webhooks, External Integrations (ERPNext, TastyIgniter, Zalo, Cal.com, PayOS) & Cron', () => {
    it('BM1-01: ERPNext POS webhook fails closed without secret in production, verifies HMAC-SHA256, binds server tenant, and products/sync enforces JWT revocation & active staff session', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE erpnext_webhook_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctype TEXT,
          docname TEXT,
          action TEXT,
          payload TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          role TEXT,
          tenant_id TEXT,
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1
        );
        INSERT INTO users (id, role, tenant_id, is_active, auth_version) VALUES ('staff_inactive', 'manager', 'tenant_a', 0, 1);
      `);
      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV();

      // 1) Production POS webhook without ERPNEXT_WEBHOOK_SECRET -> 503
      const payloadStr = JSON.stringify({
        doctype: 'POS Invoice',
        docname: 'POS-INV-001',
        action: 'submit',
        data: {
          tenant_id: 'tenant_spoofed',
          grand_total: 55000,
        },
      });
      const noSecretRes = await handleErpnextPosRequest(
        new Request('https://example.com/api/erpnext-pos/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
        }),
        { AURA_DB: db, ENVIRONMENT: 'production' }
      );
      expect(noSecretRes.status).toBe(503);

      // 2) Invalid HMAC signature -> 401
      const badSigRes = await handleErpnextPosRequest(
        new Request('https://example.com/api/erpnext-pos/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-Webhook-Signature': 'deadbeef',
          },
          body: payloadStr,
        }),
        { AURA_DB: db, ENVIRONMENT: 'production', ERPNEXT_WEBHOOK_SECRET: 'pos-secret-123', PILOT_TENANT_ID: 'tenant_a' }
      );
      expect(badSigRes.status).toBe(401);

      // 3) Valid HMAC signature -> 200 and binds webhook log to server PILOT_TENANT_ID ('tenant_a'), ignoring payload tenant_id
      const validHex = await computeHmacSha256Hex('pos-secret-123', payloadStr);
      const okWebhookRes = await handleErpnextPosRequest(
        new Request('https://example.com/api/erpnext-pos/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-Webhook-Signature': validHex,
          },
          body: payloadStr,
        }),
        { AURA_DB: db, ENVIRONMENT: 'production', ERPNEXT_WEBHOOK_SECRET: 'pos-secret-123', PILOT_TENANT_ID: 'tenant_a' }
      );
      expect(okWebhookRes.status).toBe(200);
      const logRow = sqlite
        .prepare('SELECT tenant_id FROM erpnext_webhook_log WHERE docname = ?')
        .get('POS-INV-001') as { tenant_id: string };
      expect(logRow.tenant_id).toBe('tenant_a');

      // 4) POST /api/erpnext-pos/products/sync rejects revoked token (401) and deactivated user (403)
      const revokedToken = await signJWT(
        { sub: 'staff_1', id: 'staff_1', role: 'manager', tenant_id: 'tenant_a', jti: 'jti-revoked-99' },
        JWT_SECRET
      );
      await kv.put(`revoked:${revokedToken}`, '1');
      const revokedSyncRes = await handleErpnextPosRequest(
        new Request('https://example.com/api/erpnext-pos/products/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${revokedToken}` },
        }),
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET }
      );
      expect(revokedSyncRes.status).toBe(401);

      const inactiveToken = await signJWT(
        { sub: 'staff_inactive', id: 'staff_inactive', role: 'manager', tenant_id: 'tenant_a', jti: 'jti-active-1' },
        JWT_SECRET
      );
      const inactiveSyncRes = await handleErpnextPosRequest(
        new Request('https://example.com/api/erpnext-pos/products/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${inactiveToken}` },
        }),
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET }
      );
      expect(inactiveSyncRes.status).toBe(403);
    });

    it('BM1-02: ERPNext configure enforces admin role, loyalty customer ownership fails closed across tenants, and invoice VAT fails closed on cross-tenant invoice', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT);
        CREATE TABLE invoices (id TEXT PRIMARY KEY, order_id TEXT, tenant_id TEXT);
        INSERT INTO customers (id, name, tenant_id) VALUES ('cust_b', 'Bob B', 'tenant_b');
        INSERT INTO invoices (id, order_id, tenant_id) VALUES ('SINV-B-001', 'ord_b', 'tenant_b');
      `);
      const db = createSqliteD1(sqlite);

      // 1) Staff cannot access GET /api/erpnext/configure -> 403
      const staffToken = await signJWT({ sub: 'u_staff', id: 'u_staff', role: 'staff', tenant_id: 'tenant_a' }, JWT_SECRET);
      const configRes = await handleErpnextRequest(
        new Request('https://example.com/api/erpnext/configure', {
          method: 'GET',
          headers: { Authorization: `Bearer ${staffToken}` },
        }),
        { AURA_DB: db, JWT_SECRET }
      );
      expect(configRes.status).toBe(403);

      // 2) Manager in tenant_a cannot query loyalty for cust_b in tenant_b -> 404 (cross-tenant customer hidden)
      const mgrTokenA = await signJWT({ sub: 'u_mgr_a', id: 'u_mgr_a', role: 'manager', tenant_id: 'tenant_a' }, JWT_SECRET);
      const crossLoyaltyRes = await handleErpnextRequest(
        new Request('https://example.com/api/erpnext/customer/cust_b', {
          method: 'GET',
          headers: { Authorization: `Bearer ${mgrTokenA}` },
        }),
        {
          AURA_DB: db,
          JWT_SECRET,
          ERPNEXT_URL: 'https://erp.example.com',
          ERPNEXT_API_KEY: 'key',
          ERPNEXT_API_SECRET: 'sec',
        }
      );
      expect(crossLoyaltyRes.status).toBe(404);

      // 3) Manager in tenant_a cannot generate VAT invoice for SINV-B-001 in tenant_b -> 404
      const crossVatRes = await handleErpnextInvoicesRequest(
        new Request('https://example.com/api/erpnext-invoices/SINV-B-001/vat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrTokenA}` },
          body: JSON.stringify({
            buyerName: 'Co A',
            buyerTaxId: '0101234567',
            buyerAddress: '123 St',
          }),
        }),
        { AURA_DB: db, JWT_SECRET }
      );
      expect(crossVatRes.status).toBe(404);
    });

    it('BM1-03: TastyIgniter webhook fails closed without secret in production, bridgeOrderToTI persists tenant_id, and processTIWebhook rejects NULL-tenant bridge rows for non-default tenants', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE ti_order_bridge (
          id TEXT PRIMARY KEY,
          local_order_id TEXT,
          ti_order_id TEXT,
          status TEXT,
          error TEXT,
          synced_at TEXT,
          created_at TEXT,
          tenant_id TEXT
        );
        INSERT INTO orders (id, status, tenant_id) VALUES ('ord_legacy_null', 'pending', 'default');
        INSERT INTO ti_order_bridge (id, local_order_id, ti_order_id, status, tenant_id, created_at)
        VALUES ('tib_legacy_1', 'ord_legacy_null', '9001', 'synced', NULL, '2026-11-05T00:00:00Z');
      `);
      const db = createSqliteD1(sqlite);

      // 1) POST /webhook on createTIRoutes() fails closed with 503 in production when TASTYIGNITER_WEBHOOK_SECRET is unset
      const app = new Hono<{ Bindings: Env }>();
      app.route('/ti', createTIRoutes());
      const noSecretRes = await app.request(
        '/ti/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'order.status_updated', order_id: 9001, status_id: 3, status_name: 'Preparation' }),
        },
        { AURA_DB: db, ENVIRONMENT: 'production' } as unknown as Env
      );
      expect(noSecretRes.status).toBe(503);

      // 2) processTIWebhook for tenant_b rejects bridge row with NULL tenant_id
      const crossWebhook = await processTIWebhook(
        { AURA_DB: db },
        { event: 'order.status_updated', order_id: 9001, status_id: 3, status_name: 'Preparation' },
        'tenant_b'
      );
      expect(crossWebhook.updated).toBe(false);

      // 3) bridgeOrderToTI persists tenant_id on skipped/queued bridge record
      await bridgeOrderToTI(
        { AURA_DB: db },
        'ord_t_b',
        {
          id: 'ord_t_b',
          items: [],
          total: 45000,
          tenant_id: 'tenant_b',
        },
        'tenant_b'
      );
      const bridgeRow = sqlite
        .prepare('SELECT tenant_id, status FROM ti_order_bridge WHERE local_order_id = ?')
        .get('ord_t_b') as { tenant_id: string; status: string };
      expect(bridgeRow.tenant_id).toBe('tenant_b');
      expect(bridgeRow.status).toBe('skipped');
    });

    it('BM1-04: Zalo OA webhook enforces timestamp freshness and ZALO_APP_ID match, and Cal.com webhook blocks wildcard/cross-tenant overrides', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE reservations (
          id TEXT PRIMARY KEY,
          customer_name TEXT,
          customer_phone TEXT,
          party_size INTEGER,
          reservation_date TEXT,
          reservation_time TEXT,
          status TEXT,
          notes TEXT,
          source TEXT,
          cal_booking_uid TEXT,
          tenant_id TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV();

      // 1) Zalo OA webhook: missing or stale timestamp on signed request -> 401
      const zaloApp = new Hono<{ Bindings: Env }>();
      zaloApp.route('/zalo', zaloWebhookRouter);
      const staleTs = String(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      const zaloBody = JSON.stringify({
        app_id: 'app_123',
        event_name: 'user_send_text',
        timestamp: staleTs,
        sender: { id: 'z_user_1' },
        message: { msg_id: 'msg_1', text: 'Menu' },
      });
      const macInput = `app_123${zaloBody}${staleTs}zalo_sec`;
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(macInput));
      const macHex = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const staleRes = await zaloApp.request(
        '/zalo',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-ZEvent-Signature': `mac=${macHex}` },
          body: zaloBody,
        },
        { AURA_DB: db, AUTH_KV: kv, ZALO_OA_SECRET: 'zalo_sec', ZALO_APP_ID: 'app_123' } as unknown as Env
      );
      expect(staleRes.status).toBe(401);

      // 2) Cal.com webhook: rejects wildcard 'hq' in metadata.tenant_id (400) and cross-tenant mismatch (403)
      const calApp = new Hono<{ Bindings: Env }>();
      registerCalWebhookHandler(calApp);
      const calSecret = 'cal_secret_key_001';
      const wildcardCalBody = JSON.stringify({
        triggerEvent: 'BOOKING_CREATED',
        createdAt: '2026-11-06T09:00:00Z',
        payload: {
          uid: 'cal_uid_1',
          title: 'Table Booking',
          startTime: '2026-11-06T10:00:00Z',
          endTime: '2026-11-06T11:00:00Z',
          organizer: { name: 'AURA Cafe', email: 'host@auracafe.vn' },
          location: 'Sa Dec',
          metadata: { tenant_id: 'hq' },
          attendees: [{ name: 'Guest', email: 'g@example.com', timeZone: 'Asia/Ho_Chi_Minh' }],
        },
      });
      const wildcardCalSig = await computeHmacSha256Hex(calSecret, wildcardCalBody);
      const calWildcardRes = await calApp.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Cal-Signature-256': wildcardCalSig },
          body: wildcardCalBody,
        },
        { AURA_DB: db, CAL_WEBHOOK_SECRET: calSecret, PILOT_TENANT_ID: 'tenant_a' } as unknown as Env
      );
      expect(calWildcardRes.status).toBe(400);

      const mismatchCalBody = JSON.stringify({
        triggerEvent: 'BOOKING_CREATED',
        createdAt: '2026-11-06T09:00:00Z',
        payload: {
          uid: 'cal_uid_2',
          title: 'Table Booking',
          startTime: '2026-11-06T10:00:00Z',
          endTime: '2026-11-06T11:00:00Z',
          organizer: { name: 'AURA Cafe', email: 'host@auracafe.vn' },
          location: 'Sa Dec',
          metadata: { tenant_id: 'tenant_b' },
          attendees: [{ name: 'Guest', email: 'g@example.com', timeZone: 'Asia/Ho_Chi_Minh' }],
        },
      });
      const mismatchCalSig = await computeHmacSha256Hex(calSecret, mismatchCalBody);
      const calMismatchRes = await calApp.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Cal-Signature-256': mismatchCalSig },
          body: mismatchCalBody,
        },
        { AURA_DB: db, CAL_WEBHOOK_SECRET: calSecret, CAL_WEBHOOK_TENANT: 'tenant_a' } as unknown as Env
      );
      expect(calMismatchRes.status).toBe(403);
    });

    it('BM1-05: PayOS webhook rejects payment/order tenant mismatch (409), and ERPNext retry queue resolves per-tenant KV credentials and scopes row updates', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          transaction_id TEXT,
          status TEXT,
          amount INTEGER,
          method TEXT,
          tenant_id TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT,
          payment_status TEXT,
          payment_method TEXT,
          total INTEGER,
          tenant_id TEXT
        );
        CREATE TABLE erpnext_sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT,
          entity_id TEXT,
          action TEXT,
          payload TEXT,
          status TEXT,
          attempts INTEGER DEFAULT 0,
          next_retry_at TEXT,
          error_message TEXT,
          tenant_id TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        INSERT INTO payments (id, order_id, transaction_id, status, amount, method, tenant_id)
        VALUES ('pay_1', 'ord_1', '123456', 'pending', 50000, 'payos', 'tenant_a');
        INSERT INTO orders (id, status, payment_status, payment_method, total, tenant_id)
        VALUES ('ord_1', 'pending', 'pending', 'payos', 50000, 'tenant_b');
        INSERT INTO erpnext_sync_queue (id, entity_type, entity_id, action, payload, status, attempts, tenant_id, created_at)
        VALUES (1, 'order', 'ord_cancelled_b', 'create', '{"status":"cancelled","tenant_id":"tenant_b"}', 'pending', 0, 'tenant_b', '2026-11-05T00:00:00Z');
      `);
      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV({
        'erpnext:tenant_b:api_url': 'https://erp-b.example.com',
        'erpnext:tenant_b:api_key': 'key_b',
        'erpnext:tenant_b:api_secret': 'sec_b',
      });

      // 1) PayOS webhook with payment(tenant_a) != order(tenant_b) -> 409
      const payosKey = 'payos_checksum_secret';
      const dataObj: Record<string, unknown> = {
        orderCode: 123456,
        amount: 50000,
        description: 'Order 1',
        accountNumber: '000111',
        reference: 'REF1',
        transactionDateTime: '2026-11-05 10:00:00',
        currency: 'VND',
        paymentLinkId: 'plink_1',
        code: '00',
        desc: 'success',
      };
      const sortedStr = Object.keys(dataObj)
        .sort()
        .map((k) => `${k}=${dataObj[k]}`)
        .join('&');
      const sig = await computeHmacSha256Hex(payosKey, sortedStr);

      const payosApp = new Hono<{ Bindings: Env }>();
      payosApp.post('/payos', (c) => handlePayosWebhook(c));
      const payosRes = await payosApp.request(
        '/payos',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: '00', desc: 'success', success: true, data: dataObj, signature: sig }),
        },
        { AURA_DB: db, AUTH_KV: kv, PAYOS_CHECKSUM_KEY: payosKey } as unknown as Env
      );
      expect(payosRes.status).toBe(409);
      const payosJson = (await payosRes.json()) as { message: string };
      expect(payosJson.message).toContain('Payment tenant mismatch');

      // 2) processErpnextRetryQueue under '*' resolves tenant_b credentials and marks cancelled order permanently failed scoped to tenant_b
      const queueRes = await processErpnextRetryQueue({ AURA_DB: db, AUTH_KV: kv }, '*');
      expect(queueRes.processed).toBe(1);
      expect(queueRes.failed).toBe(1);
      const qRow = sqlite.prepare('SELECT status, error_message FROM erpnext_sync_queue WHERE id = 1').get() as {
        status: string;
        error_message: string;
      };
      expect(qRow.status).toBe('failed');
      expect(qRow.error_message).toContain('Cannot sync cancelled');
    });
  });

  // =========================================================================
  // Cluster BM2: Analytics, Payout, Subscriptions, Tenants & Reports (5 tests)
  // =========================================================================
  describe('BM2 — Analytics, Payout, Subscriptions, SaaS Tenants, Reports & Audit Logs', () => {
    it('BM2-01: GET /api/analytics/payout includes cash/cod payment_method without double refund subtraction, and resolveAnalyticsTenant blocks cross-tenant X-Store-ID', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          total REAL,
          status TEXT,
          payment_method TEXT,
          payment_status TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        INSERT INTO orders (id, total, status, payment_method, payment_status, tenant_id, created_at) VALUES
          ('o_cash', 100000, 'completed', 'cash', 'paid', 'tenant_a', '2026-11-05T08:00:00Z'),
          ('o_payos', 200000, 'completed', 'payos', 'paid', 'tenant_a', '2026-11-05T09:00:00Z'),
          ('o_refund', 50000, 'refunded', 'payos', 'refunded', 'tenant_a', '2026-11-05T10:00:00Z'),
          ('o_other_tenant', 999999, 'completed', 'cash', 'paid', 'tenant_b', '2026-11-05T11:00:00Z');
      `);
      const db = createSqliteD1(sqlite);
      const ownerTokenA = await signJWT(
        { sub: 'owner_a', id: 'owner_a', role: 'owner', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );

      const app = new Hono<{ Bindings: Env }>();
      registerMetricsHandlers(app);

      const res = await app.request(
        '/payout?from=2026-11-05&to=2026-11-05',
        { method: 'GET', headers: { Authorization: `Bearer ${ownerTokenA}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { cod: number; payos: number; refunded: number; net: number };
      };
      expect(body.data.cod).toBe(100000);
      expect(body.data.payos).toBe(200000);
      expect(body.data.refunded).toBe(50000);
      // Net is cod (100k) + payos (200k) = 300k (refunded order was already excluded from cod/payos sums)
      expect(body.data.net).toBe(300000);

      // Verify resolveAnalyticsTenant blocks X-Store-ID cross-tenant override and normalizes 'hq' -> '*' for HQ admin
      const nonHqCtx = {
        get: (k: string) => (k === 'user' ? { id: 'u1', role: 'owner', tenant_id: 'tenant_a' } : 'tenant_a'),
        req: {
          query: () => undefined,
          header: (k: string) => (k === 'X-Store-ID' ? 'tenant_b' : undefined),
        },
        env: {} as Env,
      };
      expect(resolveAnalyticsTenant(nonHqCtx as never)).toEqual({ tenantId: 'tenant_a', forbidden: true });

      const hqCtx = {
        get: (k: string) => (k === 'user' ? { id: 'hq1', role: 'admin', tenant_id: '*' } : '*'),
        req: {
          query: (k: string) => (k === 'tenant_id' ? 'hq' : undefined),
          header: () => undefined,
        },
        env: {} as Env,
      };
      expect(resolveAnalyticsTenant(hqCtx as never)).toEqual({ tenantId: '*', forbidden: false });
    });

    it('BM2-02: payInvoice advances both current_period_start and current_period_end on renewal, and cancelSubscription blocks cross-tenant overrides with 403', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE subscriptions (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          plan_id TEXT,
          status TEXT,
          billing_cycle TEXT,
          current_period_start TEXT,
          current_period_end TEXT,
          next_billing_date TEXT,
          cancelled_at TEXT,
          tenant_id TEXT,
          updated_at TEXT
        );
        CREATE TABLE subscription_invoices (
          id TEXT PRIMARY KEY,
          subscription_id TEXT,
          customer_id TEXT,
          amount INTEGER,
          amount_vnd INTEGER,
          status TEXT,
          paid_at TEXT,
          payment_method TEXT,
          payment_ref TEXT,
          period_start TEXT,
          period_end TEXT,
          tenant_id TEXT,
          updated_at TEXT
        );
        INSERT INTO subscriptions (id, customer_id, plan_id, status, billing_cycle, current_period_start, current_period_end, tenant_id)
        VALUES ('sub_a', 'cust_a', 'plan_pro', 'past_due', 'monthly', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 'tenant_a');
        INSERT INTO subscription_invoices (id, subscription_id, customer_id, amount, amount_vnd, status, tenant_id)
        VALUES ('inv_a1', 'sub_a', 'cust_a', 199000, 199000, 'paid', 'tenant_a');
        INSERT INTO subscription_invoices (id, subscription_id, customer_id, amount, amount_vnd, status, tenant_id)
        VALUES ('inv_a2', 'sub_a', 'cust_a', 199000, 199000, 'pending', 'tenant_a');
      `);
      const db = createSqliteD1(sqlite);
      const adminTokenA = await signJWT(
        { sub: 'adm_a', id: 'adm_a', role: 'admin', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );
      const custTokenA = await signJWT(
        { sub: 'cust_a', id: 'cust_a', customerId: 'cust_a', role: 'customer', tenant_id: 'tenant_a' },
        JWT_SECRET
      );

      const app = new Hono<{ Bindings: Env }>();
      app.post('/invoices/:id/pay', (c) => payInvoice(c as never));
      app.post('/subscriptions/:id/cancel', (c) => cancelSubscription(c as never));

      const payRes = await app.request(
        '/invoices/inv_a2/pay',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenA}` },
          body: JSON.stringify({ payment_method: 'payos' }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(payRes.status).toBe(200);
      const subRow = sqlite
        .prepare('SELECT status, current_period_start, current_period_end FROM subscriptions WHERE id = ?')
        .get('sub_a') as { status: string; current_period_start: string; current_period_end: string };
      const invRow = sqlite
        .prepare('SELECT status FROM subscription_invoices WHERE id = ?')
        .get('inv_a2') as { status: string };
      expect(invRow.status).toBe('manual');
      // Renewal invoice must advance current_period_start to the previous period end ('2026-11-01') and current_period_end by +1 month ('2026-12-01')
      expect(subRow.current_period_start).toBe('2026-11-01');
      expect(subRow.current_period_end).toBe('2026-12-01');

      // Cross-tenant X-Store-ID override on cancelSubscription -> 403
      const cancelCrossRes = await app.request(
        '/subscriptions/sub_a/cancel',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${custTokenA}`, 'X-Store-ID': 'tenant_b' },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(cancelCrossRes.status).toBe(403);
    });

    it('BM2-03: subscription requireAdmin/requireVendor block default-tenant callers from overriding tenant via X-Store-ID, and updateMRRSnapshot("*") does not overwrite default tenant snapshot', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE subscriptions (id TEXT PRIMARY KEY, plan_id TEXT, status TEXT, billing_cycle TEXT, tenant_id TEXT);
        CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, price INTEGER, tenant_id TEXT);
        CREATE TABLE mrr_snapshots (
          date TEXT PRIMARY KEY,
          mrr INTEGER,
          arr INTEGER,
          active_subscriptions INTEGER,
          churned_subscriptions INTEGER,
          new_subscriptions INTEGER,
          tenant_id TEXT
        );
        INSERT INTO mrr_snapshots (date, mrr, arr, active_subscriptions, churned_subscriptions, new_subscriptions, tenant_id)
        VALUES ('2026-11-05', 500000, 6000000, 5, 0, 1, 'default');
      `);
      const db = createSqliteD1(sqlite);

      // 1) Default-tenant owner passing X-Store-ID: tenant_b is blocked by requireSubAdmin -> 403
      const ownerDefaultToken = await signJWT(
        { sub: 'owner_def', id: 'owner_def', role: 'owner', tenant_id: 'default' },
        JWT_SECRET
      );
      const app = new Hono<{ Bindings: Env }>();
      app.get('/sub-admin', requireSubAdmin, (c) => c.json({ ok: true }));
      app.get('/sub-vendor', requireSubVendor, (c) => c.json({ ok: true }));

      const adminOverrideRes = await app.request(
        '/sub-admin',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${ownerDefaultToken}`, 'X-Store-ID': 'tenant_b' },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(adminOverrideRes.status).toBe(403);

      // 2) Default-tenant customer passing X-Store-ID: tenant_b is blocked by requireSubVendor -> 403
      const custDefaultToken = await signJWT(
        { sub: 'cust_def', id: 'cust_def', role: 'customer', tenant_id: 'default' },
        JWT_SECRET
      );
      const vendorOverrideRes = await app.request(
        '/sub-vendor',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${custDefaultToken}`, 'X-Store-ID': 'tenant_b' },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(vendorOverrideRes.status).toBe(403);

      // 3) updateMRRSnapshot with '*' does not overwrite the 'default' row in mrr_snapshots
      await updateMRRSnapshot(db, '2026-11-05', '*');
      const snap = sqlite.prepare('SELECT mrr FROM mrr_snapshots WHERE date = ?').get('2026-11-05') as { mrr: number };
      expect(snap.mrr).toBe(500000);
    });

    it('BM2-04: saas-tenants GET /my and reports GET /daily-summary reject cross-tenant X-Store-ID and hq overrides with 403', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT, slug TEXT, status TEXT, plan TEXT, owner_email TEXT, created_at TEXT);
        CREATE TABLE tenant_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT, period TEXT, orders_count INTEGER, api_calls INTEGER, storage_mb REAL, staff_count INTEGER);
        INSERT INTO tenants (id, name, slug, status, plan, owner_email, created_at)
        VALUES ('tenant_a', 'Cafe A', 'cafe-a', 'active', 'pro', 'a@example.com', '2026-11-01');
      `);
      const db = createSqliteD1(sqlite);
      const ownerTokenA = await signJWT(
        { sub: 'owner_a', id: 'owner_a', role: 'owner', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );

      // 1) saas-tenants GET /my with X-Store-ID: tenant_b -> 403 even if upstream set c.set('tenantId', 'tenant_a')
      const saasApp = new Hono<{ Bindings: Env }>();
      saasApp.use('*', async (c, next) => {
        c.set('tenantId' as never, 'tenant_a' as never);
        await next();
      });
      saasApp.route('/tenants', createTenantRoutes());

      const myCrossRes = await saasApp.request(
        '/tenants/my',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${ownerTokenA}`, 'X-Store-ID': 'tenant_b' },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(myCrossRes.status).toBe(403);

      // 2) reports GET /daily with X-Store-ID: hq -> 403 for non-HQ manager
      const mgrTokenA = await signJWT(
        { sub: 'mgr_a', id: 'mgr_a', role: 'manager', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );
      const reportsApp = new Hono<{ Bindings: Env }>();
      reportsApp.route('/reports', reportsRouter);

      const repCrossRes = await reportsApp.request(
        '/reports/daily?from=2026-11-05&to=2026-11-05',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${mgrTokenA}`, 'X-Store-ID': 'hq' },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(repCrossRes.status).toBe(403);
    });

    it('BM2-05: admin-sales, admin-metrics, and admin-audit-logs block non-HQ store_id/X-Store-ID overrides (403) and normalize "hq" -> "*" for HQ super-admins', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (id TEXT PRIMARY KEY, total REAL, status TEXT, payment_status TEXT, payment_method TEXT, order_type TEXT, items TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, actor_name TEXT, action TEXT, resource_type TEXT, resource_id TEXT, details TEXT, ip_address TEXT, tenant_id TEXT, created_at TEXT);
        INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, tenant_id, created_at)
        VALUES ('u_a', 'Owner A', 'order.update', 'order', 'o1', 'tenant_a', '2026-11-05T10:00:00Z');
        INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, tenant_id, created_at)
        VALUES ('u_b', 'Owner B', 'order.update', 'order', 'o2', 'tenant_b', '2026-11-05T11:00:00Z');
      `);
      const db = createSqliteD1(sqlite);

      const storeAdminToken = await signJWT(
        { sub: 'adm_a', id: 'adm_a', role: 'admin', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );
      const hqAdminToken = await signJWT(
        { sub: 'hq_1', id: 'hq_1', role: 'admin', tenant_id: '*', tenantId: '*' },
        JWT_SECRET
      );

      // 1) adminSalesRouter blocks store-bound admin passing store_id=tenant_b -> 403
      const salesRes = await adminSalesRouter.request(
        '/csv?store_id=tenant_b',
        { method: 'GET', headers: { Authorization: `Bearer ${storeAdminToken}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(salesRes.status).toBe(403);

      // 2) adminMetricsRouter blocks store-bound admin passing X-Store-ID: hq -> 403
      const metricsRes = await adminMetricsRouter.request(
        '/?range=24h',
        { method: 'GET', headers: { Authorization: `Bearer ${storeAdminToken}`, 'X-Store-ID': 'hq' } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(metricsRes.status).toBe(403);

      // 3) admin-audit-logs blocks store-bound admin with X-Store-ID: tenant_b (403), and allows HQ admin with tenant_id=hq to see all tenants
      const auditApp = new Hono<{ Bindings: Env }>();
      auditApp.use('*', async (c, next) => {
        const hdr = c.req.header('X-Test-Role');
        if (hdr === 'hq') {
          c.set('user' as never, { id: 'hq_1', role: 'admin', tenant_id: '*', tenantId: '*' } as never);
          c.set('tenantId' as never, '*' as never);
        } else {
          c.set('user' as never, { id: 'adm_a', role: 'admin', tenant_id: 'tenant_a', tenantId: 'tenant_a' } as never);
          c.set('tenantId' as never, 'tenant_a' as never);
        }
        await next();
      });
      registerAuditLogQueryHandler(auditApp);

      const auditBlocked = await auditApp.request(
        '/?store_id=tenant_b',
        { method: 'GET' },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(auditBlocked.status).toBe(403);

      const auditHq = await auditApp.request(
        '/?tenant_id=hq',
        { method: 'GET', headers: { 'X-Test-Role': 'hq', Authorization: `Bearer ${hqAdminToken}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(auditHq.status).toBe(200);
      const auditHqBody = (await auditHq.json()) as { rows: Array<{ actor_id: string }> };
      expect(auditHqBody.rows.map((l) => l.actor_id).sort()).toEqual(['u_a', 'u_b']);
    });
  });

  // =========================================================================
  // Cluster BM3: Catalog, Dynamic Pricing, Modifiers, Inventory & Forecasting (5 tests)
  // =========================================================================
  describe('BM3 — Catalog, Dynamic Pricing, Menu Modifiers/Projections, Inventory & Forecasting', () => {
    it('BM3-01: productsRouter POST under HQ wildcard inherits category.tenant_id instead of coercing to default, and unauthenticated catalog reads reject hq/* probes with 403', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT, name_en TEXT, icon TEXT, sort_order INTEGER, active INTEGER, tenant_id TEXT);
        CREATE TABLE products (id TEXT PRIMARY KEY, category_id TEXT, name TEXT, name_en TEXT, slug TEXT, description TEXT, price INTEGER, compare_at_price INTEGER, image_url TEXT, is_available INTEGER DEFAULT 1, available INTEGER DEFAULT 1, featured INTEGER, sort_order INTEGER, tags TEXT, badge TEXT, updated_at TEXT, tenant_id TEXT);
        CREATE TABLE menu_items (id TEXT PRIMARY KEY, category TEXT, name TEXT, price INTEGER, description TEXT, image_url TEXT, tags TEXT, badge TEXT, available INTEGER, tenant_id TEXT, updated_at TEXT);
        INSERT INTO categories (id, name, active, tenant_id) VALUES ('cat_b', 'Matcha B', 1, 'tenant_b');
      `);
      const db = createSqliteD1(sqlite);
      const hqToken = await signJWT({ sub: 'hq_admin', id: 'hq_admin', role: 'admin', tenant_id: '*' }, JWT_SECRET);

      // 1) HQ wildcard POST /products without explicit tenant header inherits 'tenant_b' from cat_b
      const createRes = await productsRouter.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({
            category_id: 'cat_b',
            name: 'Uji Matcha Latte',
            price: 65000,
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(createRes.status).toBe(201);
      const prodRow = sqlite
        .prepare('SELECT tenant_id FROM products WHERE name = ?')
        .get('Uji Matcha Latte') as { tenant_id: string };
      expect(prodRow.tenant_id).toBe('tenant_b');

      // 2) HQ wildcard POST /products with missing category_id and without concrete tenant header -> 400
      const noTenantRes = await productsRouter.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}`, 'X-Tenant-ID': '*' },
          body: JSON.stringify({
            category_id: 'nonexistent_cat',
            name: 'Orphan Item',
            price: 50000,
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(noTenantRes.status).toBe(400);

      // 3) Unauthenticated GET /products and GET /categories with X-Tenant-ID: hq -> 403
      const unauthProdHq = await productsRouter.request(
        '/',
        { method: 'GET', headers: { 'X-Tenant-ID': 'hq' } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(unauthProdHq.status).toBe(403);

      const unauthCatHq = await categoriesRouter.request(
        '/',
        { method: 'GET', headers: { 'X-Store-ID': '*' } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(unauthCatHq.status).toBe(403);
    });

    it('BM3-02: menu-modifiers scopes product link deletions & choice creation by tenant_id, menu-projection guards ON CONFLICT by tenant_id, and pricing-resolver falls back to tenant-scoped menu_items', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE products (id TEXT PRIMARY KEY, category_id TEXT, name TEXT, description TEXT, price INTEGER, image_url TEXT, available INTEGER, featured INTEGER, tenant_id TEXT);
        CREATE TABLE menu_items (id TEXT PRIMARY KEY, category TEXT, name TEXT, price INTEGER, description TEXT, image_url TEXT, tags TEXT, badge TEXT, available INTEGER, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE modifier_groups (id TEXT PRIMARY KEY, name TEXT, min_select INTEGER, max_select INTEGER, required INTEGER, sort_order INTEGER, is_active INTEGER, tenant_id TEXT);
        CREATE TABLE modifier_choices (id TEXT PRIMARY KEY, group_id TEXT, name TEXT, price_delta INTEGER, is_default INTEGER, is_available INTEGER, sort_order INTEGER, tenant_id TEXT);
        CREATE TABLE product_modifier_groups (product_id TEXT, group_id TEXT, sort_order INTEGER, tenant_id TEXT, PRIMARY KEY (product_id, group_id, tenant_id));

        INSERT INTO products (id, category_id, name, price, available, tenant_id) VALUES ('shared_id', 'cat_a', 'Tenant A Product', 90000, 1, 'tenant_a');
        INSERT INTO menu_items (id, category, name, price, available, tenant_id) VALUES ('shared_id', 'cat_b', 'Tenant B Menu Item', 45000, 1, 'tenant_b');
        INSERT INTO modifier_groups (id, name, is_active, tenant_id) VALUES ('grp_a', 'Size A', 1, 'tenant_a');
        INSERT INTO modifier_groups (id, name, is_active, tenant_id) VALUES ('grp_b', 'Size B', 1, 'tenant_b');
        INSERT INTO product_modifier_groups (product_id, group_id, sort_order, tenant_id) VALUES ('shared_id', 'grp_a', 0, 'tenant_a');
        INSERT INTO product_modifier_groups (product_id, group_id, sort_order, tenant_id) VALUES ('shared_id', 'grp_b', 0, 'tenant_b');
      `);
      const db = createSqliteD1(sqlite);
      const tokenA = await signJWT({ sub: 'mgr_a', id: 'mgr_a', role: 'manager', tenant_id: 'tenant_a' }, JWT_SECRET);

      // 1) Tenant A unlinks modifier group for 'shared_id' -> must NOT delete tenant_b's link in product_modifier_groups
      const unlinkRes = await menuModifiersRouter.request(
        '/products/shared_id/groups/grp_a',
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenA}` },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(unlinkRes.status).toBe(200);
      const tenantBLink = sqlite
        .prepare('SELECT group_id FROM product_modifier_groups WHERE product_id = ? AND tenant_id = ?')
        .get('shared_id', 'tenant_b') as { group_id: string } | undefined;
      expect(tenantBLink?.group_id).toBe('grp_b');

      // 2) Tenant A cannot add a choice to tenant_b's modifier group 'grp_b' -> 404
      const crossChoiceRes = await menuModifiersRouter.request(
        '/groups/grp_b/choices',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({ name: 'Hijack Choice', price_delta: 0 }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(crossChoiceRes.status).toBe(404);

      // 3) syncProductToMenuProjection for tenant_a's product with 'shared_id' must NOT overwrite tenant_b's menu_items row
      await syncProductToMenuProjection(db, 'shared_id', 'tenant_a');
      const menuItemB = sqlite.prepare('SELECT name, price, tenant_id FROM menu_items WHERE id = ?').get('shared_id') as {
        name: string;
        price: number;
        tenant_id: string;
      };
      expect(menuItemB.tenant_id).toBe('tenant_b');
      expect(menuItemB.price).toBe(45000);

      // 4) resolveServerProductPrice for 'shared_id' under tenant_b falls back to tenant_b's menu_items (45000) instead of failing on tenant_a's products row
      const priceRes = await resolveServerProductPrice(db, { productId: 'shared_id', tenantId: 'tenant_b' });
      expect(priceRes.available).toBe(true);
      expect(priceRes.unitPriceCents).toBe(45000);
    });

    it('BM3-03: openapi catalog helpers reject non-HQ "hq"/X-Store-ID overrides, and dynamicPricingRouter scopes HQ rule deletion to rowTenant and enforces zero-cost margin floor', async () => {
      const sqlite = new DatabaseSync(':memory:');
      ensureUsersTable(sqlite);
      sqlite.exec(`
        CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, category_id TEXT, price INTEGER, cost_price INTEGER, is_available INTEGER, tenant_id TEXT);
        CREATE TABLE dynamic_pricing_rules (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          name TEXT,
          rule_type TEXT,
          discount_percent REAL,
          target_category TEXT,
          target_product_id TEXT,
          min_margin_percent REAL,
          days_of_week TEXT,
          start_time TEXT,
          end_time TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT
        );
        INSERT INTO products (id, name, category_id, price, cost_price, is_available, tenant_id)
        VALUES ('p_zero_cost', 'Cold Brew', 'cat_a', 100000, 0, 1, 'tenant_a');
        INSERT INTO dynamic_pricing_rules (id, tenant_id, name, rule_type, discount_percent, target_category, target_product_id, min_margin_percent, days_of_week, start_time, end_time, is_active, created_at)
        VALUES ('rule_b_1', 'tenant_b', 'Happy Hour B', 'happy_hour', 50, NULL, NULL, 30, '0,1,2,3,4,5,6', '00:00', '23:59', 1, '2026-11-05'),
               ('rule_a_deep', 'tenant_a', 'Deep Discount A', 'happy_hour', 70, NULL, 'p_zero_cost', 30, '0,1,2,3,4,5,6', '00:00', '23:59', 1, '2026-11-05');
      `);
      const db = createSqliteD1(sqlite);

      // 1) openapi-products & openapi-categories resolveCatalogTenantId block non-HQ 'hq' and X-Store-ID overrides
      const fakeNonHqCtx = {
        get: (k: string) => (k === 'user' ? { id: 'u_a', role: 'owner', tenant_id: 'tenant_a' } : 'tenant_a'),
        req: {
          query: (k: string) => (k === 'tenant_id' ? 'hq' : undefined),
          header: () => undefined,
        },
        env: {} as Env,
      };
      expect(resolveOpenApiProductsTenantId(fakeNonHqCtx as never)).toBe(PRODUCTS_FORBIDDEN_SENTINEL);
      expect(resolveOpenApiCategoriesTenantId(fakeNonHqCtx as never)).toBe(CATEGORIES_FORBIDDEN_SENTINEL);

      // 2) dynamicPricingRouter DELETE /rules/rule_b_1 by HQ super-admin removes rule from dynamic_pricing_rules scoped to tenant_b
      const hqToken = await signJWT({ sub: 'hq_1', id: 'hq_1', role: 'admin', tenant_id: '*', tenantId: '*' }, JWT_SECRET);
      const delRes = await dynamicPricingRouter.request(
        '/rules/rule_b_1',
        { method: 'DELETE', headers: { Authorization: `Bearer ${hqToken}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(delRes.status).toBe(200);
      const remainingB = sqlite.prepare('SELECT id FROM dynamic_pricing_rules WHERE id = ?').get('rule_b_1');
      expect(remainingB).toBeUndefined();

      // 3) dynamicPricingRouter POST /calculate enforces zero-cost margin floor (50k fallback baseline * 1.3 = 65k min price -> 35% max discount -> 65000 instead of 30000)
      const staffAToken = await signJWT({ sub: 'u_a', id: 'u_a', role: 'owner', tenant_id: 'tenant_a', tenantId: 'tenant_a' }, JWT_SECRET);
      const calcRes = await dynamicPricingRouter.request(
        '/calculate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffAToken}`,
            'X-Tenant-ID': 'tenant_a',
          },
          body: JSON.stringify({ items: [{ product_id: 'p_zero_cost', price: 100000, quantity: 1 }] }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(calcRes.status).toBe(200);
      const calcJson = (await calcRes.json()) as {
        data: { items: Array<{ product_id: string; original_price: number; final_price: number }> };
      };
      expect(calcJson.data.items[0].original_price).toBe(100000);
      expect(calcJson.data.items[0].final_price).toBe(65000);
    });

    it('BM3-04: inventoryCRUD POST rejects HQ wildcard without concrete tenant (400), inventoryTransactions GET requires auth (401), and openapi-inventory handlers block cross-tenant X-Store-ID (403)', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, name TEXT, sku TEXT, category TEXT, unit TEXT, current_stock REAL, min_stock REAL, max_stock REAL, reorder_point REAL, unit_cost REAL, is_active INTEGER, tenant_id TEXT);
        CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, tenant_id TEXT, created_at TEXT);
        CREATE TABLE ingredients (id TEXT PRIMARY KEY, code TEXT, name TEXT, unit TEXT, current_stock REAL, min_stock REAL, cost_per_unit INTEGER, is_active INTEGER, tenant_id TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT, is_active INTEGER, tenant_id TEXT, created_at TEXT, updated_at TEXT);
      `);
      const db = createSqliteD1(sqlite);

      // 1) inventoryCRUD POST / under HQ wildcard '*' returns 400
      const invApp = new Hono<{ Bindings: Env }>();
      invApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'hq_1', role: 'admin', tenant_id: '*', tenantId: '*' } as never);
        c.set('tenantId' as never, '*' as never);
        await next();
      });
      inventoryCRUD(invApp as never);
      const wildcardCreateRes = await invApp.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Arabica Beans', sku: 'ARB-1', category: 'coffee', unit: 'kg' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(wildcardCreateRes.status).toBe(400);

      // 2) inventoryTransactions GET /:id/transactions without user returns 401
      const txApp = new Hono<{ Bindings: Env }>();
      inventoryTransactions(txApp as never);
      const unauthTxRes = await txApp.request(
        '/item_1/transactions',
        { method: 'GET' },
        { AURA_DB: db } as unknown as Env
      );
      expect(unauthTxRes.status).toBe(401);

      // 3) openapi-inventory ingredient & supplier handlers block cross-tenant X-Store-ID with 403
      const openApiInvApp = new OpenAPIHono<{ Bindings: Env }>();
      openApiInvApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr_a', role: 'manager', tenant_id: 'tenant_a', tenantId: 'tenant_a' } as never);
        c.set('tenantId' as never, 'tenant_a' as never);
        await next();
      });
      registerIngredientHandlers(openApiInvApp as never);
      registerSupplierHandlers(openApiInvApp as never);

      const ingCrossRes = await openApiInvApp.request(
        '/api/inventory/ingredients',
        { method: 'GET', headers: { 'X-Store-ID': 'tenant_b' } },
        { AURA_DB: db } as unknown as Env
      );
      expect(ingCrossRes.status).toBe(403);

      const supCrossRes = await openApiInvApp.request(
        '/api/inventory/suppliers',
        { method: 'GET', headers: { 'X-Store-ID': 'hq' } },
        { AURA_DB: db } as unknown as Env
      );
      expect(supCrossRes.status).toBe(403);
    });

    it('BM3-05: inventoryForecastingRouter and demandForecastRouter reject cross-tenant X-Store-ID/store_id/hq overrides with 403 and scope data to user tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT, current_stock REAL, min_stock REAL, max_stock REAL, active INTEGER DEFAULT 1, tenant_id TEXT);
        CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, tenant_id TEXT, created_at TEXT);
        CREATE TABLE orders (id TEXT PRIMARY KEY, total REAL, status TEXT, items TEXT, tenant_id TEXT, created_at TEXT);
        INSERT INTO inventory_items (id, sku, name, unit, current_stock, min_stock, max_stock, active, tenant_id)
        VALUES ('ing_a', 'SKU-A', 'Milk A', 'L', 20, 5, 50, 1, 'tenant_a'),
               ('ing_b', 'SKU-B', 'Milk B', 'L', 2, 5, 50, 1, 'tenant_b');
      `);
      const db = createSqliteD1(sqlite);
      const mgrTokenA = await signJWT(
        { sub: 'mgr_a', id: 'mgr_a', role: 'manager', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );

      // 1) inventoryForecastingRouter blocks X-Store-ID: tenant_b -> 403
      const invForecastCross = await inventoryForecastingRouter.request(
        '/run-rate',
        { method: 'GET', headers: { Authorization: `Bearer ${mgrTokenA}`, 'X-Store-ID': 'tenant_b' } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(invForecastCross.status).toBe(403);

      // Scoped inventoryForecastingRouter only returns ing_a
      const invForecastOk = await inventoryForecastingRouter.request(
        '/run-rate',
        { method: 'GET', headers: { Authorization: `Bearer ${mgrTokenA}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(invForecastOk.status).toBe(200);
      const invForecastBody = (await invForecastOk.json()) as { data: Array<{ id: string }> };
      expect(invForecastBody.data.map((f) => f.id)).toEqual(['ing_a']);

      // 2) demandForecastRouter blocks store_id=hq -> 403
      const demandCross = await demandForecastRouter.request(
        '/forecast?store_id=hq',
        { method: 'GET', headers: { Authorization: `Bearer ${mgrTokenA}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(demandCross.status).toBe(403);
    });
  });

  // =========================================================================
  // Cluster BM4: Customer Assistant, DinDin, Check-In, Push, Reviews & Campaigns (5 tests)
  // =========================================================================
  describe('BM4 — Customer Assistant, DinDin, Check-In, Push, Mobile Notifications, Reviews & Campaigns', () => {
    it('BM4-01: customerAssistantRouter requires authentication even when AUTH_KV is bound (401), enforces customer phone/order ownership (403), and blocks cross-tenant overrides (403)', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, loyalty_tier TEXT, loyalty_points INTEGER, total_spent INTEGER, visit_count INTEGER, tenant_id TEXT);
        CREATE TABLE orders (id TEXT PRIMARY KEY, order_number TEXT, status TEXT, order_type TEXT, total INTEGER, payment_status TEXT, items TEXT, customer_id TEXT, customer_phone TEXT, tenant_id TEXT, created_at TEXT);
        INSERT INTO customers (id, name, phone, loyalty_tier, loyalty_points, total_spent, visit_count, tenant_id) VALUES
          ('cust_a1', 'Alice', '0901111111', 'gold', 200, 1000000, 10, 'tenant_a'),
          ('cust_a2', 'Bob', '0902222222', 'silver', 50, 200000, 3, 'tenant_a');
        INSERT INTO orders (id, order_number, status, order_type, total, payment_status, items, customer_id, customer_phone, tenant_id, created_at) VALUES
          ('ord_bob', 'ORD-BOB', 'preparing', 'dine_in', 65000, 'paid', '[]', 'cust_a2', '0902222222', 'tenant_a', '2026-11-05T10:00:00Z');
      `);
      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV();

      const assistantApp = new Hono<{ Bindings: Env }>();
      assistantApp.use('*', optionalAuth());
      assistantApp.route('/', customerAssistantRouter);

      // 1) Unauthenticated order status request with AUTH_KV bound -> 401 (no longer bypassed by Boolean(c.env?.AUTH_KV))
      const unauthRes = await assistantApp.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'Kiểm tra đơn #ord_bob', order_id: 'ord_bob' }),
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(unauthRes.status).toBe(401);

      // 2) Authenticated customer Alice querying Bob's phone or Bob's order_id -> 403
      const aliceToken = await signJWT(
        { sub: 'cust_a1', id: 'cust_a1', customerId: 'cust_a1', phone: '0901111111', role: 'customer', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );
      const crossPhoneRes = await assistantApp.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
          body: JSON.stringify({ query: 'Điểm tích lũy của tôi', phone: '0902222222' }),
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(crossPhoneRes.status).toBe(403);

      const crossOrderRes = await assistantApp.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
          body: JSON.stringify({ query: 'Kiểm tra đơn hàng', order_id: 'ord_bob' }),
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(crossOrderRes.status).toBe(403);

      // 3) Non-HQ staff passing X-Store-ID: tenant_b -> 403
      const staffTokenA = await signJWT(
        { sub: 'staff_a', id: 'staff_a', role: 'staff', tenant_id: 'tenant_a' },
        JWT_SECRET
      );
      const crossTenantRes = await assistantApp.request(
        '/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffTokenA}`,
            'X-Store-ID': 'tenant_b',
          },
          body: JSON.stringify({ query: 'Menu hôm nay' }),
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(crossTenantRes.status).toBe(403);
    });

    it('BM4-02: DinDin blocks default-tenant admin cross-tenant override (403) and inherits ordRow.tenant_id on HQ wildcard print/QC operations', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_name TEXT,
          customer_phone TEXT,
          payment_method TEXT,
          payment_status TEXT,
          items TEXT,
          total INTEGER,
          status TEXT,
          tenant_id TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        INSERT INTO orders (id, customer_name, customer_phone, payment_method, payment_status, items, total, status, tenant_id, created_at)
        VALUES ('DIN_ORD_B1', 'DIN', 'sess_b1', 'cod', 'cod_pending', '[]', 55000, 'pending', 'tenant_b', '2026-11-05T10:00:00Z');
      `);
      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV();
      const storeAdminToken = await signJWT(
        { sub: 'adm_def', id: 'adm_def', role: 'admin', tenantId: 'default', tenant_id: 'default' },
        JWT_SECRET
      );
      const hqAdminToken = await signJWT(
        { sub: 'hq_1', id: 'hq_1', role: 'admin', tenantId: '*', tenant_id: '*' },
        JWT_SECRET
      );

      // 1) Store-bound admin (role: 'admin', tenantId: 'default') passing X-Tenant-ID: tenant_b -> 403
      const dindinApp = new Hono<{ Bindings: Env }>();
      dindinApp.route('/dindin', dindinRouter);

      const overrideRes = await dindinApp.request(
        '/dindin/checkouts',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${storeAdminToken}`, 'X-Tenant-ID': 'tenant_b' },
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(overrideRes.status).toBe(403);

      // 2) HQ super-admin (role: 'admin', tenantId: '*') calling print and qc on DIN_ORD_B1 writes to tenant_b KV keys and updates tenant_b order
      const printRes = await dindinApp.request(
        '/dindin/checkout/DIN_ORD_B1/print',
        { method: 'POST', headers: { Authorization: `Bearer ${hqAdminToken}` } },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(printRes.status).toBe(200);
      expect(kv.store.has('dindin:print:tenant_b:DIN_ORD_B1')).toBe(true);
      expect(kv.store.has('dindin:print:DIN_ORD_B1')).toBe(false);

      const qcRes = await dindinApp.request(
        '/dindin/checkout/DIN_ORD_B1/qc',
        { method: 'POST', headers: { Authorization: `Bearer ${hqAdminToken}` } },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(qcRes.status).toBe(200);
      expect(kv.store.has('dindin:qc:tenant_b:DIN_ORD_B1')).toBe(true);
      const ordAfter = sqlite.prepare('SELECT status FROM orders WHERE id = ?').get('DIN_ORD_B1') as { status: string };
      expect(ordAfter.status).toBe('completed');
    });

    it('BM4-03: checkinRouter masks PII for non-staff, blocks customer approval (403), inherits customer tenant under HQ wildcard, and notifications-mobile blocks non-HQ wildcard', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, loyalty_points INTEGER, tenant_id TEXT);
        CREATE TABLE checkins (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_name TEXT,
          checkin_date TEXT,
          checkin_time TEXT,
          reward_amount INTEGER,
          status TEXT,
          staff_id TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        CREATE TABLE notifications_log (id TEXT PRIMARY KEY, type TEXT, channel TEXT, recipient TEXT, subject TEXT, body TEXT, status TEXT, metadata TEXT, tenant_id TEXT, created_at TEXT);
        INSERT INTO customers (id, name, phone, loyalty_points, tenant_id)
        VALUES ('cust_b1', 'Nguyen Van B', '0987654321', 100, 'tenant_b');
        INSERT INTO checkins (id, customer_id, customer_name, checkin_date, checkin_time, reward_amount, status, tenant_id, created_at)
        VALUES ('CHK_B1', 'cust_b1', 'Nguyen Van B', '2026-11-05', '10:00', 5000, 'pending', 'tenant_b', '2026-11-05T10:00:00Z');
      `);
      const db = createSqliteD1(sqlite);

      const staffTokenB = await signJWT(
        { sub: 'staff_b1', id: 'staff_b1', role: 'staff', tenant_id: 'tenant_b' },
        JWT_SECRET
      );
      const custTokenB = await signJWT(
        { sub: 'cust_b1', id: 'cust_b1', role: 'customer', tenant_id: 'tenant_b' },
        JWT_SECRET
      );
      const hqToken = await signJWT(
        { sub: 'hq_1', id: 'hq_1', role: 'admin', tenant_id: '*' },
        JWT_SECRET
      );

      // 1) Non-manager staff token calling GET /checkins receives masked customer_phone (null)
      const listRes = await checkinRouter.request(
        '/',
        { method: 'GET', headers: { Authorization: `Bearer ${staffTokenB}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as { data: Array<{ customer_name: string; customer_phone: string | null }> };
      expect(listJson.data[0].customer_phone).toBeNull();

      // 2) Customer token calling PATCH /CHK_B1/approve -> 403
      const approveRes = await checkinRouter.request(
        '/CHK_B1/approve',
        { method: 'PATCH', headers: { Authorization: `Bearer ${custTokenB}` } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(approveRes.status).toBe(403);

      // 3) HQ wildcard POST /checkins with customer_id='cust_b1' on a new day inherits 'tenant_b' instead of 'default'
      sqlite.prepare('DELETE FROM checkins WHERE id = ?').run('CHK_B1');
      const hqCheckinRes = await checkinRouter.request(
        '/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({ customer_id: 'cust_b1' }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(hqCheckinRes.status).toBe(201);
      const newChk = sqlite
        .prepare('SELECT tenant_id FROM checkins WHERE customer_id = ?')
        .get('cust_b1') as { tenant_id: string };
      expect(newChk.tenant_id).toBe('tenant_b');

      // 4) getNotifications blocks store-bound admin (role: 'admin', tenantId: 'default') from passing X-Tenant-ID: * -> 403
      const storeAdminToken = await signJWT(
        { sub: 'adm_def', id: 'adm_def', role: 'admin', tenant_id: 'default', tenantId: 'default' },
        JWT_SECRET
      );
      const notifApp = new Hono<{ Bindings: Env }>();
      notifApp.use('*', optionalAuth());
      notifApp.get('/', (c) => getNotifications(c));
      const notifWildcardRes = await notifApp.request(
        '/',
        { method: 'GET', headers: { Authorization: `Bearer ${storeAdminToken}`, 'X-Tenant-ID': '*' } },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(notifWildcardRes.status).toBe(403);
    });

    it('BM4-04: reviewsRouter POST under HQ wildcard inherits orderRow.tenant_id, renderTemplate escapes HTML XSS, and logSend preserves result.tenant_id on wildcard runs', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, customer_id TEXT, tenant_id TEXT);
        CREATE TABLE reviews (id TEXT PRIMARY KEY, order_id TEXT, customer_name TEXT, customer_phone TEXT, rating INTEGER, comment TEXT, food_rating INTEGER, service_rating INTEGER, ambiance_rating INTEGER, status TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE campaign_logs (id TEXT PRIMARY KEY, customer_id TEXT, trigger TEXT, channel TEXT, sent_at TEXT, status TEXT, error TEXT, tenant_id TEXT);
        INSERT INTO orders (id, status, customer_id, tenant_id) VALUES ('ord_rev_b', 'completed', 'cust_b', 'tenant_b');
      `);
      const db = createSqliteD1(sqlite);
      const hqToken = await signJWT(
        { sub: 'hq_1', id: 'hq_1', role: 'admin', tenant_id: '*', tenantId: '*' },
        JWT_SECRET
      );

      // 1) reviewsRouter POST / under HQ wildcard inherits 'tenant_b' from ord_rev_b
      const revApp = new Hono<{ Bindings: Env }>();
      revApp.route('/reviews', reviewsRouter);

      const revRes = await revApp.request(
        '/reviews',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}`, 'X-Tenant-ID': '*' },
          body: JSON.stringify({
            order_id: 'ord_rev_b',
            customer_name: 'Reviewer B',
            rating: 5,
            comment: 'Great!',
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(revRes.status).toBe(201);
      const revRow = sqlite.prepare('SELECT tenant_id FROM reviews WHERE order_id = ?').get('ord_rev_b') as {
        tenant_id: string;
      };
      expect(revRow.tenant_id).toBe('tenant_b');

      // 2) renderTemplate escapes HTML in customer.name
      const tpl = renderTemplate('birthday', {
        name: '<script>alert("xss")</script>',
      });
      expect(tpl.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(tpl.html).not.toContain('<script>');

      // 3) logSend preserves result.tenant_id ('tenant_b') when called under wildcard '*'
      await logSend(
        db,
        {
          customer_id: 'cust_b',
          trigger: 'birthday',
          channel: 'email',
          sent: true,
          tenant_id: 'tenant_b',
        },
        '*'
      );
      const campLog = sqlite.prepare('SELECT tenant_id FROM campaign_logs WHERE customer_id = ?').get('cust_b') as {
        tenant_id: string;
      };
      expect(campLog.tenant_id).toBe('tenant_b');
    });

    it('BM4-05: pushRouter POST /subscribe enforces customer auth & ownership, and chatRouter, recruitmentRouter, and campaignsRouter reject cross-tenant/wildcard overrides', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT);
        CREATE TABLE push_subscriptions (id TEXT PRIMARY KEY, customer_id TEXT, endpoint TEXT UNIQUE, auth_key TEXT, p256dh_key TEXT, user_agent TEXT, role TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, role TEXT, tenant_id TEXT, is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1);
        INSERT INTO customers (id, name, tenant_id) VALUES ('cust_real_a', 'Real Customer A', 'tenant_a');
        INSERT INTO users (id, email, role, tenant_id, is_active, auth_version) VALUES ('mgr_a', 'm@a.com', 'manager', 'tenant_a', 1, 1);
      `);
      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV();

      // 1) pushRouter POST /subscribe for real D1 customer without auth -> 401
      const unauthPushRes = await pushRouter.request(
        '/subscribe',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            customer_id: 'cust_real_a',
            endpoint: 'https://fcm.googleapis.com/fcm/send/sub-token-123456',
            auth_key: 'auth_key_123456',
            p256dh_key: 'p256dh_key_1234567890',
          }),
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(unauthPushRes.status).toBe(401);

      // Authenticated customer with mismatched customer_id -> 403
      const otherCustToken = await signJWT(
        { sub: 'cust_other', id: 'cust_other', customerId: 'cust_other', role: 'customer', tenant_id: 'tenant_a' },
        JWT_SECRET
      );
      const mismatchPushRes = await pushRouter.request(
        '/subscribe',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${otherCustToken}`,
            'X-Tenant-ID': 'tenant_a',
          },
          body: JSON.stringify({
            customer_id: 'cust_real_a',
            endpoint: 'https://fcm.googleapis.com/fcm/send/sub-token-123456',
            auth_key: 'auth_key_123456',
            p256dh_key: 'p256dh_key_1234567890',
          }),
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET } as unknown as Env
      );
      expect(mismatchPushRes.status).toBe(403);

      // 2) chatRouter GET /conversations and recruitmentRouter GET /applications block X-Store-ID cross-tenant override -> 403
      const mgrTokenA = await signJWT(
        { sub: 'mgr_a', id: 'mgr_a', role: 'manager', tenant_id: 'tenant_a', tenantId: 'tenant_a' },
        JWT_SECRET
      );
      const chatCrossRes = await chatRouter.request(
        '/conversations',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${mgrTokenA}`, 'X-Store-ID': 'tenant_b' },
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET, PILOT_TENANT_ID: 'tenant_a' } as unknown as Env
      );
      expect(chatCrossRes.status).toBe(403);

      const recruitCrossRes = await recruitmentRouter.request(
        '/applications',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${mgrTokenA}`, 'X-Store-ID': 'hq' },
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET, PILOT_TENANT_ID: 'tenant_a' } as unknown as Env
      );
      expect(recruitCrossRes.status).toBe(403);

      // 3) campaignsRouter blocks non-HQ X-Store-ID override (403) and blocks HQ wildcard PUT without concrete tenant (400)
      const campCrossRes = await campaignsRouter.request(
        '/',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${mgrTokenA}`, 'X-Store-ID': 'tenant_b' },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(campCrossRes.status).toBe(403);

      const hqToken = await signJWT({ sub: 'hq_1', id: 'hq_1', role: 'admin', tenant_id: '*', tenantId: '*' }, JWT_SECRET);
      const campWildcardPutRes = await campaignsRouter.request(
        '/birthday',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}`, 'X-Tenant-ID': '*' },
          body: JSON.stringify({ is_active: 1, channels: ['sms'] }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(campWildcardPutRes.status).toBe(400);
    });
  });
});
