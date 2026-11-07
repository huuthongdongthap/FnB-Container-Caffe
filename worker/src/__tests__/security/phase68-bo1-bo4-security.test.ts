// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { generateJWT } from '../../lib/jwt';
import { optionalAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';

// BO1 imports
import { posCustomerRouter } from '../../routes/pos-customer';
import { manualReconcilePayment } from '../../routes/payment-reconcile-handlers/manual-reconcile';
import { registerRefundReadHandlers } from '../../routes/refunds-handlers/read-handlers';
import { openApiPaymentsRouter } from '../../routes/openapi-payments-handlers/routes';
import { handleGetOrders, handleGetOrderById } from '../../routes/openapi-orders-handlers/order-read-handlers';
import { handleGetOrderSummary } from '../../routes/openapi-orders-handlers/order-summary-handlers';
import { resolveServerOrderOwnership } from '../../../../packages/domain/customer/policies/order-ownership-policy';
import { handleGuestCheckin } from '../../routes/orders-hono-handlers/guest-handlers';
import { splitOrders } from '../../../../packages/domain/order/commands/split-orders';
import { getOrder } from '../../../../packages/domain/order/queries/get-order';
import { orderStreamRouter } from '../../routes/order-stream';
import { realtimeOrdersRouter } from '../../routes/realtime-orders';

// BO2 imports
import { customersRouter } from '../../routes/customers';
import { birthdayRouter } from '../../routes/birthday';
import { crmRouter } from '../../routes/crm';
import { referralRouter } from '../../routes/referrals';
import { openApiLoyaltyRouter } from '../../routes/openapi-loyalty';
import { handleLookup } from '../../tree/loyalty/lookup-handler';
import { authCustomer, authStaff } from '../../tree/loyalty/auth-middleware';
import { signageRouter } from '../../routes/signage';
import { createWifiRoutes } from '../../routes/wifi';
import { recommendationsRouter } from '../../routes/recommendations';
import { aiBaristaRouter } from '../../routes/ai-barista';

// BO3 imports
import { openApiStaffRouter } from '../../routes/openapi-staff';
import { staffMobileRouter } from '../../routes/staff-mobile';
import { shiftScope } from '../../../../packages/domain/shift/commands/shift-access';
import { clockOut } from '../../../../packages/domain/shift/commands/attendance';
import { updateSchedule } from '../../../../packages/domain/shift/commands/schedules';
import { sopScope } from '../../../../packages/domain/sop/commands/sop-access';
import { openApiCronRouter } from '../../routes/openapi-cron';
import { registerCronAdminRoutes } from '../../routes/cron-admin';
import { checkOverdueOrders, checkInventoryAlerts } from '../../routes/cron-handlers/order-checks';
import { sendCashbackExpiryWarnings } from '../../routes/cron-handlers/cashback-warnings';
import { registerAuthHandlers } from '../../routes/openapi-auth-handlers/auth-handlers';

// BO4 imports
import { createHARouter } from '../../routes/homeassistant/index';
import { toggleDevice } from '../../tree/homeassistant/devices';
import { triggerAutomation } from '../../tree/homeassistant/automations';
import { handleHAWebhook } from '../../tree/homeassistant/presence';
import { createFrigateRoutes } from '../../routes/integrations/frigate';
import { resolveTenantOrganizer } from '../../routes/pretix-handlers/event-handlers';
import { registerWebhookHandler } from '../../routes/pretix-handlers/webhook-handler';
import { validateWebhookSignature } from '../../tree/pretix/hmac-validator';
import { mixpostRouter } from '../../routes/mixpost-handlers/routes';
import { handleMauticBridgeRequest } from '../../tree/mautic/bridge-handler';
import { registerBookingsHandler } from '../../routes/cal-booking-webhook-handlers/bookings-handler';
import { containerTelemetryRouter } from '../../routes/container-telemetry';
import { franchiseRouter } from '../../routes/franchise-locations';
import { adminQRRouter } from '../../routes/admin-qr';
import { getOrdersMobile, createOrderMobile } from '../../routes/orders-mobile';
import { privacyStore } from '../../lib/pilot-privacy-access';

const JWT_SECRET = 'phase68-bo1-bo4-security-secret-key-32chars!';

const activeSqlites = new Set<DatabaseSync>();
const issuedStaffAccounts = new Map<string, { id: string; role: string; tenant_id: string }>();

function ensureUsersTable(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT 'Staff',
      email TEXT,
      phone TEXT DEFAULT '0900000000',
      password_hash TEXT DEFAULT '',
      role TEXT DEFAULT 'staff',
      tenant_id TEXT DEFAULT 'default',
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  for (const colDef of [
    "name TEXT DEFAULT 'Staff'",
    'email TEXT',
    "phone TEXT DEFAULT '0900000000'",
    "password_hash TEXT DEFAULT ''",
    "role TEXT DEFAULT 'staff'",
    "tenant_id TEXT DEFAULT 'default'",
    'is_active INTEGER DEFAULT 1',
    'auth_version INTEGER DEFAULT 1',
    'created_at TEXT',
    'updated_at TEXT',
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
          `INSERT OR REPLACE INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
           VALUES (?, 'Staff', '0900000000', ?, ?, 1, 1)`
        )
        .run(acc.id, acc.role, acc.tenant_id);
    } catch {
      // ignore
    }
  }
}

async function signJWT(payload: Record<string, unknown>, secret = JWT_SECRET): Promise<string> {
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

function createMemoryKV(): { kv: KVNamespace; store: Map<string, string> } {
  const store = new Map<string, string>();
  const kv = {
    get: async (key: string, type?: string) => {
      const v = store.get(key) ?? null;
      if (v === null) return null;
      if (type === 'json') {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      }
      return v;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
  } as unknown as KVNamespace;
  return { kv, store };
}

function buildEnv(db: D1Database, kv?: KVNamespace, extra: Partial<Env> = {}): Env {
  const memKv = kv ?? createMemoryKV().kv;
  return {
    AURA_DB: db,
    JWT_SECRET,
    AUTH_KV: memKv,
    CACHE_KV: memKv,
    RATE_LIMIT_KV: memKv,
    NONCE_KV: memKv,
    ENVIRONMENT: 'test',
    ...extra,
  } as Env;
}

describe('Phase 68 Security Regression Suite (BO1..BO4)', () => {
  describe('Cluster BO1 — POS Customer, Manual Reconcile, Refunds/Payments Read, Orders Read/Summary, Guest Checkin, Split/GetOrder & Realtime Streams', () => {
    it('BO1-01: posCustomerRouter and manualReconcilePayment block default-tenant owner HQ escalation, reject cross-tenant ?store_id overrides, and normalize HQ "hq" -> "*"', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          email TEXT,
          dob TEXT,
          loyalty_tier TEXT DEFAULT 'bronze',
          loyalty_points INTEGER DEFAULT 0,
          total_orders INTEGER DEFAULT 0,
          total_spent REAL DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          balance INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          customer_id TEXT,
          total REAL DEFAULT 0,
          status TEXT DEFAULT 'completed',
          tenant_id TEXT DEFAULT 'store-a',
          payment_status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          transaction_id TEXT,
          status TEXT DEFAULT 'pending',
          refund_status TEXT,
          reconcile_attempts INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE payment_reconcile_jobs (
          payment_id TEXT PRIMARY KEY,
          attempts INTEGER DEFAULT 0
        );
        INSERT INTO customers (id, name, phone, loyalty_tier, loyalty_points, tenant_id)
        VALUES ('cust-b1', 'Customer B', '0912345678', 'gold', 250, 'store-b');
        INSERT INTO orders (id, tenant_id, payment_status)
        VALUES ('ord-rec-b', 'store-b', 'paid');
        INSERT INTO payments (id, order_id, transaction_id, status, tenant_id)
        VALUES ('pay-rec-b', 'ord-rec-b', 'tx-b', 'paid', 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/pos/customer', posCustomerRouter);
      app.use('/api/payments/:id/reconcile-manual', optionalAuth());
      app.post('/api/payments/:id/reconcile-manual', (c) => manualReconcilePayment(c));

      // A 'default'-tenant owner must NOT be treated as HQ super-admin when querying ?tenant_id=store-b
      const defaultOwnerToken = await signJWT({ id: 'owner-def', role: 'owner', tenantId: 'default' });
      const crossPosRes = await app.request(
        '/api/pos/customer?phone=0912345678&tenant_id=store-b',
        { headers: { Authorization: `Bearer ${defaultOwnerToken}` } },
        buildEnv(db)
      );
      expect(crossPosRes.status).toBe(403);

      // Canonical HQ Super-Admin (tenantId: 'hq') is normalized to '*' and can look up store-b customer
      const hqOwnerToken = await signJWT({ id: 'owner-hq', role: 'owner', tenantId: 'hq' });
      const hqPosRes = await app.request(
        '/api/pos/customer?phone=0912345678',
        { headers: { Authorization: `Bearer ${hqOwnerToken}` } },
        buildEnv(db)
      );
      expect(hqPosRes.status).toBe(200);
      const hqPosJson = (await hqPosRes.json()) as { customer: { id: string } | null };
      expect(hqPosJson.customer?.id).toBe('cust-b1');

      // Non-HQ manager with snake_case tenant_id blocked from ?store_id=store-b on manualReconcilePayment
      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenant_id: 'store-a' });
      const crossRecRes = await app.request(
        '/api/payments/pay-rec-b/reconcile-manual?store_id=store-b',
        { method: 'POST', headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossRecRes.status).toBe(403);

      // HQ owner with tenantId='hq' normalized to '*' finds pay-rec-b (already paid -> skipped_already_settled)
      const hqRecRes = await app.request(
        '/api/payments/pay-rec-b/reconcile-manual',
        { method: 'POST', headers: { Authorization: `Bearer ${hqOwnerToken}` } },
        buildEnv(db)
      );
      expect(hqRecRes.status).toBe(200);
      const hqRecJson = (await hqRecRes.json()) as { outcome: string };
      expect(hqRecJson.outcome).toBe('skipped_already_settled');
    });

    it('BO1-02: registerRefundReadHandlers and openApiPaymentsRouter enforce cross-tenant 403, allow waiter/shipper reads, and resolve linked customerId ownership', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_token TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          method TEXT DEFAULT 'cash',
          amount REAL DEFAULT 55000,
          status TEXT DEFAULT 'paid',
          transaction_id TEXT,
          refund_status TEXT,
          refund_amount REAL,
          refund_reason TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE refund_audit_logs (
          id TEXT PRIMARY KEY,
          payment_id TEXT,
          created_at TEXT
        );
        INSERT INTO customers (id, user_id, tenant_id)
        VALUES ('crm-cust-1', 'usr-cust-1', 'store-a');
        INSERT INTO orders (id, customer_id, order_token, tenant_id)
        VALUES ('ord-pay-1', 'crm-cust-1', 'tok-1', 'store-a');
        INSERT INTO payments (id, order_id, method, amount, status, tenant_id)
        VALUES ('pay-1', 'ord-pay-1', 'cash', 55000, 'paid', 'store-a');
      `);

      const app = new Hono<{ Bindings: Env }>();
      registerRefundReadHandlers(app);
      app.route('/', openApiPaymentsRouter);

      const waiterAToken = await signJWT({ id: 'waiter-a', role: 'waiter', tenantId: 'store-a' });
      // Cross-tenant ?store_id=store-b on GET /refunds/:paymentId must return 403
      const crossRefundRes = await app.request(
        '/refunds/pay-1?store_id=store-b',
        { headers: { Authorization: `Bearer ${waiterAToken}` } },
        buildEnv(db)
      );
      expect(crossRefundRes.status).toBe(403);

      // Waiter in store-a can read GET /api/payments/pay-1
      const waiterPayRes = await app.request(
        '/api/payments/pay-1',
        { headers: { Authorization: `Bearer ${waiterAToken}` } },
        buildEnv(db)
      );
      expect(waiterPayRes.status).toBe(200);

      // Customer whose users.id = 'usr-cust-1' is linked to customers.id = 'crm-cust-1' can read their payment by id
      const customerToken = await signJWT({
        id: 'usr-cust-1',
        sub: 'usr-cust-1',
        role: 'customer',
        tenantId: 'store-a',
      });
      const custDetailRes = await app.request(
        '/api/payments/pay-1',
        { headers: { Authorization: `Bearer ${customerToken}` } },
        buildEnv(db)
      );
      expect(custDetailRes.status).toBe(200);
      const custDetailJson = (await custDetailRes.json()) as { data: { id: string } };
      expect(custDetailJson.data.id).toBe('pay-1');
    });

    it('BO1-03: order-read-handlers, order-ownership-policy, and order-summary-handlers support linked customers.id, block cross-tenant staff customer_id, and exclude single-L canceled revenue', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          customer_id TEXT,
          customer_name TEXT DEFAULT 'Guest',
          customer_phone TEXT DEFAULT '0900000000',
          status TEXT DEFAULT 'completed',
          payment_status TEXT DEFAULT 'paid',
          payment_method TEXT DEFAULT 'cash',
          order_type TEXT DEFAULT 'dine_in',
          subtotal REAL DEFAULT 50000,
          total REAL DEFAULT 50000,
          total_amount REAL DEFAULT 50000,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT DEFAULT '2026-11-06T03:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T03:00:00Z'
        );
        CREATE TABLE order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          product_id TEXT,
          name TEXT,
          quantity INTEGER DEFAULT 1,
          price REAL DEFAULT 50000
        );
        INSERT INTO customers (id, user_id, tenant_id) VALUES ('crm-c-a', 'usr-c-a', 'store-a');
        INSERT INTO customers (id, user_id, tenant_id) VALUES ('crm-c-b', 'usr-c-b', 'store-b');
        INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, total_amount, tenant_id)
        VALUES ('ord-a-ok', 'ORD-A1', 'crm-c-a', 'completed', 'paid', 60000, 60000, 'store-a');
        INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, total_amount, tenant_id)
        VALUES ('ord-b-canceled', 'ORD-B1', 'crm-c-b', 'canceled', 'paid', 99000, 99000, 'store-b');
      `);

      // Staff in store-a attempting to attach store-b customer 'crm-c-b' -> stripped to null
      const crossStaffOwnership = await resolveServerOrderOwnership({
        actor: { id: 'staff-a', role: 'waiter', tenantId: 'store-a' },
        clientSuppliedCustomerId: 'crm-c-b',
        db,
        tenantId: 'store-a',
      });
      expect(crossStaffOwnership.customerId).toBeNull();

      // Same-tenant customer 'crm-c-a' is accepted for store-a staff
      const validStaffOwnership = await resolveServerOrderOwnership({
        actor: { id: 'staff-a', role: 'waiter', tenantId: 'store-a' },
        clientSuppliedCustomerId: 'crm-c-a',
        db,
        tenantId: 'store-a',
      });
      expect(validStaffOwnership.customerId).toBe('crm-c-a');

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', optionalAuth());
      app.get('/api/orders', (c) => handleGetOrders(c));
      app.get('/api/orders/summary', (c) => handleGetOrderSummary(c));
      app.get('/api/orders/:id', (c) => handleGetOrderById(c));

      // Customer usr-c-a can read ord-a-ok linked via customers.user_id -> crm-c-a
      const custAToken = await signJWT({ id: 'usr-c-a', role: 'customer', tenantId: 'store-a' });
      const custDetailRes = await app.request(
        '/api/orders/ord-a-ok',
        { headers: { Authorization: `Bearer ${custAToken}` } },
        buildEnv(db)
      );
      expect(custDetailRes.status).toBe(200);

      // HQ owner with tenantId='hq' calling /api/orders/summary normalizes 'hq' -> '*' and excludes 'canceled' order
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const summaryRes = await app.request(
        '/api/orders/summary',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(summaryRes.status).toBe(200);
      const summaryJson = (await summaryRes.json()) as {
        data: { totalOrders: number; totalRevenue: number; averageOrderValue: number };
      };
      expect(summaryJson.data.totalOrders).toBe(2);
      expect(summaryJson.data.totalRevenue).toBe(60000);
      expect(summaryJson.data.averageOrderValue).toBe(60000);
    });

    it('BO1-04: guest-checkin handles lowercase available status & tenant KV keys, splitOrders supports HQ wildcard + Idempotency-Key, and getOrder scopes payments by order.tenant_id', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const { kv, store } = createMemoryKV();

      sqlite.exec(`
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT,
          qr_code_token TEXT,
          capacity INTEGER DEFAULT 4,
          zone TEXT DEFAULT 'indoor',
          status TEXT DEFAULT 'available',
          current_order_id TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          updated_at TEXT
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT,
          price REAL DEFAULT 30000,
          is_available INTEGER DEFAULT 1,
          available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          table_id TEXT,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          customer_address TEXT,
          items TEXT,
          subtotal REAL DEFAULT 60000,
          shipping_fee REAL DEFAULT 0,
          discount REAL DEFAULT 0,
          tax REAL DEFAULT 0,
          tip REAL DEFAULT 0,
          total REAL DEFAULT 60000,
          total_amount REAL DEFAULT 60000,
          order_type TEXT DEFAULT 'dine_in',
          payment_method TEXT DEFAULT 'cod',
          payment_status TEXT DEFAULT 'pending',
          status TEXT DEFAULT 'pending',
          notes TEXT,
          delivery_time TEXT,
          order_token TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          amount REAL,
          status TEXT,
          tenant_id TEXT
        );
        INSERT INTO cafe_tables (id, table_number, qr_code_token, status, tenant_id)
        VALUES ('tbl-b1', 'B01', 'qr-tok-b01', 'available', 'store-b');
        INSERT INTO products (id, name, price, is_available, available, tenant_id)
        VALUES ('prod-b1', 'Cà Phê Sữa', 30000, 1, 1, 'store-b');
        INSERT INTO orders (id, order_number, table_id, customer_name, customer_phone, items, subtotal, total, total_amount, order_token, tenant_id)
        VALUES (
          'ord-parent-b',
          'ORD-PB1',
          'tbl-b1',
          'Khách B',
          '0911222333',
          '[{"id":"prod-b1","name":"Cà Phê Sữa","price":30000,"qty":2,"quantity":2}]',
          60000,
          60000,
          60000,
          'tok-ord-pb1',
          'store-b'
        );
        INSERT INTO payments (id, order_id, amount, status, tenant_id)
        VALUES ('pay-legit-b', 'ord-parent-b', 60000, 'paid', 'store-b');
        INSERT INTO payments (id, order_id, amount, status, tenant_id)
        VALUES ('pay-spoof-a', 'ord-parent-b', 999999, 'paid', 'store-a');
      `);

      const guestApp = new Hono<{ Bindings: Env }>();
      guestApp.post('/guest-checkin', (c) => handleGuestCheckin(c));

      const checkinRes = await guestApp.request(
        '/guest-checkin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Store-ID': 'store-b' },
          body: JSON.stringify({
            table_id: 'B01',
            customer_name: 'Khách QR B',
            customer_phone: '0911222333',
          }),
        },
        buildEnv(db, kv)
      );
      expect(checkinRes.status).toBe(201);
      expect(store.has('latest_order_ts:store-b')).toBe(true);

      // Reset table status so splitOrders can run under HQ wildcard '*' with Idempotency-Key
      sqlite.prepare("UPDATE cafe_tables SET status = 'Available' WHERE id = 'tbl-b1'").run();
      const splitPayload = {
        table_id: 'B01',
        parent_order_id: 'ord-parent-b',
        orders: [
          {
            customer_name: 'Khách 1',
            customer_phone: '0911222331',
            payment_method: 'cod',
            items: [{ id: 'prod-b1', name: 'Cà Phê Sữa', price: 30000, quantity: 1 }],
          },
          {
            customer_name: 'Khách 2',
            customer_phone: '0911222332',
            payment_method: 'cod',
            items: [{ id: 'prod-b1', name: 'Cà Phê Sữa', price: 30000, quantity: 1 }],
          },
        ],
      };
      const envObj = buildEnv(db, kv) as unknown as Record<string, unknown>;
      const splitReq1 = new Request('http://localhost/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-split-b1' },
        body: JSON.stringify(splitPayload),
      });
      const splitRes1 = await splitOrders(splitReq1, envObj, undefined, {
        id: 'hq-owner',
        role: 'owner',
        tenantId: '*',
      });
      expect(splitRes1.status).toBe(201);
      const splitJson1 = (await splitRes1.json()) as {
        orders: Array<{ id: string }>;
        replayed?: boolean;
      };
      expect(splitJson1.orders).toHaveLength(2);

      // Verify child orders inherited store-b from parent/table (not '*')
      const childTenantRow = sqlite
        .prepare('SELECT tenant_id FROM orders WHERE id = ?')
        .get(splitJson1.orders[0].id) as { tenant_id: string };
      expect(childTenantRow.tenant_id).toBe('store-b');

      // Retry with same Idempotency-Key replays cached response without creating extra orders
      const splitReq2 = new Request('http://localhost/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-split-b1' },
        body: JSON.stringify(splitPayload),
      });
      const splitRes2 = await splitOrders(splitReq2, envObj, undefined, {
        id: 'hq-owner',
        role: 'owner',
        tenantId: '*',
      });
      expect(splitRes2.status).toBe(200);
      const splitJson2 = (await splitRes2.json()) as {
        orders: Array<{ id: string }>;
        replayed?: boolean;
      };
      expect(splitJson2.replayed).toBe(true);
      expect(splitJson2.orders[0].id).toBe(splitJson1.orders[0].id);

      // getOrder with HQ 'hq' tenantId normalizes to '*' and scopes payments to store-b only
      const getOrderReq = new Request('http://localhost/api/orders/ord-parent-b');
      const getOrderRes = await getOrder(getOrderReq, envObj, 'ord-parent-b', 'hq', {
        id: 'hq-owner',
        role: 'owner',
        tenantId: 'hq',
      });
      expect(getOrderRes.status).toBe(200);
      const getOrderJson = (await getOrderRes.json()) as {
        order: { payments: Array<{ id: string }> };
      };
      expect(getOrderJson.order.payments.map((p) => p.id)).toEqual(['pay-legit-b']);
    });

    it('BO1-05: orderStreamRouter and realtimeOrdersRouter block cross-tenant ?store_id/X-Store-ID, allow linked customerId SSE, and fail-closed 401 on invalid WS token', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT DEFAULT 'ORD-S1',
          status TEXT DEFAULT 'completed',
          table_id TEXT,
          total REAL DEFAULT 45000,
          items TEXT DEFAULT '[]',
          customer_id TEXT,
          order_token TEXT DEFAULT 'stream-tok-1',
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        INSERT INTO customers (id, user_id, tenant_id) VALUES ('crm-stream-1', 'usr-stream-1', 'store-a');
        INSERT INTO orders (id, status, customer_id, order_token, tenant_id)
        VALUES ('ord-stream-1', 'completed', 'crm-stream-1', 'stream-tok-1', 'store-a');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.use('/api/orders/*', optionalAuth());
      app.route('/api/orders', orderStreamRouter);
      app.route('/ws', realtimeOrdersRouter);

      const staffAToken = await signJWT({ id: 'staff-a', role: 'waiter', tenantId: 'store-a' });
      // Non-HQ staff passing ?store_id=store-b on SSE stream must receive 403
      const crossSseRes = await app.request(
        '/api/orders/ord-stream-1/events?store_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(crossSseRes.status).toBe(403);

      // Customer linked via customers.user_id can open SSE stream on completed order
      const custToken = await signJWT({ id: 'usr-stream-1', role: 'customer', tenantId: 'store-a' });
      const custSseRes = await app.request(
        '/api/orders/ord-stream-1/events',
        { headers: { Authorization: `Bearer ${custToken}` } },
        buildEnv(db)
      );
      expect(custSseRes.status).toBe(200);

      // Explicit invalid token on /ws/orders must fail-closed with 401 (never silently fall back to guest)
      const invalidWsRes = await app.request(
        '/ws/orders?token=invalid.jwt.token',
        { headers: { Upgrade: 'websocket' } },
        buildEnv(db)
      );
      expect(invalidWsRes.status).toBe(401);

      // Non-HQ staff passing X-Store-ID: store-b on /ws/orders must receive 403
      const crossWsRes = await app.request(
        '/ws/orders',
        {
          headers: {
            Upgrade: 'websocket',
            Authorization: `Bearer ${staffAToken}`,
            'X-Store-ID': 'store-b',
          },
        },
        buildEnv(db)
      );
      expect(crossWsRes.status).toBe(403);
    });
  });

  describe('Cluster BO2 — Customers Admin/Profile, Birthday, CRM, Referrals, OpenAPI Loyalty, Loyalty Tree, Signage, WiFi, Recommendations & AI Barista', () => {
    it('BO2-01: customersRouter and birthdayRouter block default-tenant owner HQ escalation, reject cross-tenant ?store_id overrides, and normalize HQ "hq" -> "*"', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT,
          phone TEXT,
          email TEXT,
          dob TEXT DEFAULT '1995-11-06',
          birthday TEXT DEFAULT '1995-11-06',
          segment TEXT DEFAULT 'regular',
          loyalty_tier TEXT DEFAULT 'bronze',
          loyalty_points INTEGER DEFAULT 100,
          total_spent REAL DEFAULT 200000,
          total_orders INTEGER DEFAULT 4,
          visit_count INTEGER DEFAULT 4,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-01-01T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        INSERT INTO customers (id, user_id, name, phone, tenant_id)
        VALUES ('cust-b-admin', 'usr-b-admin', 'Customer Store B', '0988777666', 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/customers', customersRouter);
      app.route('/api/birthday', birthdayRouter);

      // 'default'-tenant owner attempting ?tenant_id=* or ?store_id=store-b on /api/customers must get 403
      const defaultOwnerToken = await signJWT({ id: 'owner-def', role: 'owner', tenantId: 'default' });
      const defWildcardRes = await app.request(
        '/api/customers?tenant_id=*',
        { headers: { Authorization: `Bearer ${defaultOwnerToken}` } },
        buildEnv(db)
      );
      expect(defWildcardRes.status).toBe(403);

      const defCrossBirthdayRes = await app.request(
        '/api/birthday/config?store_id=store-b',
        { headers: { Authorization: `Bearer ${defaultOwnerToken}` } },
        buildEnv(db)
      );
      expect(defCrossBirthdayRes.status).toBe(403);

      // Canonical HQ owner (tenantId: 'hq') is normalized to '*' and sees store-b customers
      const hqOwnerToken = await signJWT({ id: 'owner-hq', role: 'owner', tenantId: 'hq' });
      const hqCustRes = await app.request(
        '/api/customers',
        { headers: { Authorization: `Bearer ${hqOwnerToken}` } },
        buildEnv(db)
      );
      expect(hqCustRes.status).toBe(200);
      const hqCustJson = (await hqCustRes.json()) as { customers: Array<{ id: string }> };
      expect(hqCustJson.customers.map((c) => c.id)).toContain('cust-b-admin');
    });

    it('BO2-02: crmRouter and referralRouter enforce cross-tenant 403 on ?store_id/X-Store-ID, accept customerId claim, and prevent duplicate referral times_used inflation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT,
          phone TEXT,
          referral_code TEXT,
          referred_by TEXT,
          loyalty_points INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE referral_codes (
          code TEXT PRIMARY KEY,
          customer_id TEXT,
          times_used INTEGER DEFAULT 0,
          bonus_points INTEGER DEFAULT 100,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE referrals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          referrer_id TEXT,
          referred_id TEXT,
          referral_code TEXT,
          status TEXT DEFAULT 'pending',
          bonus_awarded INTEGER DEFAULT 0,
          bonus_type TEXT DEFAULT 'cashback',
          cashback_awarded_vnd INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        INSERT INTO customers (id, user_id, name, phone, referral_code, tenant_id)
        VALUES ('cust-ref-owner', 'usr-ref-owner', 'Referrer A', '0901111222', 'AURA-REFA1', 'store-a');
        INSERT INTO customers (id, user_id, name, phone, tenant_id)
        VALUES ('cust-referee', 'usr-referee', 'Referee A', '0903333444', 'store-a');
        INSERT INTO referral_codes (code, customer_id, times_used, is_active, tenant_id)
        VALUES ('AURA-REFA1', 'cust-ref-owner', 1, 1, 'store-a');
        INSERT INTO referrals (referrer_id, referred_id, referral_code, status, tenant_id)
        VALUES ('cust-ref-owner', 'cust-referee', 'AURA-REFA1', 'pending', 'store-a');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/crm', crmRouter);
      app.route('/api/referrals', referralRouter);

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossCrmRes = await app.request(
        '/api/crm/segments?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossCrmRes.status).toBe(403);

      // Customer token for cust-ref-owner can access /api/crm/customers/cust-ref-owner/referral
      const custLinkedToken = await signJWT({
        id: 'cust-ref-owner',
        sub: 'cust-ref-owner',
        customerId: 'cust-ref-owner',
        role: 'customer',
        tenantId: 'store-a',
      });
      const crmRefRes = await app.request(
        '/api/crm/customers/cust-ref-owner/referral',
        { headers: { Authorization: `Bearer ${custLinkedToken}` } },
        buildEnv(db)
      );
      expect(crmRefRes.status).toBe(200);

      // Duplicate POST /api/referrals/apply for cust-referee must return 409 and NOT increment referral_codes.times_used
      const refereeToken = await signJWT({
        id: 'cust-referee',
        sub: 'cust-referee',
        role: 'customer',
        tenantId: 'store-a',
      });
      const dupApplyRes = await app.request(
        '/api/referrals/apply',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refereeToken}`,
            'X-Store-ID': 'store-a',
          },
          body: JSON.stringify({ code: 'AURA-REFA1', customer_id: 'cust-referee' }),
        },
        buildEnv(db)
      );
      expect(dupApplyRes.status).toBe(409);

      const codeRow = sqlite
        .prepare('SELECT times_used FROM referral_codes WHERE code = ?')
        .get('AURA-REFA1') as { times_used: number };
      expect(codeRow.times_used).toBe(1);
    });

    it('BO2-03: openApiLoyaltyRouter normalizes HQ "hq" -> "*", scopes PATCH /rewards/:id by existing.tenant_id, and rejects nonexistent orderId on /rewards/redeem with 404', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT,
          loyalty_points INTEGER DEFAULT 500,
          lifetime_points INTEGER DEFAULT 500,
          loyalty_tier TEXT DEFAULT 'gold',
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE loyalty_accounts (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          points INTEGER DEFAULT 500,
          lifetime_points INTEGER DEFAULT 500,
          tier_id TEXT DEFAULT 'gold',
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE loyalty_rewards (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          points_cost INTEGER DEFAULT 100,
          type TEXT DEFAULT 'voucher',
          value REAL DEFAULT 20000,
          min_tier TEXT,
          max_redemptions INTEGER,
          current_redemptions INTEGER DEFAULT 0,
          valid_from TEXT,
          valid_to TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          tenant_id TEXT DEFAULT 'store-b'
        );
        INSERT INTO customers (id, user_id, name, loyalty_points, loyalty_tier, tenant_id)
        VALUES ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Cust B', 500, 'gold', 'store-b');
        INSERT INTO loyalty_accounts (id, customer_id, points, lifetime_points, tier_id, tenant_id)
        VALUES ('la-b1', '11111111-1111-4111-8111-111111111111', 500, 500, 'gold', 'store-b');
        INSERT INTO loyalty_rewards (id, name, points_cost, type, value, is_active, tenant_id)
        VALUES ('22222222-2222-4222-8222-222222222222', 'Voucher 20k', 100, 'discount', 20000, 1, 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/', openApiLoyaltyRouter);

      // HQ owner with tenantId='hq' calling PATCH /api/loyalty/rewards/:id updates store-b reward preserving tenant_id='store-b'
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const patchRes = await app.request(
        '/api/loyalty/rewards/22222222-2222-4222-8222-222222222222',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({ name: 'Voucher 25k Updated' }),
        },
        buildEnv(db)
      );
      expect(patchRes.status).toBe(200);
      const rewardAfter = sqlite
        .prepare('SELECT name, tenant_id FROM loyalty_rewards WHERE id = ?')
        .get('22222222-2222-4222-8222-222222222222') as { name: string; tenant_id: string };
      expect(rewardAfter.name).toBe('Voucher 25k Updated');
      expect(rewardAfter.tenant_id).toBe('store-b');

      // Redeeming reward with nonexistent orderId must return 404 without deducting points
      const custToken = await signJWT({
        id: '11111111-1111-4111-8111-111111111111',
        sub: '11111111-1111-4111-8111-111111111111',
        role: 'customer',
        tenantId: 'store-b',
      });
      const redeemMissingOrderRes = await app.request(
        '/api/loyalty/rewards/redeem',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${custToken}`,
            'X-Store-ID': 'store-b',
          },
          body: JSON.stringify({
            rewardId: '22222222-2222-4222-8222-222222222222',
            orderId: '99999999-9999-4999-8999-999999999999',
          }),
        },
        buildEnv(db)
      );
      expect(redeemMissingOrderRes.status).toBe(404);

      const acctPoints = sqlite
        .prepare('SELECT points FROM loyalty_accounts WHERE id = ?')
        .get('la-b1') as { points: number };
      expect(acctPoints.points).toBe(500);
    });

    it('BO2-04: Loyalty tree handleLookup & authCustomer/authStaff allow non-default store staff, accept customerId claim, and block cross-tenant ?store_id overrides', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          email TEXT,
          name TEXT,
          phone TEXT,
          loyalty_tier TEXT DEFAULT 'silver',
          loyalty_points INTEGER DEFAULT 120,
          lifetime_points INTEGER DEFAULT 200,
          total_spent REAL DEFAULT 300000,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          balance INTEGER DEFAULT 15000,
          lifetime_earned INTEGER DEFAULT 20000,
          lifetime_spent INTEGER DEFAULT 5000,
          total_earned INTEGER DEFAULT 20000,
          total_spent INTEGER DEFAULT 5000,
          tenant_id TEXT DEFAULT 'store-b',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE cashback_transactions (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          type TEXT,
          amount INTEGER,
          expires_at TEXT,
          expired INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE loyalty_tiers (
          tier_name TEXT,
          min_points INTEGER,
          cashback_rate REAL,
          tenant_id TEXT DEFAULT 'store-b'
        );
        INSERT INTO customers (id, user_id, email, name, phone, loyalty_tier, loyalty_points, lifetime_points, tenant_id)
        VALUES ('cust-tree-b', 'usr-tree-b', 'treeb@aura.vn', 'Tree Customer B', '0933444555', 'silver', 120, 200, 'store-b');
        INSERT INTO cashback_wallets (id, customer_id, balance, tenant_id)
        VALUES ('cbw-tree-b', 'cust-tree-b', 15000, 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.get('/api/loyalty/lookup', (c) => handleLookup(c));
      app.get('/api/loyalty/customer/:customerId', authCustomer, (c) => c.json({ ok: true }));
      app.get('/api/loyalty/staff-only', authStaff, (c) => c.json({ ok: true }));

      // Store-b cashier can look up store-b customer by phone (previously blocked when resolvePilotStore defaulted to 'default')
      const cashierBToken = await signJWT({ id: 'cashier-b', role: 'cashier', tenantId: 'store-b' });
      const lookupRes = await app.request(
        '/api/loyalty/lookup?phone=0933444555',
        { headers: { Authorization: `Bearer ${cashierBToken}` } },
        buildEnv(db)
      );
      expect(lookupRes.status).toBe(200);
      const lookupJson = (await lookupRes.json()) as {
        ok: boolean;
        data: { customer_id: string; wallet_balance: number } | null;
      };
      expect(lookupJson.ok).toBe(true);
      expect(lookupJson.data?.customer_id).toBe('cust-tree-b');

      // Store-b cashier passing ?store_id=store-a must be rejected with 403
      const crossLookupRes = await app.request(
        '/api/loyalty/lookup?phone=0933444555&store_id=store-a',
        { headers: { Authorization: `Bearer ${cashierBToken}` } },
        buildEnv(db)
      );
      expect(crossLookupRes.status).toBe(403);

      // Customer token with sub='usr-tree-b' and customerId='cust-tree-b' passes authCustomer for :customerId='cust-tree-b'
      const custLinkedToken = await signJWT({
        id: 'usr-tree-b',
        sub: 'usr-tree-b',
        customerId: 'cust-tree-b',
        role: 'customer',
        tenantId: 'store-b',
      });
      const custAuthRes = await app.request(
        '/api/loyalty/customer/cust-tree-b',
        { headers: { Authorization: `Bearer ${custLinkedToken}`, 'X-Store-ID': 'store-b' } },
        buildEnv(db)
      );
      expect(custAuthRes.status).toBe(200);

      // Staff passing cross-tenant X-Store-ID on authStaff must receive 403
      const crossStaffRes = await app.request(
        '/api/loyalty/staff-only',
        { headers: { Authorization: `Bearer ${cashierBToken}`, 'X-Store-ID': 'store-a' } },
        buildEnv(db)
      );
      expect(crossStaffRes.status).toBe(403);
    });

    it('BO2-05: signageRouter, wifiRouter, recommendationsRouter, and aiBaristaRouter block cross-tenant ?store_id/X-Store-ID and reject "hq" voucher writes', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          category_id TEXT,
          name TEXT,
          price REAL DEFAULT 35000,
          is_available INTEGER DEFAULT 1,
          available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-a'
        );
        CREATE TABLE wifi_vouchers (
          id TEXT PRIMARY KEY,
          code TEXT,
          order_id TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          expires_at TEXT,
          created_at TEXT
        );
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/signage', signageRouter);
      app.route('/api/wifi', createWifiRoutes());
      app.route('/api/recommendations', recommendationsRouter);
      app.route('/api/ai-barista', aiBaristaRouter);

      const staffAToken = await signJWT({ id: 'staff-a', role: 'staff', tenantId: 'store-a' });

      // Signage blocks non-HQ staff passing X-Tenant-ID: store-b
      const crossSignageRes = await app.request(
        '/api/signage/menu',
        { headers: { Authorization: `Bearer ${staffAToken}`, 'X-Tenant-ID': 'store-b' } },
        buildEnv(db)
      );
      expect(crossSignageRes.status).toBe(403);

      // WiFi blocks non-HQ staff passing ?store_id=store-b
      const crossWifiRes = await app.request(
        '/api/wifi/status?mac=AA:BB:CC:DD:EE:FF&store_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(crossWifiRes.status).toBe(403);

      // HQ owner attempting to authorize a WiFi override under 'hq' without a concrete store is rejected with 400
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const hqWifiVoucherRes = await app.request(
        '/api/wifi/authorize',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hqToken}`,
            'X-Tenant-ID': 'hq',
          },
          body: JSON.stringify({ mac: 'AA:BB:CC:DD:EE:FF', action: 'grant', duration_seconds: 3600 }),
        },
        buildEnv(db)
      );
      expect(hqWifiVoucherRes.status).toBe(400);

      // Recommendations & AI Barista block non-HQ staff passing X-Store-ID: store-b
      const crossRecRes = await app.request(
        '/api/recommendations/pairings?product_id=p1',
        { headers: { Authorization: `Bearer ${staffAToken}`, 'X-Store-ID': 'store-b' } },
        buildEnv(db)
      );
      expect(crossRecRes.status).toBe(403);

      const crossBaristaRes = await app.request(
        '/api/ai-barista/recommend',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffAToken}`,
            'X-Store-ID': 'store-b',
          },
          body: JSON.stringify({ prompt: 'Cho tôi một ly cà phê tỉnh táo' }),
        },
        buildEnv(db)
      );
      expect(crossBaristaRes.status).toBe(403);
    });
  });

  describe('Cluster BO3 — OpenAPI Staff/Shifts/Attendance, Staff Mobile, Shift Domain, SOP Access, Cron & OpenAPI Auth', () => {
    it('BO3-01: openApiStaffRouter blocks default-tenant owner wildcard escalation, restricts PATCH fallback, and blocks ?store_id overrides on shifts/attendance', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        INSERT INTO users (id, name, email, phone, role, tenant_id, is_active, auth_version)
        VALUES ('44444444-4444-4444-8444-444444444444', 'Staff B', 'staffb@aura.vn', '0977888999', 'waiter', 'store-b', 1, 1);
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/', openApiStaffRouter);

      // 'default'-tenant owner attempting ?tenant_id=* on GET /api/staff must be rejected with 403
      const defaultOwnerToken = await signJWT({ id: 'owner-def', role: 'owner', tenantId: 'default' });
      const defWildcardRes = await app.request(
        '/api/staff?tenant_id=*',
        { headers: { Authorization: `Bearer ${defaultOwnerToken}` } },
        buildEnv(db)
      );
      expect(defWildcardRes.status).toBe(403);

      // Non-HQ manager in store-a attempting PATCH on store-b staff must get 404 (no unscoped fallback)
      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossPatchRes = await app.request(
        '/api/staff/44444444-4444-4444-8444-444444444444',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrAToken}` },
          body: JSON.stringify({ name: 'Hijacked' }),
        },
        buildEnv(db)
      );
      expect([403, 404]).toContain(crossPatchRes.status);

      // Shift & attendance handlers reject ?store_id=store-b for store-a manager with 403
      const crossShiftRes = await app.request(
        '/api/staff/shifts?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossShiftRes.status).toBe(403);

      const crossAttendanceRes = await app.request(
        '/api/staff/attendance?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossAttendanceRes.status).toBe(403);
    });

    it('BO3-02: staffMobileRouter blocks cross-tenant ?store_id/X-Store-ID overrides and registerStaffDevice/revokeStaffDevice record audit_logs', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE staff_devices (
          id TEXT PRIMARY KEY,
          staff_id TEXT,
          device_name TEXT,
          device_token TEXT UNIQUE,
          pin_hash TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT,
          updated_at TEXT,
          last_used_at TEXT
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT,
          entity_type TEXT,
          entity_id TEXT,
          metadata TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/staff-mobile', staffMobileRouter);

      const ownerAToken = await signJWT({ id: 'owner-mob-a', role: 'owner', tenantId: 'store-a' });
      await signJWT({ id: 'waiter-mob-a', role: 'waiter', tenantId: 'store-a' });

      const crossDevicesRes = await app.request(
        '/api/staff-mobile/devices?store_id=store-b',
        { headers: { Authorization: `Bearer ${ownerAToken}` } },
        buildEnv(db)
      );
      expect(crossDevicesRes.status).toBe(403);

      const regRes = await app.request(
        '/api/staff-mobile/devices/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
          body: JSON.stringify({
            device_token: 'dev-token-mob-001',
            device_name: 'iPad POS A',
            staff_id: 'waiter-mob-a',
            pin: '1234',
          }),
        },
        buildEnv(db)
      );
      expect([200, 201]).toContain(regRes.status);

      const devRow = sqlite
        .prepare('SELECT id FROM staff_devices WHERE device_token = ?')
        .get('dev-token-mob-001') as { id: string };
      expect(devRow?.id).toBeTruthy();

      const revokeRes = await app.request(
        `/api/staff-mobile/devices/${devRow.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${ownerAToken}` },
        },
        buildEnv(db)
      );
      expect(revokeRes.status).toBe(200);

      const auditActions = sqlite
        .prepare("SELECT action, tenant_id FROM audit_logs WHERE entity_type = 'staff_device' ORDER BY created_at ASC")
        .all() as Array<{ action: string; tenant_id: string }>;
      expect(auditActions.map((a) => a.action)).toEqual([
        'staff_device_register',
        'staff_device_revoke',
      ]);
      expect(auditActions[0].tenant_id).toBe('store-a');
    });

    it('BO3-03: clockOut validates staff ownership, updateSchedule blocks cross-tenant locationId under "*", and sopScope blocks X-Store-ID mismatch & defaults HQ to pilot store', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE staff_shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT DEFAULT 'store-a',
          staff_id TEXT,
          staff_name TEXT,
          role TEXT DEFAULT 'barista',
          date TEXT DEFAULT '2026-11-06',
          shift TEXT DEFAULT 'morning',
          start_time TEXT DEFAULT '07:00',
          end_time TEXT DEFAULT '15:00',
          clock_in TEXT,
          clock_out TEXT,
          hours_worked REAL,
          attendance_state TEXT DEFAULT 'scheduled',
          notes TEXT,
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
      `);
      await signJWT({ id: 'staff-a1', role: 'waiter', tenantId: 'store-a' });
      await signJWT({ id: 'staff-a2', role: 'waiter', tenantId: 'store-a' });
      await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });

      sqlite
        .prepare(
          `INSERT INTO staff_shifts (id, tenant_id, staff_id, staff_name, role, date, start_time, end_time, clock_in, attendance_state)
           VALUES (1, 'store-a', 'staff-a1', 'Staff A1', 'waiter', '2026-11-06', '07:00', '15:00', '2026-11-06T07:00:00Z', 'active')`
        )
        .run();

      const envObj = buildEnv(db);

      // Staff A2 attempting to clockOut attendance id '1' (which belongs to staff-a1) must be rejected with 409
      await expect(
        clockOut(
          {
            env: envObj,
            tenantId: 'store-a',
            actor: { id: 'staff-a2', role: 'waiter', tenant_id: 'store-a', is_active: 1, auth_version: 1 },
            canManage: false,
          },
          'staff-a2',
          undefined,
          '1'
        )
      ).rejects.toMatchObject({ status: 409 });

      // HQ owner (tenantId: '*') attempting to move shift 1 (store-a) to locationId='store-b' in updateSchedule must fail with 403
      await expect(
        updateSchedule(
          {
            env: envObj,
            tenantId: '*',
            actor: { id: 'hq-owner', role: 'owner', tenant_id: 'hq', is_active: 1, auth_version: 1 },
            canManage: true,
          },
          '1',
          { locationId: 'store-b', notes: 'Try cross-tenant move' }
        )
      ).rejects.toMatchObject({ status: 403 });

      // shiftScope blocks non-HQ staff passing X-Store-ID: store-b with 403
      await expect(
        shiftScope({
          env: envObj,
          get: (k: string) => (k === 'user' ? { id: 'staff-a1', role: 'waiter', tenantId: 'store-a' } : undefined),
          req: {
            query: () => undefined,
            header: (k: string) => (k === 'X-Store-ID' ? 'store-b' : undefined),
          },
        } as never)
      ).rejects.toMatchObject({ status: 403 });

      // sopScope blocks non-HQ staff passing X-Store-ID: store-b with 403 and defaults HQ to pilot store 'default'
      await expect(
        sopScope({
          env: envObj,
          get: (k: string) => (k === 'user' ? { id: 'staff-a1', role: 'waiter', tenantId: 'store-a' } : undefined),
          req: {
            query: () => undefined,
            header: (k: string) => (k === 'X-Store-ID' ? 'store-b' : undefined),
          },
        } as never)
      ).rejects.toMatchObject({ status: 403 });

      const hqSop = await sopScope({
        env: envObj,
        get: (k: string) => (k === 'user' ? { id: 'hq-owner', role: 'owner', tenantId: 'hq' } : undefined),
        req: { query: () => undefined, header: () => undefined },
      } as never);
      expect(hqSop.tenantId).toBe('default');
    });

    it('BO3-04: openApiCronRouter, cronAdminRouter, checkOverdueOrders, checkInventoryAlerts, and sendCashbackExpiryWarnings enforce tenant isolation and per-row wildcard updates', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE cron_jobs (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          schedule TEXT DEFAULT '*/5 * * * *',
          handler TEXT DEFAULT 'order_checks',
          is_active INTEGER DEFAULT 1,
          last_run_at TEXT,
          next_run_at TEXT,
          last_status TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE cron_runs (
          id TEXT PRIMARY KEY,
          job_id TEXT,
          status TEXT DEFAULT 'failed',
          started_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          completed_at TEXT,
          duration_ms INTEGER DEFAULT 10,
          output TEXT,
          error TEXT,
          triggered_by TEXT DEFAULT 'manual',
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_name TEXT DEFAULT 'Guest',
          status TEXT DEFAULT 'pending',
          notes TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-01T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-01T00:00:00Z'
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          zalo_opt_out INTEGER DEFAULT 0,
          last_expiry_warning_at TEXT,
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE cashback_transactions (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          type TEXT DEFAULT 'earn',
          amount INTEGER DEFAULT 15000,
          expires_at TEXT,
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          balance INTEGER DEFAULT 15000,
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE metrics_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT,
          payload TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        INSERT INTO cron_jobs (id, name, schedule, handler, is_active, tenant_id)
        VALUES ('33333333-3333-4333-8333-333333333333', 'Overdue Check B', '*/5 * * * *', 'order_checks', 1, 'store-b');
        INSERT INTO orders (id, customer_name, status, notes, tenant_id, created_at)
        VALUES ('ord-overdue-b', 'Khách Trễ B', 'pending', 'Gấp', 'store-b', '2026-11-01T00:00:00Z');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/', openApiCronRouter);
      registerCronAdminRoutes(app);

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossOpenApiCronRes = await app.request(
        '/api/cron/jobs?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossOpenApiCronRes.status).toBe(403);

      const defaultOwnerToken = await signJWT({ id: 'owner-def', role: 'owner', tenantId: 'default' });
      const crossAdminCronRes = await app.request(
        '/api/test/telegram-sim?store_id=store-b',
        { method: 'POST', headers: { Authorization: `Bearer ${defaultOwnerToken}` } },
        buildEnv(db)
      );
      expect(crossAdminCronRes.status).toBe(403);

      // HQ owner triggering store-b cron job under 'hq' normalizes 'hq' -> '*' and writes cron_runs with tenant_id='store-b'
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const triggerRes = await app.request(
        '/api/cron/jobs/33333333-3333-4333-8333-333333333333/trigger',
        { method: 'POST', headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(triggerRes.status).toBe(201);
      const runRow = sqlite
        .prepare('SELECT tenant_id FROM cron_runs WHERE job_id = ?')
        .get('33333333-3333-4333-8333-333333333333') as { tenant_id: string };
      expect(runRow.tenant_id).toBe('store-b');

      // checkOverdueOrders with 'hq' override normalizes to '*' and marks ord-overdue-b [OVERDUE] under store-b
      await checkOverdueOrders(buildEnv(db) as unknown as Record<string, unknown>, 'hq');
      const overdueOrd = sqlite
        .prepare('SELECT notes FROM orders WHERE id = ?')
        .get('ord-overdue-b') as { notes: string };
      expect(overdueOrd.notes).toContain('[OVERDUE]');

      // checkInventoryAlerts and sendCashbackExpiryWarnings with 'hq' override complete cleanly without error
      await checkInventoryAlerts(buildEnv(db) as unknown as Record<string, unknown>, 'hq');
      await sendCashbackExpiryWarnings(buildEnv(db) as unknown as Record<string, unknown>, 'hq');
    });

    it('BO3-05: OpenAPI Auth register/login/me reject "hq"/"*" registration, scope customer email uniqueness by tenant, and include tenantId in user payloads', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE user_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          access_token TEXT,
          refresh_token TEXT,
          user_agent TEXT,
          ip_address TEXT,
          expires_at TEXT,
          created_at TEXT
        );
        CREATE TABLE staff_login_identities (
          staff_id TEXT PRIMARY KEY,
          email TEXT
        );
      `);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      registerAuthHandlers(app);

      // Registering with X-Tenant-ID: hq must be rejected with 403
      const hqRegRes = await app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'hq' },
          body: JSON.stringify({
            email: 'cust@aura.vn',
            password: 'Password123!',
            name: 'Cust HQ',
          }),
        },
        buildEnv(db)
      );
      expect(hqRegRes.status).toBe(403);

      // Register customer in store-a -> returns 201 with user.tenantId = 'store-a'
      const regARes = await app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Store-ID': 'store-a' },
          body: JSON.stringify({
            email: 'same@aura.vn',
            password: 'Password123!',
            name: 'Cust Store A',
          }),
        },
        buildEnv(db)
      );
      expect(regARes.status).toBe(201);
      const regAJson = (await regARes.json()) as {
        data: { user: { id: string; tenantId: string }; accessToken: string };
      };
      expect(regAJson.data.user.tenantId).toBe('store-a');

      // Registering the same customer email in store-b is allowed (scoped per store tenant) and returns tenantId = 'store-b'
      const regBRes = await app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Store-ID': 'store-b' },
          body: JSON.stringify({
            email: 'same@aura.vn',
            password: 'Password123!',
            name: 'Cust Store B',
          }),
        },
        buildEnv(db)
      );
      expect(regBRes.status).toBe(201);
      const regBJson = (await regBRes.json()) as {
        data: { user: { id: string; tenantId: string } };
      };
      expect(regBJson.data.user.tenantId).toBe('store-b');

      // GET /api/auth/me returns user.tenantId = 'store-a'
      const meRes = await app.request(
        '/api/auth/me',
        { headers: { Authorization: `Bearer ${regAJson.data.accessToken}` } },
        buildEnv(db)
      );
      expect(meRes.status).toBe(200);
      const meJson = (await meRes.json()) as { data: { tenantId: string } };
      expect(meJson.data.tenantId).toBe('store-a');
    });
  });

  describe('Cluster BO4 — Home Assistant, Frigate, Pretix, Mixpost, Mautic, Cal.com, Telemetry, Franchise, Admin QR, Mobile Orders & Privacy Store', () => {
    it('BO4-01: createHARouter, toggleDevice, triggerAutomation, and handleHAWebhook block ?store_id/X-Store-ID overrides, normalize HQ "hq" -> "*", and inherit/preserve entity tenant_id', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE ha_device_states (
          entity_id TEXT PRIMARY KEY,
          state TEXT,
          attributes TEXT,
          last_changed TEXT,
          last_updated TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE ha_automation_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          automation_id TEXT,
          trigger_entity TEXT,
          payload TEXT,
          result TEXT,
          executed_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated, tenant_id)
        VALUES ('light.patio_b', 'off', '{"brightness":80}', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z', 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/ha', createHARouter());

      const staffAToken = await signJWT({ id: 'staff-a', role: 'staff', tenantId: 'store-a' });
      const crossHaRes = await app.request(
        '/api/ha/devices?store_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(crossHaRes.status).toBe(403);

      // HQ owner (tenantId: 'hq') toggling light.patio_b normalizes 'hq' -> '*' and updates store-b row
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const toggleRes = await app.request(
        '/api/ha/devices/light.patio_b/toggle',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({ action: 'on' }),
        },
        buildEnv(db)
      );
      expect(toggleRes.status).toBe(200);
      const devState = sqlite
        .prepare('SELECT state, tenant_id FROM ha_device_states WHERE entity_id = ?')
        .get('light.patio_b') as { state: string; tenant_id: string };
      expect(devState.state).toBe('on');
      expect(devState.tenant_id).toBe('store-b');

      // triggerAutomation under '*' inherits 'store-b' from trigger_entity='light.patio_b'
      const trigRes = await triggerAutomation(
        buildEnv(db) as unknown as Record<string, unknown>,
        'evening_scene',
        { trigger_entity: 'light.patio_b' },
        '*'
      );
      expect(trigRes.status).toBe(200);
      const logRow = sqlite
        .prepare('SELECT tenant_id FROM ha_automation_log WHERE automation_id = ?')
        .get('evening_scene') as { tenant_id: string };
      expect(logRow.tenant_id).toBe('store-b');

      // handleHAWebhook with default tenant preserves tenant_id='default'
      const whRes = await handleHAWebhook(
        buildEnv(db) as unknown as Record<string, unknown>,
        { entity_id: 'sensor.temp_def', state: '24.5' },
        'default'
      );
      expect(whRes.success).toBe(true);
      const defEntity = sqlite
        .prepare('SELECT tenant_id FROM ha_device_states WHERE entity_id = ?')
        .get('sensor.temp_def') as { tenant_id: string };
      expect(defEntity.tenant_id).toBe('default');
    });

    it('BO4-02: createFrigateRoutes, Pretix resolveTenantOrganizer, and Pretix webhook-handler block ?store_id/X-Store-ID/"hq" overrides and enforce PRETIX_WEBHOOK_TENANT', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

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
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE pretix_webhook_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notification_id INTEGER,
          organizer TEXT,
          event TEXT,
          code TEXT,
          action TEXT,
          tenant_id TEXT DEFAULT 'default',
          received_at TEXT
        );
        INSERT INTO frigate_events (id, camera, label, start_time, received_at, tenant_id)
        VALUES ('fevt-b1', 'cam_b', 'person', 1700000000, '2026-11-06T00:00:00Z', 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/integrations/frigate', createFrigateRoutes());
      const pretixApp = new Hono<{ Bindings: Env }>();
      registerWebhookHandler(pretixApp as unknown as Hono);

      const staffAToken = await signJWT({ id: 'staff-a', role: 'staff', tenantId: 'store-a' });
      const crossFrigateRes = await app.request(
        '/api/integrations/frigate/events?store_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(crossFrigateRes.status).toBe(403);

      // HQ owner passing ?tenant_id=* on POST /events/sync is rejected with 400 (concrete store required)
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const wildcardSyncRes = await app.request(
        '/api/integrations/frigate/events/sync?tenant_id=*',
        { method: 'POST', headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(wildcardSyncRes.status).toBe(400);

      // HQ owner reading GET /events with tenantId='hq' normalizes to '*' and returns fevt-b1
      const hqEventsRes = await app.request(
        '/api/integrations/frigate/events',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(hqEventsRes.status).toBe(200);
      const hqEventsJson = (await hqEventsRes.json()) as { events: Array<{ id: string }> };
      expect(hqEventsJson.events.map((e) => e.id)).toContain('fevt-b1');

      // Pretix resolveTenantOrganizer blocks non-HQ staff passing ?store_id=store-b with 403
      const fakeCtx = {
        req: {
          query: (k: string) => (k === 'store_id' ? 'store-b' : undefined),
          header: () => undefined,
        },
        get: (k: string) => (k === 'user' ? { id: 'staff-a', role: 'staff', tenantId: 'store-a' } : undefined),
      } as unknown as import('hono').Context;
      const orgResult = resolveTenantOrganizer(fakeCtx, { PRETIX_ORGANIZER: 'auracafe' } as never);
      expect(orgResult).toEqual({
        ok: false,
        status: 403,
        error: 'Cross-tenant organizer override denied',
      });

      // Pretix webhook rejects X-Tenant-ID: hq with 400 and mismatched PRETIX_WEBHOOK_TENANT with 403
      const whPayload = JSON.stringify({
        notification_id: 101,
        organizer: 'auracafe',
        event: 'tasting',
        code: 'ORD123',
        action: 'pretix.event.order.paid',
      });
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode('pretix-sec-123'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(whPayload));
      const sigHex = Array.from(new Uint8Array(sigBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      expect(await validateWebhookSignature(whPayload, sigHex, 'pretix-sec-123')).toBe(true);

      const hqWhRes = await pretixApp.request(
        '/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-pretix-Signature': sigHex,
            'X-Tenant-ID': 'hq',
          },
          body: whPayload,
        },
        buildEnv(db, undefined, { PRETIX_WEBHOOK_SECRET: 'pretix-sec-123' } as Partial<Env>)
      );
      expect(hqWhRes.status).toBe(400);

      const mismatchWhRes = await pretixApp.request(
        '/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-pretix-Signature': sigHex,
            'X-Tenant-ID': 'store-b',
          },
          body: whPayload,
        },
        buildEnv(db, undefined, {
          PRETIX_WEBHOOK_SECRET: 'pretix-sec-123',
          PRETIX_WEBHOOK_TENANT: 'store-a',
        } as unknown as Partial<Env>)
      );
      expect(mismatchWhRes.status).toBe(403);
    });

    it('BO4-03: mixpostRouter and handleMauticBridgeRequest block ?store_id/X-Store-ID/"hq" overrides, enforce Mixpost auth, and normalize HQ "hq" -> "*"', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          percent INTEGER DEFAULT 25,
          tenant_id TEXT DEFAULT 'store-b'
        );
        INSERT INTO promotions (id, code, percent, tenant_id)
        VALUES ('promo-mp-b', 'SUMMERB25', 25, 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/mixpost', mixpostRouter as unknown as Hono<{ Bindings: Env }>);

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossMixpostRes = await app.request(
        '/api/mixpost/posts?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossMixpostRes.status).toBe(403);

      // Invalid Authorization header on POST /api/mixpost/posts returns 401
      const unauthPostRes = await app.request(
        '/api/mixpost/posts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid.jwt.tok' },
          body: JSON.stringify({ content: 'Hello', accounts: [1] }),
        },
        buildEnv(db)
      );
      expect(unauthPostRes.status).toBe(401);

      // HQ owner with tenantId='hq' calling POST /api/mixpost/generate normalizes 'hq' -> '*' and finds store-b promotion
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const genRes = await app.request(
        '/api/mixpost/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({ source: 'promotion', id: 'SUMMERB25' }),
        },
        buildEnv(db)
      );
      expect(genRes.status).toBe(200);

      // Mautic bridge blocks cross-tenant ?store_id=store-b when resolvedTenantId is 'store-a'
      const mauticCrossReq = new Request('http://localhost/api/mautic-bridge/status?store_id=store-b', {
        method: 'GET',
      });
      const mauticCrossRes = await handleMauticBridgeRequest(
        mauticCrossReq,
        buildEnv(db) as never,
        'store-a'
      );
      expect(mauticCrossRes.status).toBe(403);

      // Mautic bridge blocks ?store_id=hq when resolvedTenantId is 'store-a'
      const mauticHqReq = new Request('http://localhost/api/mautic-bridge/status?store_id=hq', {
        method: 'GET',
      });
      const mauticHqRes = await handleMauticBridgeRequest(
        mauticHqReq,
        buildEnv(db) as never,
        'store-a'
      );
      expect(mauticHqRes.status).toBe(403);
    });

    it('BO4-04: Cal.com bookings-handler and containerTelemetryRouter block ?store_id/X-Store-ID/"hq" overrides, reject "hq" heartbeat writes, and normalize HQ "hq" -> "*"', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE reservations (
          id TEXT PRIMARY KEY,
          cal_booking_uid TEXT,
          customer_name TEXT,
          customer_email TEXT,
          customer_phone TEXT,
          date TEXT DEFAULT '2026-11-06',
          time TEXT DEFAULT '10:00',
          reservation_time TEXT DEFAULT '2026-11-06T10:00:00Z',
          status TEXT DEFAULT 'confirmed',
          special_requests TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE container_telemetry_logs (
          id TEXT PRIMARY KEY,
          container_id TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          power_source TEXT DEFAULT 'grid',
          battery_percentage INTEGER DEFAULT 100,
          ambient_temp_celsius REAL DEFAULT 25.0,
          water_tank_level_pct INTEGER DEFAULT 90,
          wastewater_tank_pct INTEGER DEFAULT 10,
          esp32_online INTEGER DEFAULT 1,
          pos_online INTEGER DEFAULT 1,
          kds_online INTEGER DEFAULT 1,
          network_type TEXT DEFAULT 'fiber',
          signal_strength_dbm INTEGER DEFAULT -55,
          alert_status TEXT DEFAULT 'NORMAL',
          alert_message TEXT,
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        INSERT INTO reservations (id, cal_booking_uid, customer_name, status, tenant_id)
        VALUES ('res-cal-b1', 'cal-uid-b1', 'Cal Guest B', 'confirmed', 'store-b');
        INSERT INTO container_telemetry_logs (id, container_id, tenant_id, power_source, ambient_temp_celsius, kds_online, alert_status, created_at)
        VALUES ('tlog-b1', 'AURA-CT-B1', 'store-b', 'grid', 25.5, 1, 'NORMAL', '2026-11-06T00:00:00Z');
      `);

      const app = new Hono<{ Bindings: Env }>();
      registerBookingsHandler(app);
      app.route('/api/edge', containerTelemetryRouter);

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossBookingsRes = await app.request(
        '/bookings?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossBookingsRes.status).toBe(403);

      const crossTelemetryRes = await app.request(
        '/api/edge/containers/status?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossTelemetryRes.status).toBe(403);

      // HQ owner attempting POST /api/edge/telemetry/heartbeat with ?tenant_id=hq is rejected with 400
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const hqHeartbeatRes = await app.request(
        '/api/edge/telemetry/heartbeat?tenant_id=hq',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({
            container_id: 'AURA-CT-B1',
            power_source: 'grid',
            ambient_temp_celsius: 26.0,
            kds_online: true,
          }),
        },
        buildEnv(db)
      );
      expect(hqHeartbeatRes.status).toBe(400);

      // HQ owner calling GET /bookings and GET /api/edge/containers/status with tenantId='hq' normalizes to '*' and sees store-b data
      const hqBookingsRes = await app.request(
        '/bookings',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(hqBookingsRes.status).toBe(200);
      const hqBookingsJson = (await hqBookingsRes.json()) as { data: Array<{ id: string }> };
      expect(hqBookingsJson.data.map((b) => b.id)).toContain('res-cal-b1');

      const hqStatusRes = await app.request(
        '/api/edge/containers/status',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(hqStatusRes.status).toBe(200);
      const hqStatusJson = (await hqStatusRes.json()) as {
        data: Array<{ container_id: string }>;
      };
      expect(hqStatusJson.data.map((c) => c.container_id)).toContain('AURA-CT-B1');
    });

    it('BO4-05: franchiseRouter, adminQRRouter, orders-mobile, and privacyStore block ?store_id/X-Store-ID/"hq" overrides, disallow "hq" franchise creation, and inherit table tenant in createOrderMobile', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE franchise_locations (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          code TEXT,
          name TEXT,
          address TEXT,
          city TEXT,
          phone TEXT,
          royalty_percentage REAL DEFAULT 5,
          status TEXT DEFAULT 'active'
        );
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT,
          zone TEXT DEFAULT 'indoor',
          capacity INTEGER DEFAULT 4,
          status TEXT DEFAULT 'available',
          qr_code_token TEXT,
          current_order_id TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          updated_at TEXT
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT,
          price REAL DEFAULT 35000,
          is_available INTEGER DEFAULT 1,
          available INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-b'
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          table_id TEXT,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          customer_address TEXT,
          items TEXT,
          subtotal REAL DEFAULT 35000,
          shipping_fee REAL DEFAULT 0,
          discount REAL DEFAULT 0,
          tax REAL DEFAULT 0,
          tip REAL DEFAULT 0,
          tip_amount REAL DEFAULT 0,
          service_fee REAL DEFAULT 0,
          total REAL DEFAULT 35000,
          total_amount REAL DEFAULT 35000,
          order_type TEXT DEFAULT 'dine_in',
          payment_method TEXT DEFAULT 'cod',
          payment_status TEXT DEFAULT 'pending',
          status TEXT DEFAULT 'pending',
          notes TEXT,
          delivery_time TEXT,
          order_token TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z',
          updated_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          product_id TEXT,
          quantity INTEGER DEFAULT 1,
          subtotal REAL DEFAULT 35000,
          modifiers TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT DEFAULT '2026-11-06T00:00:00Z'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          method TEXT,
          amount REAL,
          status TEXT,
          tenant_id TEXT DEFAULT 'store-b',
          created_at TEXT,
          updated_at TEXT
        );
        INSERT INTO cafe_tables (id, table_number, status, tenant_id)
        VALUES ('tbl-mob-b', 'MB01', 'Available', 'store-b');
        INSERT INTO products (id, name, price, is_available, available, tenant_id)
        VALUES ('prod-mob-b', 'Trà Đào', 35000, 1, 1, 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/franchise', franchiseRouter);
      app.route('/api/admin/qr', adminQRRouter);
      app.use('/mobile/*', optionalAuth());
      app.get('/mobile/orders', (c) => getOrdersMobile(c));
      app.post('/mobile/orders', (c) => createOrderMobile(c));
      app.get('/privacy-check', (c) => {
        const res = privacyStore(c);
        if (res instanceof Response) return res;
        return c.json({ tenantId: res });
      });

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossFranchiseRes = await app.request(
        '/api/franchise/locations?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossFranchiseRes.status).toBe(403);

      const crossQrRes = await app.request(
        '/api/admin/qr/tables?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db, undefined, { QR_SIGNING_SECRET: 'qr-secret-key-32-characters-long!' } as Partial<Env>)
      );
      expect(crossQrRes.status).toBe(403);

      // HQ owner attempting to register a franchise location with tenant_id='hq' is rejected with 400
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const hqCreateLocRes = await app.request(
        '/api/franchise/locations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({ code: 'HQ01', name: 'Invalid HQ Loc', tenant_id: 'hq' }),
        },
        buildEnv(db)
      );
      expect(hqCreateLocRes.status).toBe(400);

      // HQ owner creating a mobile order on table tbl-mob-b (store-b) inherits tenant_id='store-b'
      const mobCreateRes = await app.request(
        '/mobile/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hqToken}` },
          body: JSON.stringify({
            table_id: 'tbl-mob-b',
            table_number: 'MB01',
            items: [{ id: 'prod-mob-b', name: 'Trà Đào', price: 35000, quantity: 1 }],
          }),
        },
        buildEnv(db)
      );
      expect(mobCreateRes.status).toBe(201);
      const mobCreateJson = (await mobCreateRes.json()) as { order_id: string };
      const createdMobOrd = sqlite
        .prepare('SELECT tenant_id FROM orders WHERE id = ?')
        .get(mobCreateJson.order_id) as { tenant_id: string };
      expect(createdMobOrd.tenant_id).toBe('store-b');

      // privacyStore rejects ?store_id=store-b override even when user belongs to pilot store 'default'
      const defStaffToken = await signJWT({ id: 'staff-def', role: 'staff', tenantId: 'default' });
      const privacyCrossRes = await app.request(
        '/privacy-check?store_id=store-b',
        { headers: { Authorization: `Bearer ${defStaffToken}` } },
        buildEnv(db)
      );
      expect(privacyCrossRes.status).toBe(403);
    });
  });
});
