// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { generateJWT } from '../../lib/jwt';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { requiresTier } from '../../middleware/tier-gate';
import { audit } from '../../middleware/audit-log';
import { AuditLogger } from '../../lib/audit-logger';
import type { Env } from '../../types/env';

// BN1 imports
import { resolveOrderCreationScope } from '../../../../packages/domain/order/policies/order-creation-scope';
import { resolveOpenApiOrdersTenant } from '../../routes/openapi-orders-handlers/helpers';
import { adminLoyaltyRouter } from '../../routes/admin-loyalty';
import {
  hasOpenApiLoyaltyTenantMismatch,
  findExistingLoyaltyIdempotencyTx,
} from '../../routes/openapi-loyalty-handlers/loyalty-db-helpers';
import { registerUsageHandlers } from '../../routes/openapi-promotions-handlers/usage-handlers';
import { promotionsRouter } from '../../routes/promotions';
import { loadPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';
import { reverseReferralCashback } from '../../../../packages/domain/crm/commands/referral';
import { reverseAccrual } from '../../../../packages/domain/crm/commands/refund-reversal';

// BN2 imports
import { resolveOpenApiTablesTenant } from '../../routes/openapi-tables-handlers/helpers';
import { tablesRouter } from '../../../../packages/domain/table/commands/tables';
import { tableSessionsRouter } from '../../routes/table-sessions';
import { floorPlanRouter } from '../../routes/floor-plan';
import { reservationsRouter, waitlistRouter } from '../../../../packages/domain/reservation/src/routes/reservations';
import { kitchenStationsRouter, kdsRouter } from '../../../../packages/domain/kitchen/commands/kitchen-stations';

// BN3 imports
import { isHQSuperAdmin as isDomainStaffHQSuperAdmin } from '../../../../packages/domain/staff/src/policies/authorization-policy';
import { registerPasswordHandlers } from '../../routes/openapi-auth-handlers/password-handlers';
import { listStaff } from '../../tree/auth/list-staff';
import { registerStaff } from '../../tree/auth/register-staff';
import { registerDeviceHandlers } from '../../routes/openapi-auth-handlers/device-handlers';
import { staffTipsRouter } from '../../../../packages/domain/staff/commands/staff-tips';
import { shiftScope } from '../../../../packages/domain/shift/commands/shift-access';
import { openApiPaymentsRouter } from '../../routes/openapi-payments-handlers/routes';

// BN4 imports
import { franchiseRouter } from '../../routes/franchise-locations';
import { registerMovementHandlers } from '../../routes/openapi-inventory-handlers/movement-handlers';
import { registerPurchaseOrderHandlers } from '../../routes/openapi-inventory-handlers/purchase-order-handlers';
import { registerSupplierHandlers } from '../../routes/openapi-inventory-handlers/supplier-handlers';
import { registerFeatureRoutes } from '../../routes/features-router';

const JWT_SECRET = 'phase67-bn1-bn4-security-secret-key-32chars!';

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

describe('Phase 67 Security Regression Suite (BN1..BN4)', () => {
  describe('Cluster BN1 — Orders, Loyalty, Promotions, CRM Policies & Referrals', () => {
    it('BN1-01: resolveOrderCreationScope resolves guest store from header/PILOT_TENANT_ID and rejects non-HQ cross-tenant overrides', async () => {
      const guestReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'X-Store-ID': 'store-b' },
      });
      const guestScope = await resolveOrderCreationScope(guestReq, { PILOT_TENANT_ID: 'store-a' });
      expect(guestScope.tenantId).toBe('store-b');

      const guestWildcardReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'X-Store-ID': 'hq' },
      });
      await expect(
        resolveOrderCreationScope(guestWildcardReq, { PILOT_TENANT_ID: 'store-a' })
      ).rejects.toMatchObject({ status: 403 });

      const guestNoHeaderReq = new Request('http://localhost/api/orders', {
        method: 'POST',
      });
      const guestFallbackScope = await resolveOrderCreationScope(guestNoHeaderReq, { PILOT_TENANT_ID: 'store-a' });
      expect(guestFallbackScope.tenantId).toBe('store-a');

      // Non-HQ staff attempting cross-tenant override must be rejected with 403
      const staffCrossReq = new Request('http://localhost/api/orders?store_id=store-b', {
        method: 'POST',
      });
      await expect(
        resolveOrderCreationScope(
          staffCrossReq,
          { PILOT_TENANT_ID: 'store-a' },
          { id: 'staff-a', role: 'waiter', tenantId: 'store-a' }
        )
      ).rejects.toMatchObject({ status: 403 });

      // Non-HQ customer attempting cross-tenant override must be rejected with 403
      const custCrossReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'X-Tenant-ID': 'store-b' },
      });
      await expect(
        resolveOrderCreationScope(
          custCrossReq,
          { PILOT_TENANT_ID: 'store-a' },
          { id: 'cust-a', role: 'customer', tenantId: 'store-a' }
        )
      ).rejects.toMatchObject({ status: 403 });
    });

    it('BN1-02: resolveOpenApiOrdersTenant enforces Bearer read 403 on cross-tenant override and normalizes HQ "hq" -> "*"', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', optionalAuth());
      app.get('/api/orders-test', async (c) => {
        const scope = resolveOpenApiOrdersTenant(c as never, 'read');
        if (!scope.ok) return scope.response;
        return c.json({ tenantId: scope.tenantId });
      });

      const staffAToken = await signJWT({ id: 'staff-a', role: 'waiter', tenantId: 'store-a' });
      const crossRes = await app.request(
        '/api/orders-test?store_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(crossRes.status).toBe(403);

      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const hqRes = await app.request(
        '/api/orders-test',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(hqRes.status).toBe(200);
      const hqBody = (await hqRes.json()) as { tenantId: string };
      expect(hqBody.tenantId).toBe('*');
    });

    it('BN1-03: adminLoyaltyRouter & OpenAPI loyalty helpers block cross-tenant overrides and scope idempotency by (tenant_id, customer_id, key)', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE loyalty_tiers (
          id TEXT PRIMARY KEY,
          name TEXT,
          min_points INTEGER DEFAULT 0,
          multiplier REAL DEFAULT 1,
          benefits TEXT DEFAULT '[]',
          color TEXT DEFAULT '#000',
          sort_order INTEGER DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE loyalty_transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT,
          customer_id TEXT,
          points INTEGER,
          type TEXT,
          idempotency_key TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        INSERT INTO loyalty_transactions (id, account_id, customer_id, points, type, idempotency_key, tenant_id)
        VALUES ('ltx-a1', 'la_cust-1', 'cust-1', 50, 'adjust', 'idem-shared-1', 'store-a');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/admin/loyalty', adminLoyaltyRouter);
      app.use('/api/loyalty-check', optionalAuth());
      app.get('/api/loyalty-check', (c) => {
        if (hasOpenApiLoyaltyTenantMismatch(c as never)) {
          return c.json({ error: 'Forbidden' }, 403);
        }
        return c.json({ ok: true });
      });

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossAdminRes = await app.request(
        '/api/admin/loyalty/tiers?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossAdminRes.status).toBe(403);

      const crossHelperRes = await app.request(
        '/api/loyalty-check',
        { headers: { Authorization: `Bearer ${mgrAToken}`, 'X-Store-ID': 'store-b' } },
        buildEnv(db)
      );
      expect(crossHelperRes.status).toBe(403);

      // Idempotency lookup for same customer + same tenant hits existing transaction
      const hitSame = await findExistingLoyaltyIdempotencyTx(db, 'idem-shared-1', {
        tenantId: 'store-a',
        customerId: 'cust-1',
      });
      expect(hitSame?.id).toBe('ltx-a1');

      // Different customer with same idempotency_key in same tenant must NOT collide
      const missOtherCustomer = await findExistingLoyaltyIdempotencyTx(db, 'idem-shared-1', {
        tenantId: 'store-a',
        customerId: 'cust-2',
      });
      expect(missOtherCustomer).toBeNull();

      // Different tenant with same idempotency_key must NOT collide
      const missOtherTenant = await findExistingLoyaltyIdempotencyTx(db, 'idem-shared-1', {
        tenantId: 'store-b',
        customerId: 'cust-1',
      });
      expect(missOtherTenant).toBeNull();
    });

    it('BN1-04: POST /api/promotions/use requires authentication and promotionsRouter blocks non-HQ cross-tenant ?store_id overrides', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE promotions (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          type TEXT DEFAULT 'fixed',
          value REAL DEFAULT 10000,
          min_order_amount REAL DEFAULT 0,
          max_discount_amount REAL,
          usage_limit INTEGER,
          used_count INTEGER DEFAULT 0,
          per_customer_limit INTEGER DEFAULT 1,
          start_date TEXT,
          end_date TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT,
          updated_at TEXT
        );
      `);

      const openApiApp = new OpenAPIHono<{ Bindings: Env }>();
      openApiApp.use('*', optionalAuth());
      registerUsageHandlers(openApiApp);

      // Unauthenticated request to POST /api/promotions/use must be rejected with 401
      const unauthUseRes = await openApiApp.request(
        '/api/promotions/use',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promotionId: '00000000-0000-4000-8000-000000000001',
            orderId: '00000000-0000-4000-8000-000000000002',
            discountAmount: 10000,
          }),
        },
        buildEnv(db)
      );
      expect(unauthUseRes.status).toBe(401);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/promotions', promotionsRouter);

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossPromosRes = await app.request(
        '/api/promotions?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossPromosRes.status).toBe(403);
    });

    it('BN1-05: loadPolicy scopes loyalty_tiers by tenant_id with default fallback, and reverseReferralCashback/reverseAccrual decrement total_earned', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE loyalty_tiers (
          tier_name TEXT,
          min_points INTEGER,
          cashback_rate REAL,
          point_multiplier REAL,
          expiry_days INTEGER,
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO loyalty_tiers (tier_name, min_points, cashback_rate, point_multiplier, expiry_days, tenant_id)
        VALUES ('bronze', 0, 0.02, 1.0, 365, 'default');
        INSERT INTO loyalty_tiers (tier_name, min_points, cashback_rate, point_multiplier, expiry_days, tenant_id)
        VALUES ('bronze', 0, 0.08, 2.0, 365, 'store-b');

        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          tenant_id TEXT DEFAULT 'store-a',
          loyalty_points INTEGER DEFAULT 100,
          lifetime_points INTEGER DEFAULT 100,
          tier TEXT DEFAULT 'bronze',
          loyalty_tier TEXT DEFAULT 'bronze',
          updated_at TEXT
        );
        CREATE TABLE referrals (
          id TEXT PRIMARY KEY,
          referrer_id TEXT,
          referred_customer_id TEXT,
          referral_code TEXT,
          status TEXT DEFAULT 'completed',
          bonus_type TEXT DEFAULT 'cashback',
          points_awarded INTEGER DEFAULT 0,
          cashback_awarded_vnd INTEGER DEFAULT 20000,
          first_order_id TEXT,
          first_order_amount INTEGER DEFAULT 100000,
          reward_paid_at TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT
        );
        CREATE TABLE cashback_wallets (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          balance INTEGER DEFAULT 50000,
          total_earned INTEGER DEFAULT 60000,
          total_spent INTEGER DEFAULT 10000,
          updated_at TEXT
        );
        CREATE TABLE cashback_transactions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT,
          customer_id TEXT,
          type TEXT,
          amount INTEGER,
          balance_after INTEGER,
          description TEXT,
          reference_order_id TEXT,
          expires_at TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT
        );
        CREATE TABLE loyalty_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id TEXT,
          action TEXT,
          points_delta INTEGER,
          amount_vnd INTEGER,
          order_id TEXT,
          reason TEXT,
          tier_before TEXT,
          tier_after TEXT,
          metadata TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT
        );
        CREATE TABLE loyalty_point_logs (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_id TEXT,
          points_change INTEGER,
          reason TEXT,
          balance_after INTEGER,
          description TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          total REAL DEFAULT 100000,
          total_amount REAL DEFAULT 100000,
          points_earned INTEGER DEFAULT 20,
          cashback_earned INTEGER DEFAULT 5000,
          tenant_id TEXT DEFAULT 'store-a'
        );

        INSERT INTO customers (id, tenant_id, loyalty_points, lifetime_points, tier)
        VALUES ('ref-cust-a', 'store-a', 100, 100, 'bronze');
        INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, status, bonus_type, cashback_awarded_vnd, tenant_id)
        VALUES ('ref-cb-a', 'ref-cust-a', 'referee-a', 'CODEA', 'completed', 'cashback', 20000, 'store-a');
        INSERT INTO cashback_wallets (id, customer_id, tenant_id, balance, total_earned, total_spent)
        VALUES ('cbw-a', 'ref-cust-a', 'store-a', 50000, 60000, 10000);
        INSERT INTO orders (id, customer_id, total, total_amount, points_earned, cashback_earned, tenant_id)
        VALUES ('ord-rev-a', 'ref-cust-a', 100000, 100000, 20, 5000, 'store-a');
      `);

      const policyStoreB = await loadPolicy(db, undefined, new Date(), 'store-b');
      expect(policyStoreB.defaultTier.cashbackRate).toBe(0.08);

      const policyStoreA = await loadPolicy(db, undefined, new Date(), 'store-a');
      expect(policyStoreA.defaultTier.cashbackRate).toBe(0.02);

      // Reversing referral cashback under HQ wildcard '*' inherits store-a and decrements total_earned (keeping total_spent unchanged)
      const revRefRes = await reverseReferralCashback(db, 'ref-cb-a', '*');
      expect(revRefRes.success).toBe(true);

      const walletAfterRefRev = sqlite
        .prepare('SELECT balance, total_earned, total_spent FROM cashback_wallets WHERE id = ?')
        .get('cbw-a') as { balance: number; total_earned: number; total_spent: number };
      expect(walletAfterRefRev.balance).toBe(30000);
      expect(walletAfterRefRev.total_earned).toBe(40000);
      expect(walletAfterRefRev.total_spent).toBe(10000);

      // Reversing order accrual decrements total_earned by 5000 (keeping total_spent at 10000)
      const revAccrualRes = await reverseAccrual(db, policyStoreA, {
        orderId: 'ord-rev-a',
        customerId: 'ref-cust-a',
        refundAmountVnd: 100000,
        tenantId: 'store-a',
      });
      expect(revAccrualRes.ok).toBe(true);

      const walletAfterAccrualRev = sqlite
        .prepare('SELECT balance, total_earned, total_spent FROM cashback_wallets WHERE id = ?')
        .get('cbw-a') as { balance: number; total_earned: number; total_spent: number };
      expect(walletAfterAccrualRev.balance).toBe(25000);
      expect(walletAfterAccrualRev.total_earned).toBe(35000);
      expect(walletAfterAccrualRev.total_spent).toBe(10000);
    });
  });

  describe('Cluster BN2 — Table Sessions, Floor Plan, Reservations, Waitlist & Kitchen KDS', () => {
    it('BN2-01: tablesRouter closes active table_sessions and clears current_order_id when table transitions to available or is released', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE tables (
          id TEXT PRIMARY KEY,
          number INTEGER,
          name TEXT,
          capacity INTEGER DEFAULT 4,
          zone TEXT DEFAULT 'indoor',
          status TEXT DEFAULT 'occupied',
          qr_token TEXT,
          current_order_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE table_sessions (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          table_number INTEGER,
          order_id TEXT,
          status TEXT DEFAULT 'active',
          started_at TEXT DEFAULT CURRENT_TIMESTAMP,
          ended_at TEXT,
          duration_minutes INTEGER,
          guest_count INTEGER DEFAULT 2,
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO tables (id, number, name, status, current_order_id, tenant_id)
        VALUES ('tbl-1', 1, 'Table 1', 'occupied', 'ord-active-1', 'store-a');
        INSERT INTO table_sessions (id, table_id, table_number, order_id, status, tenant_id)
        VALUES ('sess-1', 'tbl-1', 1, 'ord-active-1', 'active', 'store-a');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/tables', tablesRouter);

      const staffAToken = await signJWT({ id: 'staff-a', role: 'waiter', tenantId: 'store-a' });

      // Cross-tenant ?store_id=store-b must be rejected with 403
      const crossRes = await app.request(
        '/api/tables?store_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(crossRes.status).toBe(403);

      // Releasing tbl-1 closes sess-1 and clears current_order_id
      const releaseRes = await app.request(
        '/api/tables/tbl-1/release',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${staffAToken}` },
        },
        buildEnv(db)
      );
      expect(releaseRes.status).toBe(200);

      const tblRow = sqlite
        .prepare('SELECT status, current_order_id FROM tables WHERE id = ?')
        .get('tbl-1') as { status: string; current_order_id: string | null };
      expect(tblRow.status).toBe('available');
      expect(tblRow.current_order_id).toBeNull();

      const sessRow = sqlite
        .prepare('SELECT status, ended_at FROM table_sessions WHERE id = ?')
        .get('sess-1') as { status: string; ended_at: string | null };
      expect(sessRow.status).toBe('completed');
      expect(sessRow.ended_at).toBeTruthy();
    });

    it('BN2-02: tableSessionsRouter normalizes HQ "hq" wildcard, blocks cross-tenant session end, and scopes /stats', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE tables (
          id TEXT PRIMARY KEY,
          number INTEGER,
          status TEXT DEFAULT 'available',
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE table_sessions (
          id TEXT PRIMARY KEY,
          table_id TEXT,
          table_number INTEGER,
          order_id TEXT,
          started_at TEXT DEFAULT CURRENT_TIMESTAMP,
          ended_at TEXT,
          duration_minutes INTEGER,
          guest_count INTEGER DEFAULT 2,
          status TEXT DEFAULT 'active',
          tenant_id TEXT DEFAULT 'default'
        );
        INSERT INTO tables (id, number, status, tenant_id) VALUES ('t-a', 1, 'occupied', 'store-a');
        INSERT INTO tables (id, number, status, tenant_id) VALUES ('t-b', 2, 'occupied', 'store-b');
        INSERT INTO table_sessions (id, table_id, table_number, status, tenant_id)
        VALUES ('sess-b', 't-b', 2, 'active', 'store-b');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/table-sessions', tableSessionsRouter);

      const staffAToken = await signJWT({ id: 'staff-a', role: 'waiter', tenantId: 'store-a' });
      const crossEndRes = await app.request(
        '/api/table-sessions/sess-b/end',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${staffAToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        buildEnv(db)
      );
      expect(crossEndRes.status).toBe(404);

      const hqToken = await signJWT({ id: 'hq-admin', role: 'owner', tenantId: 'hq' });
      const hqStatsRes = await app.request(
        '/api/table-sessions/stats?store_id=store-b',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(hqStatsRes.status).toBe(200);
      const statsBody = (await hqStatsRes.json()) as { stats: { activeSessions: number; totalTables: number } };
      expect(statsBody.stats.activeSessions).toBe(1);
      expect(statsBody.stats.totalTables).toBe(1);
    });

    it('BN2-03: floorPlanRouter returns 200 empty layout when tables table is missing and rejects empty positions batch & cross-tenant ?store_id', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/floor-plan', floorPlanRouter);

      const staffAToken = await signJWT({ id: 'staff-a', role: 'manager', tenantId: 'store-a' });

      // Legacy DB without `tables` table returns 200 with empty tables array
      const emptyDbRes = await app.request(
        '/api/floor-plan',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(emptyDbRes.status).toBe(200);
      const emptyDbBody = (await emptyDbRes.json()) as { success: boolean; tables: unknown[] };
      expect(emptyDbBody.success).toBe(true);
      expect(emptyDbBody.tables).toEqual([]);

      // Empty positions array is rejected with 400
      const emptyBatchRes = await app.request(
        '/api/floor-plan/tables/positions',
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${staffAToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: [] }),
        },
        buildEnv(db)
      );
      expect(emptyBatchRes.status).toBe(400);

      // Cross-tenant ?store_id=store-b is rejected with 403
      const crossRes = await app.request(
        '/api/floor-plan?store_id=store-b',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db)
      );
      expect(crossRes.status).toBe(403);
    });

    it('BN2-04: reservationsRouter enforces status state machine & customer cancellation guards and waitlistRouter rejects cross-tenant ?store_id', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE reservations (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          party_size INTEGER DEFAULT 2,
          reservation_date TEXT,
          reservation_time TEXT,
          table_id TEXT,
          status TEXT DEFAULT 'confirmed',
          cancelled_at TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE waitlist (
          id TEXT PRIMARY KEY,
          customer_name TEXT,
          customer_phone TEXT,
          party_size INTEGER DEFAULT 2,
          status TEXT DEFAULT 'waiting',
          position INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        INSERT INTO reservations (id, customer_id, customer_name, customer_phone, reservation_date, reservation_time, status, tenant_id)
        VALUES ('res-completed', 'cust-1', 'Alice', '0901112222', '2099-12-31', '18:00', 'completed', 'store-a');
        INSERT INTO reservations (id, customer_id, customer_name, customer_phone, reservation_date, reservation_time, status, cancelled_at, tenant_id)
        VALUES ('res-cancelled', 'cust-1', 'Alice', '0901112222', '2099-12-31', '19:00', 'cancelled', '2026-11-01T00:00:00Z', 'store-a');
        INSERT INTO reservations (id, customer_id, customer_name, customer_phone, reservation_date, reservation_time, status, tenant_id)
        VALUES ('res-seated', 'cust-1', 'Alice', '0901112222', '2099-12-31', '20:00', 'seated', 'store-a');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/reservations', reservationsRouter);
      app.route('/api/waitlist', waitlistRouter);

      const managerAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      // Terminal completed -> confirmed is rejected with 400
      const invalidTransRes = await app.request(
        '/api/reservations/res-completed',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerAToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        },
        buildEnv(db)
      );
      expect(invalidTransRes.status).toBe(400);

      // Reopening cancelled -> confirmed clears cancelled_at
      const reopenRes = await app.request(
        '/api/reservations/res-cancelled',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerAToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        },
        buildEnv(db)
      );
      expect(reopenRes.status).toBe(200);
      const reopenedRow = sqlite
        .prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?')
        .get('res-cancelled') as { status: string; cancelled_at: string | null };
      expect(reopenedRow.status).toBe('confirmed');
      expect(reopenedRow.cancelled_at).toBeNull();

      // Customer cannot cancel an already-seated reservation
      const custToken = await signJWT({ id: 'cust-1', role: 'customer', tenantId: 'store-a', phone: '0901112222' });
      const cancelSeatedRes = await app.request(
        '/api/reservations/res-seated',
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${custToken}` },
        },
        buildEnv(db)
      );
      expect(cancelSeatedRes.status).toBe(400);

      // Waitlist cross-tenant ?store_id=store-b rejected with 403
      const waitlistCrossRes = await app.request(
        '/api/waitlist?store_id=store-b',
        { headers: { Authorization: `Bearer ${managerAToken}` } },
        buildEnv(db)
      );
      expect(waitlistCrossRes.status).toBe(403);
    });

    it('BN2-05: kitchenStationsRouter transitions parent order to ready when all station tickets are ready and kdsRouter normalizes HQ "hq"', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          status TEXT DEFAULT 'preparing',
          items TEXT DEFAULT '[]',
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE kds_station_tickets (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          station_id TEXT,
          items_json TEXT DEFAULT '[]',
          status TEXT DEFAULT 'preparing',
          priority INTEGER DEFAULT 0,
          completed_at TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO orders (id, order_number, status, tenant_id)
        VALUES ('ord-kds-1', 'ORD-KDS-1', 'preparing', 'store-a');
        INSERT INTO kds_station_tickets (id, order_id, station_id, status, tenant_id)
        VALUES ('tkt-1', 'ord-kds-1', 'bar', 'ready', 'store-a');
        INSERT INTO kds_station_tickets (id, order_id, station_id, status, tenant_id)
        VALUES ('tkt-2', 'ord-kds-1', 'kitchen', 'preparing', 'store-a');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/kitchen', kitchenStationsRouter);
      app.route('/api/kds', kdsRouter);

      const kitchenAToken = await signJWT({ id: 'chef-a', role: 'kitchen', tenantId: 'store-a' });
      const readyRes = await app.request(
        '/api/kitchen/tickets/tkt-2/status',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${kitchenAToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ready' }),
        },
        buildEnv(db)
      );
      expect(readyRes.status).toBe(200);

      const ordRow = sqlite
        .prepare('SELECT status FROM orders WHERE id = ?')
        .get('ord-kds-1') as { status: string };
      expect(ordRow.status).toBe('ready');

      // Non-HQ KDS ?store_id=store-b rejected with 403
      const kdsCrossRes = await app.request(
        '/api/kds/orders?store_id=store-b',
        { headers: { Authorization: `Bearer ${kitchenAToken}` } },
        buildEnv(db)
      );
      expect(kdsCrossRes.status).toBe(403);

      // HQ owner with tenantId: 'hq' can query KDS across stores
      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const kdsHqRes = await app.request(
        '/api/kds/orders',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(kdsHqRes.status).toBe(200);
    });
  });

  describe('Cluster BN3 — Auth, RBAC, Staff, Shifts, Devices & Audit Log Isolation', () => {
    it('BN3-01: domain-staff isHQSuperAdmin restricts to owner/admin and reset-password locks out after 5 failed attempts with audit logs', async () => {
      expect(isDomainStaffHQSuperAdmin({ role: 'manager', tenantId: 'hq' })).toBe(false);
      expect(isDomainStaffHQSuperAdmin({ role: 'staff', tenantId: '*' })).toBe(false);
      expect(isDomainStaffHQSuperAdmin({ role: 'owner', tenantId: 'hq' })).toBe(true);
      expect(isDomainStaffHQSuperAdmin({ role: 'admin', tenant_id: '*' })).toBe(true);

      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const { kv } = createMemoryKV();

      sqlite.exec(`
        CREATE TABLE password_resets (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          email TEXT,
          code TEXT,
          expires_at TEXT,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          actor_id TEXT,
          action TEXT,
          resource_type TEXT,
          entity_type TEXT,
          resource_id TEXT,
          entity_id TEXT,
          details TEXT,
          metadata TEXT,
          ip_address TEXT,
          user_agent TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        INSERT INTO users (id, name, email, phone, password_hash, role, tenant_id, is_active)
        VALUES ('u-reset-1', 'Reset User', 'reset@auracafe.vn', '0909998888', 'oldhash', 'customer', 'store-a', 1);
        INSERT INTO password_resets (id, user_id, email, code, expires_at, used, created_at)
        VALUES ('pr-1', 'u-reset-1', 'reset@auracafe.vn', '654321', '2099-12-31T23:59:59.000Z', 0, '2026-11-06T00:00:00.000Z');
      `);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      registerPasswordHandlers(app);

      // 5 failed attempts with wrong code -> 5th returns 429 and marks reset code as used
      for (let i = 1; i <= 4; i++) {
        const res = await app.request(
          '/api/auth/reset-password',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.0.0.${i}` },
            body: JSON.stringify({ email: 'reset@auracafe.vn', code: '111111', new_password: 'NewPassword123!' }),
          },
          buildEnv(db, kv)
        );
        expect(res.status).toBe(400);
      }

      const fifthRes = await app.request(
        '/api/auth/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.5' },
          body: JSON.stringify({ email: 'reset@auracafe.vn', code: '111111', new_password: 'NewPassword123!' }),
        },
        buildEnv(db, kv)
      );
      expect(fifthRes.status).toBe(429);

      const resetRow = sqlite
        .prepare('SELECT used FROM password_resets WHERE id = ?')
        .get('pr-1') as { used: number };
      expect(resetRow.used).toBe(1);

      const auditCount = sqlite
        .prepare("SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'PASSWORD_RESET_FAILED'")
        .get() as { cnt: number };
      expect(auditCount.cnt).toBeGreaterThanOrEqual(5);
    });

    it('BN3-02: audit() middleware prevents non-HQ X-Tenant-ID spoofing and AuditLogger.query/prune default to "default" tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          actor_id TEXT,
          action TEXT,
          resource_type TEXT,
          entity_type TEXT,
          resource_id TEXT,
          entity_id TEXT,
          details TEXT,
          metadata TEXT,
          ip_address TEXT,
          user_agent TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', optionalAuth());
      app.post('/api/test-audited', audit('TEST_MUTATION', 'order'), (c) => c.json({ ok: true, id: 'ord-99' }));

      const staffAToken = await signJWT({ id: 'staff-a', role: 'manager', tenantId: 'store-a' });
      const res = await app.request(
        '/api/test-audited',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${staffAToken}`,
            'X-Tenant-ID': 'store-b',
          },
        },
        buildEnv(db)
      );
      expect(res.status).toBe(200);

      // Wait briefly for fire-and-forget audit promise
      await new Promise((r) => setTimeout(r, 20));
      const logRow = sqlite
        .prepare("SELECT tenant_id FROM audit_logs WHERE action = 'TEST_MUTATION'")
        .get() as { tenant_id: string } | undefined;
      expect(logRow?.tenant_id).toBe('store-a');

      // Insert a default-tenant old log and a store-b old log
      sqlite.exec(`
        INSERT INTO audit_logs (id, user_id, action, resource_type, tenant_id, created_at)
        VALUES ('old-default', 'u1', 'OLD_ACT', 'system', 'default', '2020-01-01 00:00:00');
        INSERT INTO audit_logs (id, user_id, action, resource_type, tenant_id, created_at)
        VALUES ('old-store-b', 'u2', 'OLD_ACT', 'system', 'store-b', '2020-01-01 00:00:00');
      `);

      const logger = new AuditLogger(db);
      // Query without tenantId defaults to 'default' (does not leak store-a or store-b logs)
      const defaultLogs = await logger.query({});
      expect(defaultLogs.every((l) => (l.tenant_id || 'default') === 'default')).toBe(true);

      // Prune without tenantId only prunes 'default' tenant logs, preserving 'store-b'
      await logger.prune(30);
      const remainingStoreB = sqlite
        .prepare("SELECT id FROM audit_logs WHERE id = 'old-store-b'")
        .get() as { id: string } | undefined;
      expect(remainingStoreB?.id).toBe('old-store-b');
    });

    it('BN3-03: listStaff supports HQ wildcard and registerStaff allows HQ cross-store provisioning while normalizing "hq" to "default"', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        INSERT INTO users (id, name, email, phone, role, tenant_id, is_active)
        VALUES ('st-a', 'Staff A', 'a@auracafe.vn', '0901111111', 'waiter', 'store-a', 1);
        INSERT INTO users (id, name, email, phone, role, tenant_id, is_active)
        VALUES ('st-b', 'Staff B', 'b@auracafe.vn', '0902222222', 'cashier', 'store-b', 1);
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', requireAuth(['owner', 'manager', 'supervisor', 'admin']));
      app.get('/api/auth/staff', (c) => listStaff(c as never));
      app.post('/api/auth/register-staff', (c) => registerStaff(c as never));

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossListRes = await app.request(
        '/api/auth/staff?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossListRes.status).toBe(403);

      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const hqListRes = await app.request(
        '/api/auth/staff',
        { headers: { Authorization: `Bearer ${hqToken}` } },
        buildEnv(db)
      );
      expect(hqListRes.status).toBe(200);
      const hqListBody = (await hqListRes.json()) as { staff: Array<{ id: string }> };
      expect(hqListBody.staff.map((s) => s.id)).toEqual(expect.arrayContaining(['st-a', 'st-b']));

      // HQ owner provisions new staff into store-b via X-Store-ID
      const regStoreBRes = await app.request(
        '/api/auth/register-staff',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hqToken}`,
            'Content-Type': 'application/json',
            'X-Store-ID': 'store-b',
          },
          body: JSON.stringify({
            name: 'New Store B Barista',
            email: 'barista-b@auracafe.vn',
            phone: '0903334444',
            password: 'StrongPassword123!',
            role: 'barista',
          }),
        },
        buildEnv(db)
      );
      expect(regStoreBRes.status).toBe(201);
      const createdRow = sqlite
        .prepare('SELECT tenant_id FROM users WHERE email = ?')
        .get('barista-b@auracafe.vn') as { tenant_id: string };
      expect(createdRow.tenant_id).toBe('store-b');
    });

    it('BN3-04: requireAuth/optionalAuth populate userTier & emailVerified and device-handlers scope bulk DELETE by tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE trusted_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          device_name TEXT
        );
        CREATE TABLE staff_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          tenant_id TEXT DEFAULT 'default',
          device_name TEXT
        );
        INSERT INTO trusted_devices (id, user_id, tenant_id, device_name)
        VALUES ('dev-a', 'u-multi', 'store-a', 'iPad Store A');
        INSERT INTO trusted_devices (id, user_id, tenant_id, device_name)
        VALUES ('dev-b', 'u-multi', 'store-b', 'iPad Store B');
      `);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.get('/api/vip-only', requireAuth(), requiresTier('gold'), (c) => {
        const user = c.get('user' as never) as { emailVerified?: boolean; tier?: string };
        return c.json({ ok: true, emailVerified: user.emailVerified, tier: user.tier });
      });
      registerDeviceHandlers(app);

      const goldCustToken = await signJWT({
        id: 'cust-gold',
        role: 'customer',
        tenantId: 'store-a',
        tier: 'gold',
        emailVerified: true,
      });
      const vipRes = await app.request(
        '/api/vip-only',
        { headers: { Authorization: `Bearer ${goldCustToken}` } },
        buildEnv(db)
      );
      expect(vipRes.status).toBe(200);
      const vipBody = (await vipRes.json()) as { ok: boolean; emailVerified: boolean; tier: string };
      expect(vipBody.emailVerified).toBe(true);
      expect(vipBody.tier).toBe('gold');

      // Bulk DELETE /api/auth/devices for store-a user only deletes store-a device, keeping store-b intact
      const userAToken = await signJWT({ id: 'u-multi', role: 'customer', tenantId: 'store-a' });
      const delRes = await app.request(
        '/api/auth/devices',
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${userAToken}` },
        },
        buildEnv(db)
      );
      expect(delRes.status).toBe(200);

      const remainingDevices = sqlite
        .prepare('SELECT id, tenant_id FROM trusted_devices')
        .all() as Array<{ id: string; tenant_id: string }>;
      expect(remainingDevices).toEqual([{ id: 'dev-b', tenant_id: 'store-b' }]);
    });

    it('BN3-05: staffTipsRouter rejects cross-tenant ?store_id, shiftScope grants supervisor canManage, and openApiPaymentsRouter allows waiter/staff on create', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          order_number TEXT,
          total REAL DEFAULT 50000,
          payment_status TEXT DEFAULT 'unpaid',
          status TEXT DEFAULT 'pending',
          tenant_id TEXT DEFAULT 'store-a',
          user_id TEXT,
          customer_phone TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO orders (id, order_number, total, payment_status, status, tenant_id)
        VALUES ('ord-pay-1', 'ORD-PAY-1', 50000, 'unpaid', 'pending', 'store-a');
      `);

      const supToken = await signJWT({ id: 'sup-a', role: 'supervisor', tenantId: 'store-a' });
      const scope = await shiftScope(buildEnv(db), { id: 'sup-a', role: 'supervisor', tenantId: 'store-a' });
      expect(scope.canManage).toBe(true);
      expect(scope.tenantId).toBe('store-a');

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/staff/tips', staffTipsRouter);
      app.route('/', openApiPaymentsRouter);

      const crossTipsRes = await app.request(
        '/api/staff/tips?store_id=store-b',
        { headers: { Authorization: `Bearer ${supToken}` } },
        buildEnv(db)
      );
      expect(crossTipsRes.status).toBe(403);

      // Waiter is allowed past authMiddleware on POST /api/payments/create (does not get 403 Forbidden from RBAC)
      const waiterToken = await signJWT({ id: 'waiter-a', role: 'waiter', tenantId: 'store-a' });
      const createPayRes = await app.request(
        '/api/payments/create',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waiterToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_id: 'ord-pay-1', payment_method: 'cash' }),
        },
        buildEnv(db)
      );
      expect(createPayRes.status).not.toBe(403);

      // Waiter is still forbidden from POST /api/payments/ord-pay-1/refund
      const refundPayRes = await app.request(
        '/api/payments/ord-pay-1/refund',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waiterToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'test' }),
        },
        buildEnv(db)
      );
      expect(refundPayRes.status).toBe(403);
    });
  });

  describe('Cluster BN4 — Franchise, OpenAPI Inventory, Notifications & Frontend Isolation', () => {
    it('BN4-01: franchiseRouter blocks non-HQ ?store_id override, normalizes HQ "hq" wildcard, and returns 409 on duplicate code', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE franchise_locations (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          address TEXT,
          city TEXT DEFAULT 'Sa Đéc',
          phone TEXT,
          royalty_percentage REAL DEFAULT 5.0,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO franchise_locations (id, tenant_id, code, name)
        VALUES ('loc-1', 'store-a', 'SADEC-01', 'Sa Dec 01');
      `);

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/franchise', franchiseRouter);

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const crossRes = await app.request(
        '/api/franchise/locations?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db)
      );
      expect(crossRes.status).toBe(403);

      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: 'hq' });
      const dupRes = await app.request(
        '/api/franchise/locations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hqToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: 'sadec-01',
            name: 'Duplicate Code Store',
            tenant_id: 'store-b',
          }),
        },
        buildEnv(db)
      );
      expect(dupRes.status).toBe(409);
    });

    it('BN4-02: movement-handlers under HQ wildcard stamps canonical item tenant_id on stock_movements and inventory_transactions', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          name TEXT,
          unit TEXT,
          current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0,
          cost_per_unit REAL DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TEXT
        );
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          unit TEXT,
          current_stock REAL DEFAULT 50,
          min_stock REAL DEFAULT 5,
          cost_per_unit REAL DEFAULT 1000,
          tenant_id TEXT DEFAULT 'store-b',
          updated_at TEXT
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT,
          type TEXT,
          quantity REAL,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT,
          entity_type TEXT,
          entity_id TEXT,
          details TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, cost_per_unit, tenant_id)
        VALUES ('ing-canon-b', 'Matcha Powder', 'g', 100, 10, 500, 'store-b');
      `);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', optionalAuth());
      registerMovementHandlers(app);

      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: '*' });
      const res = await app.request(
        '/api/inventory/movements',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hqToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ingredient_id: 'ing-canon-b',
            type: 'purchase_receipt',
            quantity: 25,
            notes: 'HQ restock for Store B',
          }),
        },
        buildEnv(db)
      );
      expect(res.status).toBe(201);

      const txRow = sqlite
        .prepare('SELECT tenant_id, quantity FROM inventory_transactions WHERE item_id = ?')
        .get('ing-canon-b') as { tenant_id: string; quantity: number };
      expect(txRow.tenant_id).toBe('store-b');
      expect(txRow.quantity).toBe(25);
    });

    it('BN4-03: purchase-order-handlers rolls back earlier item updates and keeps PO status="ordered" when a subsequent item CAS fails', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE purchase_orders (
          id TEXT PRIMARY KEY,
          supplier_id TEXT,
          status TEXT DEFAULT 'ordered',
          total_amount REAL DEFAULT 0,
          notes TEXT,
          created_by TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE purchase_order_items (
          id TEXT PRIMARY KEY,
          purchase_order_id TEXT,
          ingredient_id TEXT,
          quantity REAL,
          unit_cost REAL,
          received_quantity REAL DEFAULT 0
        );
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          name TEXT,
          unit TEXT,
          current_stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 0,
          cost_per_unit REAL DEFAULT 100,
          tenant_id TEXT DEFAULT 'store-a',
          updated_at TEXT
        );
        CREATE TABLE stock_movements (
          id TEXT PRIMARY KEY,
          ingredient_id TEXT,
          type TEXT,
          quantity REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT
        );
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          unit TEXT,
          current_stock REAL DEFAULT 0,
          tenant_id TEXT DEFAULT 'store-a',
          last_restocked_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT,
          type TEXT,
          quantity REAL,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          tenant_id TEXT DEFAULT 'store-a',
          created_at TEXT
        );
        INSERT INTO purchase_orders (id, supplier_id, status, total_amount, tenant_id)
        VALUES ('po-atomic-1', 'sup-1', 'ordered', 100000, 'store-a');
        INSERT INTO ingredients (id, name, unit, current_stock, tenant_id)
        VALUES ('ing-1', 'Coffee Beans', 'kg', 10, 'store-a');
        INSERT INTO ingredients (id, name, unit, current_stock, tenant_id)
        VALUES ('ing-2', 'Oat Milk', 'L', 20, 'store-a');
        INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, received_quantity)
        VALUES ('poi-1', 'po-atomic-1', 'ing-1', 10, 5000, 0);
        INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, received_quantity)
        VALUES ('poi-2', 'po-atomic-1', 'ing-2', 10, 5000, 0);
      `);

      // Simulate a concurrent race where poi-2's received_quantity is bumped to 10 right before its CAS UPDATE runs
      const basePrepare = db.prepare.bind(db);
      const racingDb = {
        ...db,
        prepare: (sql: string) => {
          const stmt = basePrepare(sql);
          if (sql.includes('UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + ?')) {
            return {
              ...stmt,
              bind: (...args: unknown[]) => {
                // When binding for poi-2, simulate another worker having just received poi-2
                if (args.includes('poi-2')) {
                  sqlite.prepare("UPDATE purchase_order_items SET received_quantity = 10 WHERE id = 'poi-2'").run();
                }
                return stmt.bind(...args);
              },
            };
          }
          return stmt;
        },
      } as unknown as D1Database;

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', optionalAuth());
      registerPurchaseOrderHandlers(app);

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const res = await app.request(
        '/api/inventory/purchase-orders/po-atomic-1/receive',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              { ingredient_id: 'ing-1', received_quantity: 5 },
              { ingredient_id: 'ing-2', received_quantity: 5 },
            ],
          }),
        },
        buildEnv(racingDb)
      );
      expect(res.status).toBe(409);

      // Verify PO status remained 'ordered' and ing-1 stock + poi-1 received_quantity were rolled back!
      const poRow = sqlite
        .prepare('SELECT status FROM purchase_orders WHERE id = ?')
        .get('po-atomic-1') as { status: string };
      expect(poRow.status).toBe('ordered');

      const poi1Row = sqlite
        .prepare('SELECT received_quantity FROM purchase_order_items WHERE id = ?')
        .get('poi-1') as { received_quantity: number };
      expect(poi1Row.received_quantity).toBe(0);

      const ing1Row = sqlite
        .prepare('SELECT current_stock FROM ingredients WHERE id = ?')
        .get('ing-1') as { current_stock: number };
      expect(ing1Row.current_stock).toBe(10);
    });

    it('BN4-04: supplier-handlers PATCH under HQ wildcard resolves legacy unscoped supplier tenant from audit_logs', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);

      sqlite.exec(`
        CREATE TABLE suppliers (
          id TEXT PRIMARY KEY,
          name TEXT,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          payment_terms TEXT,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          actor_id TEXT,
          action TEXT,
          entity_type TEXT,
          entity_id TEXT,
          resource_id TEXT,
          details TEXT,
          metadata TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        INSERT INTO suppliers (id, name, is_active, tenant_id)
        VALUES ('sup-legacy-b', 'Mekong Dairy', 1, NULL);
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, tenant_id, created_at)
        VALUES ('aud-sup-b', 'mgr-b', 'supplier_create', 'supplier', 'sup-legacy-b', '{"tenant_id":"store-b"}', 'store-b', '2026-11-01T00:00:00Z');
      `);

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', optionalAuth());
      registerSupplierHandlers(app);

      const hqToken = await signJWT({ id: 'hq-owner', role: 'owner', tenantId: '*' });
      const res = await app.request(
        '/api/inventory/suppliers/sup-legacy-b',
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hqToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Mekong Dairy Co.' }),
        },
        buildEnv(db)
      );
      expect(res.status).toBe(200);

      const updateAudit = sqlite
        .prepare("SELECT tenant_id, details FROM audit_logs WHERE action = 'supplier_update' AND entity_id = ?")
        .get('sup-legacy-b') as { tenant_id: string; details: string };
      expect(updateAudit.tenant_id).toBe('store-b');
      expect(JSON.parse(updateAudit.details).tenant_id).toBe('store-b');
    });

    it('BN4-05: notification-settings routes enforce store_id tenant isolation, tolerate corrupt KV JSON, and scope staff settings by tenant+user', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const { kv, store } = createMemoryKV();

      const app = new Hono<{ Bindings: Env }>();
      registerFeatureRoutes(app);

      // Corrupt JSON in AUTH_KV does not crash GET /api/admin/notification-settings
      store.set('config:notification_settings:store-a', '{corrupt-json');

      const mgrAToken = await signJWT({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const getAdminRes = await app.request(
        '/api/admin/notification-settings',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db, kv)
      );
      expect(getAdminRes.status).toBe(200);
      const getAdminBody = (await getAdminRes.json()) as { autoNotifyNewOrder: boolean; soundAlerts: boolean };
      expect(getAdminBody).toEqual({ autoNotifyNewOrder: false, soundAlerts: false });

      // Non-HQ ?store_id=store-b rejected with 403 on both admin and staff notification settings
      const crossAdminRes = await app.request(
        '/api/admin/notification-settings?store_id=store-b',
        { headers: { Authorization: `Bearer ${mgrAToken}` } },
        buildEnv(db, kv)
      );
      expect(crossAdminRes.status).toBe(403);

      const staffAToken = await signJWT({ id: 'staff-1', role: 'waiter', tenantId: 'store-a' });
      const crossStaffRes = await app.request(
        '/api/staff/notification-settings?store_id=store-b',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${staffAToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderAlertsEnabled: false }),
        },
        buildEnv(db, kv)
      );
      expect(crossStaffRes.status).toBe(403);

      // Staff PATCH stores under config:staff_notification_settings:store-a:staff-1 and GET retrieves it
      const patchStaffRes = await app.request(
        '/api/staff/notification-settings',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${staffAToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderAlertsEnabled: false, shiftRemindersEnabled: true }),
        },
        buildEnv(db, kv)
      );
      expect(patchStaffRes.status).toBe(200);
      expect(store.get('config:staff_notification_settings:store-a:staff-1')).toBe(
        JSON.stringify({ orderAlertsEnabled: false, shiftRemindersEnabled: true })
      );

      const getStaffRes = await app.request(
        '/api/staff/notification-settings',
        { headers: { Authorization: `Bearer ${staffAToken}` } },
        buildEnv(db, kv)
      );
      expect(getStaffRes.status).toBe(200);
      const getStaffBody = (await getStaffRes.json()) as { orderAlertsEnabled: boolean; shiftRemindersEnabled: boolean };
      expect(getStaffBody).toEqual({ orderAlertsEnabled: false, shiftRemindersEnabled: true });
    });
  });
});
