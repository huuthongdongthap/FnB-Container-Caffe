// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { toUser } from '../../middleware/auth';
import { rateLimitMiddleware } from '../../middleware/rate-limit';
import { changePassword } from '../../tree/auth/change-password';
import { registerPasswordHandlers } from '../../routes/openapi-auth-handlers/password-handlers';
import { registerDeviceHandlers } from '../../routes/openapi-auth-handlers/device-handlers';
import { registerStaffDevice, revokeStaffDevice } from '../../../../packages/domain/staff/commands/staff-auth';
import { hashPassword, generateJWT } from '../../lib/jwt';
import {
  hasPaymentTenantMismatch,
  resolvePaymentTenantScope,
} from '../../../../packages/domain/payment/policies/payment-access';
import { registerPaymentMutationHandlers } from '../../routes/openapi-payments-handlers/mutation-handlers';
import { handleRefund } from '../../routes/refunds-handlers/mutation-handlers';
import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import { payInvoice } from '../../tree/subscriptions/invoice-handlers';
import {
  extractRequestedShiftTenant,
  shiftScope,
  shiftTarget,
  ShiftContractError,
} from '../../../../packages/domain/shift/commands/shift-access';
import { createSchedule, updateSchedule } from '../../../../packages/domain/shift/commands/schedules';
import { clockIn, clockOut } from '../../../../packages/domain/shift/commands/attendance';
import { getShift, listShifts } from '../../../../packages/domain/shift/commands/shift-repository';
import { registerShiftHandlers } from '../../routes/openapi-staff-handlers/shift-handlers';
import { registerAttendanceHandlers } from '../../routes/openapi-staff-handlers/attendance-handlers';
import { registerStaffHandlers as registerStaffCrudHandlers } from '../../routes/openapi-staff-handlers/staff-handlers';
import { consumeKdsStream } from '../../../../src/hooks/kds-stream';

const JWT_SECRET = 'phase65-bl1-bl4-test-jwt-secret-key-2026';

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
        if (colName) return (row[colName] as T) ?? null;
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

function createMemoryKV(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const kv = {
    store,
    get: vi.fn(async (key: string, type?: string) => {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      if (type === 'json') {
        return JSON.parse(val);
      }
      return val;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return kv as unknown as KVNamespace & { store: Map<string, string> };
}

describe('Phase 65 Security & Operational Regression Suite (BL1-BL4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cluster BL1: Auth Version Monotonicity, Session Revocation & Rate-Limit Bypass Hardening', () => {
    it('BL1-01: preserves authVersion in toUser() and monotonically increments D1 + KV auth_version on password change even when reqUser.authVersion is stale', async () => {
      const mapped = toUser({
        id: 'usr_1',
        email: 'user1@aura.vn',
        role: 'customer',
        name: 'User One',
        tenantId: 'store-a',
        authVersion: 7,
      });
      expect(mapped.authVersion).toBe(7);

      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          role TEXT,
          password_hash TEXT,
          tenant_id TEXT DEFAULT 'default',
          auth_version INTEGER DEFAULT 1,
          updated_at TEXT
        );
      `);
      const oldHash = await hashPassword('OldPass123!');
      sqlite
        .prepare(
          "INSERT INTO users (id, email, name, role, password_hash, tenant_id, auth_version) VALUES ('usr_1', 'user1@aura.vn', 'User One', 'customer', ?, 'store-a', 5)"
        )
        .run(oldHash);

      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV({
        'user:user1@aura.vn': JSON.stringify({
          id: 'usr_1',
          email: 'user1@aura.vn',
          role: 'customer',
          tenant_id: 'store-a',
          password: oldHash,
          auth_version: 1,
        }),
        'user:usr_1': JSON.stringify({
          id: 'usr_1',
          email: 'user1@aura.vn',
          role: 'customer',
          tenant_id: 'store-a',
          password: oldHash,
          auth_version: 1,
        }),
      });

      const token = await generateJWT(
        {
          id: 'usr_1',
          sub: 'usr_1',
          email: 'user1@aura.vn',
          role: 'customer',
          name: 'User One',
          tenantId: 'store-a',
          authVersion: 1,
        },
        JWT_SECRET,
        3600
      );

      const req = new Request('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: 'OldPass123!',
          newPassword: 'NewStrongPass456!',
        }),
      });

      // Pass stale authVersion: 1 in JWT/KV while D1 has auth_version: 5; handler must read D1 (5) and increment to 6
      const res = await changePassword(req, {
        AURA_DB: db,
        AUTH_KV: kv,
        JWT_SECRET,
      });
      expect(res.status).toBe(200);

      const d1Row = sqlite.prepare("SELECT auth_version FROM users WHERE id = 'usr_1'").get() as {
        auth_version: number;
      };
      expect(d1Row.auth_version).toBe(6);
      expect(kv.store.get('cust_auth_ver:usr_1')).toBe('6');
      expect(JSON.parse(kv.store.get('user:user1@aura.vn')!).auth_version).toBe(6);
      expect(JSON.parse(kv.store.get('user:usr_1')!).auth_version).toBe(6);
    });

    it('BL1-02: monotonically increments D1 + KV auth_version on device revocation (DELETE /api/auth/devices/:id)', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          auth_version INTEGER DEFAULT 1,
          updated_at TEXT
        );
        CREATE TABLE trusted_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT,
          fingerprint TEXT,
          is_trusted INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
      `);
      sqlite
        .prepare(
          "INSERT INTO users (id, email, name, role, tenant_id, auth_version) VALUES ('usr_dev', 'dev@aura.vn', 'Dev User', 'customer', 'store-a', 4)"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO trusted_devices (id, user_id, name, fingerprint, is_trusted, tenant_id) VALUES ('sess_revoke', 'usr_dev', 'iPad', 'fp_ipad', 1, 'store-a')"
        )
        .run();

      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV({
        'user:dev@aura.vn': JSON.stringify({ id: 'usr_dev', email: 'dev@aura.vn', auth_version: 1 }),
        'user:usr_dev': JSON.stringify({ id: 'usr_dev', email: 'dev@aura.vn', auth_version: 1 }),
        'cust_auth_ver:usr_dev': '2',
      });

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, {
          id: 'usr_dev',
          email: 'dev@aura.vn',
          role: 'customer',
          name: 'Dev User',
          tenantId: 'store-a',
          authVersion: 1,
        } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerDeviceHandlers(app);

      const res = await app.request('/api/auth/devices/sess_revoke', {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);

      const d1Row = sqlite.prepare("SELECT auth_version FROM users WHERE id = 'usr_dev'").get() as {
        auth_version: number;
      };
      expect(d1Row.auth_version).toBe(5);
      expect(kv.store.get('cust_auth_ver:usr_dev')).toBe('5');
      expect(JSON.parse(kv.store.get('user:dev@aura.vn')!).auth_version).toBe(5);
      expect(JSON.parse(kv.store.get('user:usr_dev')!).auth_version).toBe(5);
    });

    it('BL1-03: fails closed (503) when KV auth_version persistence fails during password change or device revocation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          role TEXT,
          password_hash TEXT,
          tenant_id TEXT DEFAULT 'default',
          auth_version INTEGER DEFAULT 1,
          updated_at TEXT
        );
        CREATE TABLE trusted_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT,
          fingerprint TEXT,
          is_trusted INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      const oldHash = await hashPassword('OldPass123!');
      sqlite
        .prepare(
          "INSERT INTO users (id, email, name, role, password_hash, tenant_id, auth_version) VALUES ('usr_fail', 'fail@aura.vn', 'Fail User', 'customer', ?, 'store-a', 2)"
        )
        .run(oldHash);
      sqlite
        .prepare(
          "INSERT INTO trusted_devices (id, user_id, name, fingerprint, is_trusted, tenant_id) VALUES ('sess_1', 'usr_fail', 'Mac', 'fp_mac', 1, 'store-a')"
        )
        .run();

      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV({
        'user:fail@aura.vn': JSON.stringify({
          id: 'usr_fail',
          email: 'fail@aura.vn',
          password_hash: oldHash,
          auth_version: 2,
        }),
        'user:usr_fail': JSON.stringify({
          id: 'usr_fail',
          email: 'fail@aura.vn',
          password_hash: oldHash,
          auth_version: 2,
        }),
      });
      kv.put = vi.fn(async (key: string) => {
        if (key.startsWith('cust_auth_ver:')) {
          throw new Error('KV write unavailable');
        }
      }) as unknown as KVNamespace['put'];

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, {
          id: 'usr_fail',
          email: 'fail@aura.vn',
          role: 'customer',
          name: 'Fail User',
          tenantId: 'store-a',
          authVersion: 2,
        } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerPasswordHandlers(app);
      registerDeviceHandlers(app);

      const pwRes = await app.request('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'OldPass123!',
          newPassword: 'NewStrongPass789!',
        }),
      });
      expect(pwRes.status).toBe(503);

      const devRes = await app.request('/api/auth/devices/sess_1', {
        method: 'DELETE',
      });
      expect(devRes.status).toBe(503);
    });

    it('BL1-04: enforces tenant isolation in registerStaffDevice and revokeStaffDevice across stores', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT,
          password_hash TEXT,
          tenant_id TEXT DEFAULT 'default',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE staff_devices (
          id TEXT PRIMARY KEY,
          staff_id TEXT,
          device_name TEXT,
          device_token TEXT UNIQUE,
          pin_hash TEXT,
          role TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);
      sqlite
        .prepare(
          "INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('st_a', 'Alice', 'cashier', 'store-a', 1, 1)"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO users (id, name, role, tenant_id, is_active, auth_version) VALUES ('st_b', 'Bob', 'cashier', 'store-b', 1, 1)"
        )
        .run();

      const db = createSqliteD1(sqlite);
      const kv = createMemoryKV();
      const app = new Hono<{ Bindings: Env }>();
      let caller: { id: string; role: string; tenantId: string } = {
        id: 'mgr_a',
        role: 'manager',
        tenantId: 'store-a',
      };
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, caller as never);
        await next();
      });
      app.post('/mobile/devices/register', (c) => registerStaffDevice(c));
      app.delete('/mobile/devices/:device_id', (c) => revokeStaffDevice(c));

      // Store-A manager cannot register device for Store-B staff
      const crossStoreRes = await app.request('/mobile/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: 'st_b',
          device_token: 'dev_tok_b1',
          device_name: 'POS B1',
          pin: '1234',
        }),
      });
      expect(crossStoreRes.status).toBe(403);

      // HQ admin with 'hq' tenant can register device for Store-B staff, and device inherits 'store-b'
      caller = { id: 'hq_1', role: 'owner', tenantId: 'hq' };
      const hqRegRes = await app.request('/mobile/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: 'st_b',
          device_token: 'dev_tok_b1',
          device_name: 'POS B1',
          pin: '1234',
        }),
      });
      expect(hqRegRes.status).toBe(201);

      const devRow = sqlite
        .prepare("SELECT id, tenant_id FROM staff_devices WHERE device_token = 'dev_tok_b1'")
        .get() as { id: string; tenant_id: string };
      expect(devRow.tenant_id).toBe('store-b');

      // Store-A manager cannot revoke Store-B device (tenant-scoped DELETE returns 404)
      caller = { id: 'mgr_a', role: 'manager', tenantId: 'store-a' };
      const crossRevokeRes = await app.request(`/mobile/devices/${devRow.id}`, {
        method: 'DELETE',
      });
      expect(crossRevokeRes.status).toBe(404);
    });

    it('BL1-05: does not bypass rate limiting for localhost Origin or 127.0.0.1 IP when not running in test harness', async () => {
      const kv = createMemoryKV();
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = {
          AUTH_KV: kv,
          ENVIRONMENT: 'production',
          NODE_ENV: 'production',
        } as unknown as Env;
        await next();
      });
      app.use(
        '/api/orders/*',
        rateLimitMiddleware({
          max: 2,
          windowSec: 60,
          keyPrefix: 'rate:order-test',
          errorMessage: 'Too many requests',
        })
      );
      app.post('/api/orders/create', (c) => c.json({ ok: true }));

      const headers = {
        Origin: 'http://localhost:5173',
        'X-Forwarded-For': '127.0.0.1',
        'CF-Connecting-IP': '127.0.0.1',
      };

      const r1 = await app.request('/api/orders/create', { method: 'POST', headers });
      expect(r1.status).toBe(200);
      const r2 = await app.request('/api/orders/create', { method: 'POST', headers });
      expect(r2.status).toBe(200);
      const r3 = await app.request('/api/orders/create', { method: 'POST', headers });
      expect(r3.status).toBe(429);
    });
  });

  describe('Cluster BL2: PayOS Refund/Reconcile HQ Store Inheritance, COD & Subscription IPN Guards', () => {
    it('BL2-01: normalizes HQ hq->* in payment-access and rejects non-HQ wildcard or cross-store claims', () => {
      const hqWildcardCtx = {
        get: (k: string) => (k === 'user' ? { id: 'hq_1', role: 'admin', tenantId: 'hq' } : 'hq'),
        req: { query: () => undefined, header: () => undefined },
      };
      expect(hasPaymentTenantMismatch(hqWildcardCtx)).toBe(false);
      expect(resolvePaymentTenantScope(hqWildcardCtx)).toEqual({
        tenantId: '*',
        wildcard: true,
      });

      const hqTargetStoreCtx = {
        get: (k: string) => (k === 'user' ? { id: 'hq_1', role: 'owner', tenantId: '*' } : '*'),
        req: {
          query: (name: string) => (name === 'store_id' ? 'store-b' : undefined),
          header: () => undefined,
        },
      };
      expect(hasPaymentTenantMismatch(hqTargetStoreCtx)).toBe(false);
      expect(resolvePaymentTenantScope(hqTargetStoreCtx)).toEqual({
        tenantId: 'store-b',
        wildcard: false,
      });

      const nonHqWildcardCtx = {
        get: (k: string) => (k === 'user' ? { id: 'mgr_1', role: 'manager', tenantId: 'hq' } : 'hq'),
        req: { query: () => undefined, header: () => undefined },
      };
      expect(hasPaymentTenantMismatch(nonHqWildcardCtx)).toBe(true);
      expect(resolvePaymentTenantScope(nonHqWildcardCtx)).toBeNull();
    });

    it('BL2-02: inherits concrete store tenant_id when HQ admin creates a COD payment and allows HQ cross-store refund lookup while isolating store managers', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          customer_id TEXT,
          order_token TEXT,
          status TEXT,
          payment_status TEXT,
          payment_method TEXT,
          total INTEGER,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          amount INTEGER,
          method TEXT,
          status TEXT,
          refund_status TEXT,
          refund_amount REAL,
          refunded_at TEXT,
          transaction_id TEXT,
          payment_url TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);
      sqlite
        .prepare(
          "INSERT INTO orders (id, order_number, customer_id, status, payment_status, payment_method, total, tenant_id) VALUES ('ord_cod_b', 'ORD-B1', 'cust_b1', 'pending', 'pending', 'cod', 80000, 'store-b')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO orders (id, order_number, customer_id, status, payment_status, payment_method, total, tenant_id) VALUES ('ord_payos_b', 'ORD-B2', 'cust_b2', 'completed', 'paid', 'payos', 60000, 'store-b')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO payments (id, order_id, amount, method, status, transaction_id, tenant_id, created_at, updated_at) VALUES ('pay_b2', 'ord_payos_b', 60000, 'payos', 'paid', '99887766', 'store-b', '2026-11-05T08:00:00Z', '2026-11-05T08:00:00Z')"
        )
        .run();

      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;

      const app = new OpenAPIHono<{ Bindings: Env }>();
      let currentUser: { id: string; role: string; tenantId: string } = {
        id: 'hq_owner',
        role: 'owner',
        tenantId: 'hq',
      };
      app.use('*', async (c, next) => {
        c.env = env;
        c.set('user' as never, currentUser as never);
        c.set('tenantId' as never, currentUser.tenantId as never);
        await next();
      });
      registerPaymentMutationHandlers(app);

      // 1) HQ admin creates COD payment for store-b order -> payment row inherits 'store-b', never '*' or 'hq'
      const createRes = await app.request('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'ord_cod_b',
          method: 'cod',
          amount: 80000,
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
        }),
      });
      expect(createRes.status).toBe(201);

      const createdPayRow = sqlite
        .prepare("SELECT tenant_id, status FROM payments WHERE order_id = 'ord_cod_b'")
        .get() as { tenant_id: string; status: string } | undefined;
      expect(createdPayRow?.tenant_id).toBe('store-b');
      expect(createdPayRow?.status).toBe('pending');

      // 2) HQ admin can reach store-b payment on POST /api/payments/refund (reaches provider check -> 422)
      const hqRefundRes = await app.request('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay_b2',
          amount: 60000,
          reason: 'Customer request',
          idempotencyKey: '00000000-0000-4000-8000-000000000002',
        }),
      });
      expect(hqRefundRes.status).toBe(422);

      // 3) Store-A manager cannot refund store-B payment (404)
      currentUser = { id: 'mgr_a', role: 'manager', tenantId: 'store-a' };
      const storeARefundRes = await app.request('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay_b2',
          amount: 60000,
          reason: 'Cross-store attempt',
          idempotencyKey: '00000000-0000-4000-8000-000000000003',
        }),
      });
      expect(storeARefundRes.status).toBe(404);
    });

    it('BL2-03: selects o.order_token in payment creation and refund handlers so guest orders with valid X-Order-Token are authorized while mismatched tokens are rejected', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_token TEXT,
          total INTEGER,
          payment_status TEXT,
          payment_method TEXT,
          status TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          amount INTEGER,
          method TEXT,
          status TEXT,
          refund_status TEXT,
          transaction_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
      `);
      sqlite
        .prepare(
          "INSERT INTO orders (id, customer_id, order_token, total, payment_status, payment_method, status, tenant_id) VALUES ('ord_guest_1', NULL, 'tok_secret_123', 45000, 'pending', 'cod', 'pending', 'store-a')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO orders (id, customer_id, order_token, total, payment_status, payment_method, status, tenant_id) VALUES ('ord_guest_paid', NULL, 'tok_paid_456', 50000, 'paid', 'payos', 'completed', 'store-a')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO payments (id, order_id, amount, method, status, transaction_id, tenant_id, created_at, updated_at) VALUES ('pay_guest_paid', 'ord_guest_paid', 50000, 'payos', 'paid', '12345678', 'store-a', '2026-11-05T08:00:00Z', '2026-11-05T08:00:00Z')"
        )
        .run();

      const db = createSqliteD1(sqlite);
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'test' } as unknown as Env;
        c.set('user' as never, { id: 'cust_other', role: 'customer', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerPaymentMutationHandlers(app);
      app.post('/api/refunds/test', (c) => handleRefund(c));

      const badRes = await app.request('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Order-Token': 'wrong_token',
        },
        body: JSON.stringify({
          orderId: 'ord_guest_1',
          method: 'cod',
          amount: 45000,
          idempotencyKey: '00000000-0000-4000-8000-000000000004',
        }),
      });
      expect(badRes.status).toBe(403);

      const goodRes = await app.request('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Order-Token': 'tok_secret_123',
        },
        body: JSON.stringify({
          orderId: 'ord_guest_1',
          method: 'cod',
          amount: 45000,
          idempotencyKey: '00000000-0000-4000-8000-000000000005',
        }),
      });
      expect(goodRes.status).toBe(201);
    });

    it('BL2-04: blocks collectCodPayment on single-L canceled and refunded orders with 409 Conflict', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT,
          payment_method TEXT,
          payment_status TEXT,
          total REAL,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
      `);
      sqlite
        .prepare(
          "INSERT INTO orders (id, status, payment_method, payment_status, total, tenant_id) VALUES ('ord_canceled', 'canceled', 'cash', 'pending', 50000, 'store-a')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO orders (id, status, payment_method, payment_status, total, tenant_id) VALUES ('ord_refunded', 'refunded', 'cash', 'pending', 50000, 'store-a')"
        )
        .run();

      const db = createSqliteD1(sqlite);

      const canceledRes = await collectCodPayment(db, 'ord_canceled', 'store-a');
      expect(canceledRes.success).toBe(false);
      if (!canceledRes.success) {
        expect(canceledRes.statusCode).toBe(409);
      }

      const refundedRes = await collectCodPayment(db, 'ord_refunded', 'store-a');
      expect(refundedRes.success).toBe(false);
      if (!refundedRes.success) {
        expect(refundedRes.statusCode).toBe(409);
      }
    });

    it('BL2-05: blocks payInvoice when existing subscription invoice is in processing state (409)', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE subscriptions (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'default',
          plan_type TEXT,
          status TEXT,
          price_vnd INTEGER,
          billing_cycle TEXT
        );
        CREATE TABLE subscription_invoices (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          subscription_id TEXT,
          amount_usd REAL,
          amount_vnd INTEGER,
          currency TEXT,
          status TEXT,
          nowpayments_invoice_id TEXT,
          payment_url TEXT,
          billing_period_start TEXT,
          billing_period_end TEXT,
          updated_at TEXT
        );
      `);
      sqlite
        .prepare(
          "INSERT INTO subscriptions (id, tenant_id, plan_type, status, price_vnd, billing_cycle) VALUES ('sub_a', 'store-a', 'pro', 'active', 2500000, 'monthly')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO subscription_invoices (id, tenant_id, subscription_id, amount_usd, amount_vnd, currency, status) VALUES ('inv_proc_1', 'store-a', 'sub_a', 100, 2500000, 'USDTTRC20', 'processing')"
        )
        .run();

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = {
          AURA_DB: db,
          JWT_SECRET,
          NOWPAYMENTS_API_KEY: 'np_test_key',
          FRONTEND_URL: 'https://aura.vn',
        } as unknown as Env;
        c.set('user' as never, { id: 'owner_a', role: 'owner', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.post('/api/subscriptions/invoices/:id/pay', (c) => payInvoice(c));

      const ownerToken = await generateJWT(
        {
          id: 'owner_a',
          sub: 'owner_a',
          email: 'ownera@aura.vn',
          role: 'owner',
          name: 'Owner A',
          tenantId: 'store-a',
        },
        JWT_SECRET,
        3600
      );

      const res = await app.request('/api/subscriptions/invoices/inv_proc_1/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ payment_method: 'nowpayments' }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toContain('processing');
    });
  });

  describe('Cluster BL3: Shift & Attendance HQ Wildcard Tenant Inheritance & Cross-Store Isolation', () => {
    function createShiftSqlite() {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          role TEXT,
          email TEXT,
          phone TEXT,
          locale TEXT DEFAULT 'vi',
          is_active INTEGER DEFAULT 1,
          auth_version INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          hire_date TEXT,
          hourly_rate REAL,
          avatar_url TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE staff (
          id TEXT PRIMARY KEY,
          name TEXT,
          role TEXT,
          email TEXT,
          phone TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          hire_date TEXT,
          hourly_rate REAL,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE staff_shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT DEFAULT 'default',
          staff_id TEXT NOT NULL,
          staff_name TEXT,
          role TEXT,
          date TEXT NOT NULL,
          shift TEXT DEFAULT 'scheduled',
          start_time TEXT,
          end_time TEXT,
          clock_in TEXT,
          clock_out TEXT,
          hours_worked REAL,
          attendance_state TEXT DEFAULT 'scheduled',
          scheduled_shift_id TEXT,
          late_minutes INTEGER DEFAULT 0,
          early_leave_minutes INTEGER DEFAULT 0,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      sqlite
        .prepare(
          "INSERT INTO users (id, name, role, email, phone, is_active, auth_version, tenant_id, created_at, updated_at) VALUES ('hq_1', 'HQ Admin', 'admin', 'hq1@aura.vn', '0900000001', 1, 1, 'hq', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO users (id, name, role, email, phone, is_active, auth_version, tenant_id, created_at, updated_at) VALUES ('hq_admin', 'HQ Super Admin', 'admin', 'hqadmin@aura.vn', '0900000002', 1, 1, '*', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO users (id, name, role, email, phone, is_active, auth_version, tenant_id, created_at, updated_at) VALUES ('mgr_a', 'Manager A', 'manager', 'mgra@aura.vn', '0900000003', 1, 1, 'store-a', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO users (id, name, role, email, phone, is_active, auth_version, tenant_id, created_at, updated_at) VALUES ('st_store_a', 'Alice Store A', 'barista', 'alice@aura.vn', '0901000001', 1, 1, 'store-a', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO users (id, name, role, email, phone, is_active, auth_version, tenant_id, created_at, updated_at) VALUES ('st_store_b', 'Bob Store B', 'cashier', 'bob@aura.vn', '0901000002', 1, 1, 'store-b', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO staff (id, name, role, email, phone, is_active, tenant_id, created_at, updated_at) VALUES ('st_store_a', 'Alice Store A', 'barista', 'alice@aura.vn', '0901000001', 1, 'store-a', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')"
        )
        .run();
      sqlite
        .prepare(
          "INSERT INTO staff (id, name, role, email, phone, is_active, tenant_id, created_at, updated_at) VALUES ('st_store_b', 'Bob Store B', 'cashier', 'bob@aura.vn', '0901000002', 1, 'store-b', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')"
        )
        .run();
      return sqlite;
    }

    it('BL3-01: supports HQ wildcard and explicit store overrides in shiftScope while enforcing PILOT_TENANT_ID and blocking non-HQ cross-store access', async () => {
      const sqlite = createShiftSqlite();
      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;

      const hqWildScope = await shiftScope(env, { id: 'hq_1', role: 'admin', tenantId: 'hq' });
      expect(hqWildScope.tenantId).toBe('*');
      expect(hqWildScope.canManage).toBe(true);

      const hqStoreBScope = await shiftScope(
        env,
        { id: 'hq_1', role: 'owner', tenantId: '*' },
        'store-b'
      );
      expect(hqStoreBScope.tenantId).toBe('store-b');

      await expect(
        shiftScope(env, { id: 'mgr_a', role: 'manager', tenantId: 'store-a' }, 'store-b')
      ).rejects.toThrow(ShiftContractError);

      await expect(
        shiftScope(
          { AURA_DB: db, PILOT_TENANT_ID: 'store-a' } as unknown as Env,
          { id: 'st_store_b', role: 'cashier', tenantId: 'store-b' }
        )
      ).rejects.toThrow('Attendance is unavailable for this store');

      const targetStaff = await shiftTarget(hqWildScope, 'st_store_b');
      expect(targetStaff.id).toBe('st_store_b');
      expect(targetStaff.tenant_id).toBe('store-b');
    });

    it('BL3-02: inherits target staff concrete tenant_id when HQ wildcard admin creates or updates a schedule', async () => {
      const sqlite = createShiftSqlite();
      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
      const hqScope = await shiftScope(env, { id: 'hq_admin', role: 'admin', tenantId: '*' });

      const created = await createSchedule(hqScope, {
        staffId: 'st_store_b',
        date: '2026-11-05',
        startTime: '08:00',
        endTime: '16:00',
        notes: 'Morning shift',
      });
      expect(created.tenant_id).toBe('store-b');
      expect(created.staff_id).toBe('st_store_b');

      // Overlapping schedule in store-b must be rejected with 409
      await expect(
        createSchedule(hqScope, {
          staffId: 'st_store_b',
          date: '2026-11-05',
          startTime: '12:00',
          endTime: '18:00',
        })
      ).rejects.toThrow('Overlapping shift schedule exists for staff member');

      const updated = await updateSchedule(hqScope, String(created.id), {
        startTime: '09:00',
        endTime: '17:00',
        notes: 'Updated shift',
      });
      expect(updated.tenant_id).toBe('store-b');
      expect(updated.start_time).toBe('09:00');
      expect(updated.end_time).toBe('17:00');
    });

    it('BL3-03: inherits target staff concrete tenant_id on HQ wildcard clockIn and clockOut (including attendanceId-only clockOut)', async () => {
      const sqlite = createShiftSqlite();
      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
      const hqScope = await shiftScope(env, { id: 'hq_admin', role: 'admin', tenantId: 'hq' });

      const clockedIn = await clockIn(hqScope, 'st_store_b', 'Arrived on time');
      expect(clockedIn.tenant_id).toBe('store-b');
      expect(clockedIn.staff_id).toBe('st_store_b');
      expect(clockedIn.attendance_state).toBe('active');

      // Clock out using only attendanceId under HQ wildcard scope
      const clockedOut = await clockOut(hqScope, undefined, String(clockedIn.id), 'Completed shift');
      expect(clockedOut.tenant_id).toBe('store-b');
      expect(clockedOut.attendance_state).toBe('completed');
      expect(clockedOut.clock_out).toBeTruthy();
    });

    it('BL3-04: allows HQ wildcard admin to list and filter shifts/attendance across stores while isolating store-scoped users', async () => {
      const sqlite = createShiftSqlite();
      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
      const hqScope = await shiftScope(env, { id: 'hq_admin', role: 'admin', tenantId: '*' });

      await createSchedule(hqScope, {
        staffId: 'st_store_a',
        date: '2026-11-05',
        startTime: '08:00',
        endTime: '14:00',
      });
      await createSchedule(hqScope, {
        staffId: 'st_store_b',
        date: '2026-11-05',
        startTime: '10:00',
        endTime: '18:00',
      });

      const allStores = await listShifts(hqScope, { date: '2026-11-05' });
      expect(allStores.rows).toHaveLength(2);

      const storeAUserScope = await shiftScope(env, {
        id: 'mgr_a',
        role: 'manager',
        tenantId: 'store-a',
      });
      const onlyStoreA = await listShifts(storeAUserScope, { date: '2026-11-05' });
      expect(onlyStoreA.rows).toHaveLength(1);
      expect(onlyStoreA.rows[0].tenant_id).toBe('store-a');

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = env;
        c.set('user' as never, { id: 'hq_admin', role: 'admin', tenantId: '*' } as never);
        await next();
      });
      registerShiftHandlers(app);
      registerAttendanceHandlers(app);

      const locFilteredRes = await app.request('/api/staff/shifts?locationId=store-b');
      expect(locFilteredRes.status).toBe(200);
      const locBody = (await locFilteredRes.json()) as {
        data: { shifts: Array<{ staffId: string; locationId: string }> };
      };
      expect(locBody.data.shifts).toHaveLength(1);
      expect(locBody.data.shifts[0].staffId).toBe('st_store_b');
    });

    it('BL3-05: resolves concrete staff tenant_id in GET /api/staff/:id when HQ wildcard admin inspects a store staff member', async () => {
      const sqlite = createShiftSqlite();
      const db = createSqliteD1(sqlite);
      const env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
      const hqScope = await shiftScope(env, { id: 'hq_admin', role: 'admin', tenantId: '*' });

      await createSchedule(hqScope, {
        staffId: 'st_store_b',
        date: '2026-11-05',
        startTime: '08:00',
        endTime: '16:00',
      });

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = env;
        c.set('user' as never, { id: 'hq_admin', role: 'admin', tenantId: 'hq' } as never);
        c.set('tenantId' as never, '*' as never);
        await next();
      });
      registerStaffCrudHandlers(app);

      const res = await app.request('/api/staff/st_store_b');
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { id: string; recentShifts: Array<{ staffId: string }> };
      };
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('st_store_b');
      expect(body.data.recentShifts).toHaveLength(1);
      expect(body.data.recentShifts[0].staffId).toBe('st_store_b');

      expect(
        extractRequestedShiftTenant({
          req: {
            query: () => undefined,
            header: (k: string) => (k === 'X-Store-ID' ? 'store-b' : undefined),
          },
        })
      ).toBe('store-b');
      const shiftRow = await getShift(hqScope, '1');
      expect(shiftRow.tenant_id).toBe('store-b');
    });
  });

  describe('Cluster BL4: Operational Store & KDS Stale-Response / AbortController Race Protection', () => {
    const repoRoot = resolve(__dirname, '../../../..');

    it('BL4-01: enforces monotonic sequence and mutation version guards in use-admin-customers-store and use-admin-reservations-store', () => {
      const customersSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-admin-customers-store.ts'),
        'utf8'
      );
      expect(customersSrc).toContain('let latestFetchCustomersSeq = 0;');
      expect(customersSrc).toContain('let mutationVersion = 0;');
      expect(customersSrc).toContain('seq !== latestFetchCustomersSeq || mutation !== mutationVersion');

      const reservationsSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-admin-reservations-store.ts'),
        'utf8'
      );
      expect(reservationsSrc).toContain('let latestFetchReservationsSeq = 0;');
      expect(reservationsSrc).toContain('if (seq !== latestFetchReservationsSeq) return;');
    });

    it('BL4-02: enforces monotonic request sequence guards in use-admin-orders-store and use-admin-shifts-store', () => {
      const ordersSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-admin-orders-store.ts'),
        'utf8'
      );
      expect(ordersSrc).toContain('let latestAdminOrdersRequestId = 0;');
      expect(ordersSrc).toContain('if (requestId !== latestAdminOrdersRequestId) return;');

      const shiftsSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-admin-shifts-store.ts'),
        'utf8'
      );
      expect(shiftsSrc).toContain('let latestFetchTodaySeq = 0;');
      expect(shiftsSrc).toContain('let latestFetchHistorySeq = 0;');
      expect(shiftsSrc).toContain('if (seq !== latestFetchTodaySeq) return;');
      expect(shiftsSrc).toContain('if (seq !== latestFetchHistorySeq) return;');
    });

    it('BL4-03: enforces read/mutation version and session generation guards in use-admin-staff-store, use-admin-recruitment-store, and use-audit-store', () => {
      const staffSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-admin-staff-store.ts'),
        'utf8'
      );
      expect(staffSrc).toContain('let staffFetchVersion = 0;');
      expect(staffSrc).toContain('let staffSessionGeneration = 0;');
      expect(staffSrc).toContain('if (version !== staffFetchVersion) return;');

      const recruitmentSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-admin-recruitment-store.ts'),
        'utf8'
      );
      expect(recruitmentSrc).toContain('let readVersion = 0;');
      expect(recruitmentSrc).toContain('let mutationVersion = 0;');
      expect(recruitmentSrc).toContain('read !== readVersion || mutation !== mutationVersion');

      const auditSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-audit-store.ts'),
        'utf8'
      );
      expect(auditSrc).toContain('let latestFetchLogsSeq = 0;');
      expect(auditSrc).toContain('if (seq !== latestFetchLogsSeq) return;');
    });

    it('BL4-04: enforces sequence guards and real period-over-period metrics in use-admin-dashboard-store, use-metrics-store, and use-performance-store', () => {
      const dashboardSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-admin-dashboard-store.ts'),
        'utf8'
      );
      expect(dashboardSrc).toContain('let latestFetchDashboardSeq = 0;');
      expect(dashboardSrc).toContain('if (seq !== latestFetchDashboardSeq) return;');
      expect(dashboardSrc).not.toContain('from=30d');

      const metricsSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-metrics-store.ts'),
        'utf8'
      );
      expect(metricsSrc).toContain("if (get()._requestId !== requestId) return;");

      const perfSrc = readFileSync(
        resolve(repoRoot, 'src/hooks/stores/admin/use-performance-store.ts'),
        'utf8'
      );
      expect(perfSrc).toContain("if (get()._vitalsRequestId !== requestId) return;");
      expect(perfSrc).toContain("if (get()._latencyRequestId !== requestId) return;");
    });

    it('BL4-05: aborts KDS stream and cancels reader when AbortController signals cancellation', async () => {
      const kdsHookSrc = readFileSync(resolve(repoRoot, 'src/hooks/use-kds.ts'), 'utf8');
      expect(kdsHookSrc).toContain('new AbortController()');
      expect(kdsHookSrc).toContain('useAuthStore.getState().sessionVersion !== sessionVersion');

      const controller = new AbortController();
      const cancelSpy = vi.fn(async () => undefined);
      let readCount = 0;
      vi.stubGlobal('localStorage', {
        getItem: () => 'fake-kds-token',
      });
      const fakeFetch = vi.fn(async () => ({
        status: 200,
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              readCount += 1;
              controller.abort();
              return {
                done: false,
                value: new TextEncoder().encode('event: snapshot\ndata: [{"id":"ord_1","items":[]}]\n\n'),
              };
            },
            cancel: cancelSpy,
          }),
        },
      }));
      vi.stubGlobal('fetch', fakeFetch);

      const events: unknown[] = [];
      await consumeKdsStream(controller.signal, (ev) => events.push(ev));
      expect(readCount).toBe(1);
      expect(cancelSpy).toHaveBeenCalled();
      expect(events).toHaveLength(0);
    });
  });
});
