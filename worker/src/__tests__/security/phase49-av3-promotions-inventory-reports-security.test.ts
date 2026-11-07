// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { createMockEnv } from '../test-utils';
import promotionsRouter from '../../routes/promotions';
import { registerCrudHandlers } from '../../routes/openapi-promotions-handlers/crud-handlers';
import { registerIngredientHandlers } from '../../routes/openapi-inventory-handlers/ingredient-handlers';
import { registerMovementHandlers } from '../../routes/openapi-inventory-handlers/movement-handlers';
import { registerSupplierHandlers } from '../../routes/openapi-inventory-handlers/supplier-handlers';
import { registerPurchaseOrderHandlers } from '../../routes/openapi-inventory-handlers/purchase-order-handlers';
import { registerAnalyticsHandlers } from '../../routes/reports-handlers/analytics-handlers';
import { registerExportHandlers } from '../../routes/reports-handlers/export-handlers';

type TestUser = { id: string; role: string; tenantId?: string; phone?: string } | null;

function createSqliteD1(): import('@cloudflare/workers-types').D1Database {
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
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      loyalty_tier TEXT DEFAULT 'bronze',
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'cash',
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      promo_code TEXT,
      total REAL DEFAULT 0,
      items TEXT DEFAULT '[]',
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE checkins (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      reward_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'approved',
      created_at TEXT
    );
    CREATE TABLE cashback_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      type TEXT DEFAULT 'earn',
      amount REAL DEFAULT 0,
      created_at TEXT
    );
    CREATE TABLE promotions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      min_order INTEGER DEFAULT 0,
      max_discount INTEGER,
      usage_limit INTEGER,
      usage_count INTEGER DEFAULT 0,
      per_user_limit INTEGER DEFAULT 1,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      applicable_items TEXT,
      applicable_categories TEXT,
      customer_tiers TEXT,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE promotion_usages (
      id TEXT PRIMARY KEY,
      promotion_id TEXT NOT NULL,
      customer_id TEXT,
      order_id TEXT NOT NULL,
      discount_amount REAL NOT NULL,
      tenant_id TEXT DEFAULT 'default',
      used_at TEXT NOT NULL
    );
    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      payment_terms INTEGER DEFAULT 30,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE ingredients (
      id TEXT PRIMARY KEY,
      sku TEXT,
      code TEXT,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT NOT NULL,
      cost_per_unit REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      quantity REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      max_stock REAL,
      is_active INTEGER DEFAULT 1,
      location_id TEXT,
      supplier_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE inventory_items (
      id TEXT PRIMARY KEY,
      sku TEXT,
      name TEXT,
      category TEXT,
      unit TEXT,
      current_stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      tenant_id TEXT DEFAULT 'default',
      last_restocked_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE stock_movements (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL,
      type TEXT,
      movement_type TEXT,
      quantity REAL NOT NULL,
      unit_cost REAL,
      total_cost REAL,
      previous_qty REAL DEFAULT 0,
      new_qty REAL DEFAULT 0,
      reference_type TEXT,
      reference_id TEXT,
      notes TEXT,
      created_by TEXT,
      performed_by TEXT,
      created_at TEXT
    );
    CREATE TABLE purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT,
      order_number TEXT,
      supplier_id TEXT NOT NULL,
      order_date TEXT,
      expected_date TEXT,
      expected_delivery_date TEXT,
      received_date TEXT,
      status TEXT DEFAULT 'draft',
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      shipping REAL DEFAULT 0,
      total REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      approved_by TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE purchase_order_items (
      id TEXT PRIMARY KEY,
      purchase_order_id TEXT NOT NULL,
      po_id TEXT,
      ingredient_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      received_quantity REAL DEFAULT 0,
      created_at TEXT
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      actor_name TEXT,
      user_id TEXT,
      action TEXT,
      resource_type TEXT,
      resource_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      details TEXT,
      metadata TEXT,
      created_at TEXT
    );
  `);

  const prepare = (sql: string) => {
    let boundArgs: unknown[] = [];
    const normalizeArg = (v: unknown): string | number | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'number' || typeof v === 'string') return v;
      return JSON.stringify(v);
    };
    const stmtObj = {
      bind(...args: unknown[]) {
        boundArgs = args.map(normalizeArg);
        return stmtObj;
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const res = stmt.run(...(boundArgs as Array<string | number | null>));
        const changes = Number(res.changes ?? 0);
        return {
          success: true,
          changes,
          meta: { changes, last_row_id: Number(res.lastInsertRowid ?? 0) },
        };
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...(boundArgs as Array<string | number | null>)) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return ({ ...row } as unknown) as T;
      },
      async all<T = unknown>() {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...(boundArgs as Array<string | number | null>)) as Array<Record<string, unknown>>;
        return {
          results: rows.map((r) => ({ ...r })) as T[],
          success: true,
          meta: {},
        };
      },
      async raw() {
        return [];
      },
    };
    return stmtObj as unknown as import('@cloudflare/workers-types').D1PreparedStatement;
  };

  return {
    prepare,
    batch: async (stmts: import('@cloudflare/workers-types').D1PreparedStatement[]) => {
      const out = [];
      for (const s of stmts) {
        out.push(await (s as unknown as { run: () => Promise<unknown> }).run());
      }
      return out as import('@cloudflare/workers-types').D1Result[];
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new Uint8Array(),
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function buildPromotionsApp(user: TestUser, tenantHeader?: string, customerId?: string) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    if (user) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('user', user);
    }
    if (customerId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('customerId', customerId);
    }
    if (tenantHeader) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', tenantHeader);
    } else if (user?.tenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', user.tenantId);
    }
    await next();
  });
  app.route('/api/promotions', promotionsRouter);
  return app;
}

function buildOpenApiPromotionsApp(user: TestUser, ctxTenantId?: string) {
  const app = new OpenAPIHono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    if (user) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('user', user);
    }
    if (ctxTenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', ctxTenantId);
    } else if (user?.tenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', user.tenantId);
    }
    await next();
  });
  registerCrudHandlers(app);
  return app;
}

function buildOpenApiInventoryApp(user: TestUser, ctxTenantId?: string) {
  const app = new OpenAPIHono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    if (user) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('user', user);
    }
    if (ctxTenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', ctxTenantId);
    } else if (user?.tenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', user.tenantId);
    }
    await next();
  });
  registerIngredientHandlers(app);
  registerMovementHandlers(app);
  registerSupplierHandlers(app);
  registerPurchaseOrderHandlers(app);
  return app;
}

function buildReportsApp(user: TestUser, ctxTenantId?: string) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    if (user) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('user', user);
    }
    if (ctxTenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', ctxTenantId);
    } else if (user?.tenantId) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', user.tenantId);
    }
    await next();
  });
  const sub = new Hono<{ Bindings: Env }>();
  registerAnalyticsHandlers(sub);
  registerExportHandlers(sub);
  app.route('/api/reports', sub);
  return app;
}

describe('Phase 49 Slice AV3: Promotions, OpenAPI Inventory & Analytics/Export Reports Security', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv({ AURA_DB: createSqliteD1() }) as unknown as Env;
  });

  describe('1. Promotion Redemption Order State, Customer Ownership & Staff Tenant Binding', () => {
    beforeEach(async () => {
      const now = new Date();
      const start = new Date(now.getTime() - 86400000).toISOString();
      const end = new Date(now.getTime() + 86400000).toISOString();

      await env.AURA_DB.prepare(
        `INSERT INTO promotions (id, code, name, type, value, min_order, is_active, start_date, end_date, tenant_id)
         VALUES ('promo_a', 'SAVE20', 'Save 20%', 'percentage', 20, 10000, 1, ?, ?, 'tenant_a')`
      ).bind(start, end).run();
    });

    it('rejects redemption on cancelled, completed, or already-paid orders with 409', async () => {
      await env.AURA_DB.prepare(
        `INSERT INTO orders (id, status, payment_status, subtotal, total, customer_id, tenant_id, items, created_at)
         VALUES
           ('ord_cancelled', 'cancelled', 'pending', 100000, 100000, 'cust_1', 'tenant_a', '[]', datetime('now')),
           ('ord_completed', 'completed', 'pending', 100000, 100000, 'cust_1', 'tenant_a', '[]', datetime('now')),
           ('ord_paid', 'pending', 'paid', 100000, 100000, 'cust_1', 'tenant_a', '[]', datetime('now'))`
      ).run();

      const app = buildPromotionsApp(
        { id: 'staff_a', role: 'cashier', tenantId: 'tenant_a' },
        'tenant_a'
      );

      for (const orderId of ['ord_cancelled', 'ord_completed', 'ord_paid']) {
        const res = await app.request(
          '/api/promotions/redeem',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
            body: JSON.stringify({ code: 'SAVE20', order_id: orderId, order_total: 100000 }),
          },
          env
        );
        expect(res.status).toBe(409);
      }
    });

    it('rejects unauthenticated or third-party customer redeeming another customer order with 403', async () => {
      await env.AURA_DB.prepare(
        `INSERT INTO orders (id, status, payment_status, subtotal, total, customer_id, customer_phone, tenant_id, items, created_at)
         VALUES ('ord_cust1', 'pending', 'pending', 100000, 100000, 'cust_owner', '0901112222', 'tenant_a', '[]', datetime('now'))`
      ).run();

      const anonApp = buildPromotionsApp(null, 'tenant_a');
      const anonRes = await anonApp.request(
        '/api/promotions/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            code: 'SAVE20',
            order_id: 'ord_cust1',
            order_total: 100000,
            customer_id: 'cust_owner',
          }),
        },
        env
      );
      expect(anonRes.status).toBe(403);

      const otherCustApp = buildPromotionsApp(
        { id: 'cust_attacker', role: 'customer', tenantId: 'tenant_a' },
        'tenant_a',
        'cust_attacker'
      );
      const otherRes = await otherCustApp.request(
        '/api/promotions/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            code: 'SAVE20',
            order_id: 'ord_cust1',
            order_total: 100000,
            customer_id: 'cust_owner',
          }),
        },
        env
      );
      expect(otherRes.status).toBe(403);

      const ownerCustApp = buildPromotionsApp(
        { id: 'cust_owner', role: 'customer', tenantId: 'tenant_a' },
        'tenant_a',
        'cust_owner'
      );
      const okRes = await ownerCustApp.request(
        '/api/promotions/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            code: 'SAVE20',
            order_id: 'ord_cust1',
            order_total: 100000,
          }),
        },
        env
      );
      expect(okRes.status).toBe(200);
    });

    it('rejects cross-tenant staff redeeming another tenant order with 403', async () => {
      await env.AURA_DB.prepare(
        `INSERT INTO orders (id, status, payment_status, subtotal, total, customer_id, tenant_id, items, created_at)
         VALUES ('ord_tenant_a', 'pending', 'pending', 100000, 100000, 'cust_1', 'tenant_a', '[]', datetime('now'))`
      ).run();

      const crossStaffApp = buildPromotionsApp(
        { id: 'staff_b', role: 'cashier', tenantId: 'tenant_b' },
        'tenant_a'
      );
      const res = await crossStaffApp.request(
        '/api/promotions/redeem',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({ code: 'SAVE20', order_id: 'ord_tenant_a', order_total: 100000 }),
        },
        env
      );
      expect(res.status).toBe(403);
    });
  });

  describe('2. Promotion Admin & OpenAPI Promotions RBAC, Tenant Binding & SQL Precedence', () => {
    beforeEach(async () => {
      const now = new Date().toISOString();
      await env.AURA_DB.prepare(
        `INSERT INTO promotions (id, code, name, type, value, is_active, start_date, end_date, tenant_id, created_at, updated_at)
         VALUES
           ('promo_ta', 'SHAREDCODE', 'Tenant A Promo', 'percentage', 10, 1, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'tenant_a', ?, ?),
           ('promo_tb', 'SHAREDCODE', 'Tenant B Promo', 'percentage', 25, 1, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'tenant_b', ?, ?)`
      ).bind(now, now, now, now).run();
    });

    it('rejects supervisor on promotion mutations and cross-tenant user.tenantId on admin and OpenAPI routes', async () => {
      const supAdminApp = buildPromotionsApp({ id: 'sup_1', role: 'supervisor', tenantId: 'tenant_a' }, 'tenant_a');
      const patchRes = await supAdminApp.request(
        '/api/promotions/promo_ta',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({ name: 'Supervisor Hack' }),
        },
        env
      );
      expect(patchRes.status).toBe(403);

      const delRes = await supAdminApp.request(
        '/api/promotions/promo_ta',
        { method: 'DELETE', headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(delRes.status).toBe(403);

      const crossAdminApp = buildPromotionsApp({ id: 'mgr_b', role: 'manager', tenantId: 'tenant_b' }, 'tenant_a');
      const listCrossRes = await crossAdminApp.request(
        '/api/promotions',
        { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(listCrossRes.status).toBe(403);

      const supOpenApiApp = buildOpenApiPromotionsApp({ id: 'sup_1', role: 'supervisor', tenantId: 'tenant_a' }, 'tenant_a');
      const oaPatchRes = await supOpenApiApp.request(
        '/api/promotions/promo_ta',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({ name: 'Supervisor OA Hack' }),
        },
        env
      );
      expect(oaPatchRes.status).toBe(403);

      const oaDelRes = await supOpenApiApp.request(
        '/api/promotions/promo_ta',
        { method: 'DELETE', headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(oaDelRes.status).toBe(403);
    });

    it('prevents SQL WHERE (id = ? OR code = ?) precedence leak from updating or deleting another tenant promo and prevents empty-tenant GET fallback leak', async () => {
      const mgrBApp = buildPromotionsApp({ id: 'mgr_b', role: 'manager', tenantId: 'tenant_b' }, 'tenant_b');
      const patchRes = await mgrBApp.request(
        '/api/promotions/SHAREDCODE',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_b' },
          body: JSON.stringify({ name: 'Updated By Tenant B', value: 50 }),
        },
        env
      );
      expect(patchRes.status).toBe(200);

      const promoA = await env.AURA_DB.prepare('SELECT name, value, is_active FROM promotions WHERE id = ?')
        .bind('promo_ta')
        .first<{ name: string; value: number; is_active: number }>();
      expect(promoA?.name).toBe('Tenant A Promo');
      expect(promoA?.value).toBe(10);

      const oaMgrBApp = buildOpenApiPromotionsApp({ id: 'mgr_b', role: 'manager', tenantId: 'tenant_b' }, 'tenant_b');
      const oaDelRes = await oaMgrBApp.request(
        '/api/promotions/SHAREDCODE',
        { method: 'DELETE', headers: { 'X-Tenant-ID': 'tenant_b' } },
        env
      );
      expect(oaDelRes.status).toBe(200);

      const promoAAfterDel = await env.AURA_DB.prepare('SELECT is_active FROM promotions WHERE id = ?')
        .bind('promo_ta')
        .first<{ is_active: number }>();
      expect(promoAAfterDel?.is_active).toBe(1);

      const mgrCApp = buildPromotionsApp({ id: 'mgr_c', role: 'manager', tenantId: 'tenant_c' }, 'tenant_c');
      const emptyListRes = await mgrCApp.request(
        '/api/promotions',
        { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_c' } },
        env
      );
      expect(emptyListRes.status).toBe(200);
      const emptyBody = (await emptyListRes.json()) as { promotions: unknown[] };
      expect(emptyBody.promotions).toEqual([]);
    });
  });

  describe('3. OpenAPI Inventory RBAC & Tenant Isolation Across Movements, POs, Ingredients & Suppliers', () => {
    it('rejects unauthenticated (401), supervisor on mutations (403), and cross-tenant user.tenantId (403)', async () => {
      const anonApp = buildOpenApiInventoryApp(null, 'tenant_a');
      const supApp = buildOpenApiInventoryApp({ id: 'sup_1', role: 'supervisor', tenantId: 'tenant_a' }, 'tenant_a');
      const crossApp = buildOpenApiInventoryApp({ id: 'mgr_b', role: 'manager', tenantId: 'tenant_b' }, 'tenant_a');

      const mutationRequests: Array<{ path: string; method: string; body: Record<string, unknown> }> = [
        {
          path: '/api/inventory/movements',
          method: 'POST',
          body: { ingredientId: 'ing_1', type: 'in', quantity: 5 },
        },
        {
          path: '/api/inventory/purchase-orders',
          method: 'POST',
          body: {
            supplierId: 'sup_a',
            locationId: 'loc_1',
            items: [{ ingredientId: 'ing_1', quantity: 10, unitCost: 1000 }],
          },
        },
        {
          path: '/api/inventory/purchase-orders/po_1',
          method: 'PATCH',
          body: { status: 'ordered' },
        },
        {
          path: '/api/inventory/purchase-orders/po_1/receive',
          method: 'POST',
          body: { items: [{ ingredientId: 'ing_1', receivedQuantity: 5 }] },
        },
        {
          path: '/api/inventory/ingredients',
          method: 'POST',
          body: {
            sku: 'ING-01',
            name: 'Coffee Beans',
            category: 'beans',
            unit: 'kg',
            costPerUnit: 200000,
          },
        },
        {
          path: '/api/inventory/ingredients/ing_1',
          method: 'PATCH',
          body: { name: 'Updated Beans' },
        },
        {
          path: '/api/inventory/ingredients/ing_1',
          method: 'DELETE',
          body: {},
        },
        {
          path: '/api/inventory/suppliers',
          method: 'POST',
          body: { name: 'Roastery Co' },
        },
        {
          path: '/api/inventory/suppliers/sup_a',
          method: 'PATCH',
          body: { name: 'Updated Roastery' },
        },
      ];

      for (const reqSpec of mutationRequests) {
        const init: RequestInit = {
          method: reqSpec.method,
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: reqSpec.method !== 'DELETE' ? JSON.stringify(reqSpec.body) : undefined,
        };

        const r401 = await anonApp.request(reqSpec.path, init, env);
        expect(r401.status).toBe(401);

        const r403Sup = await supApp.request(reqSpec.path, init, env);
        expect(r403Sup.status).toBe(403);

        const r403Cross = await crossApp.request(reqSpec.path, init, env);
        expect(r403Cross.status).toBe(403);
      }
    });
  });

  describe('4. Purchase Order Supplier Validation & Cumulative Partial Receipt Integrity', () => {
    it('returns 404 when creating or updating a PO with a non-existent supplier and accumulates partial receipts accurately', async () => {
      const mgrApp = buildOpenApiInventoryApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' }, 'tenant_a');

      const missingSupRes = await mgrApp.request(
        '/api/inventory/purchase-orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            supplierId: 'sup_non_existent',
            locationId: 'loc_1',
            items: [{ ingredientId: 'ing_1', quantity: 10, unitCost: 5000 }],
          }),
        },
        env
      );
      expect(missingSupRes.status).toBe(404);

      const supRes = await mgrApp.request(
        '/api/inventory/suppliers',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({ name: 'DaLat Arabica Supplier' }),
        },
        env
      );
      expect(supRes.status).toBe(201);
      const supData = (await supRes.json()) as { data: { id: string } };
      const supplierId = supData.data.id;

      const ingRes = await mgrApp.request(
        '/api/inventory/ingredients',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            sku: 'ARA-01',
            name: 'Arabica Beans',
            category: 'coffee',
            unit: 'kg',
            currentStock: 0,
            costPerUnit: 150000,
            supplierId,
          }),
        },
        env
      );
      expect(ingRes.status).toBe(201);
      const ingData = (await ingRes.json()) as { data: { id: string } };
      const ingredientId = ingData.data.id;

      const poRes = await mgrApp.request(
        '/api/inventory/purchase-orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            supplierId,
            locationId: 'loc_1',
            items: [{ ingredientId, quantity: 10, unitCost: 150000 }],
          }),
        },
        env
      );
      expect(poRes.status).toBe(201);
      const poBody = (await poRes.json()) as {
        data: { id: string; status: string };
      };
      const poId = poBody.data.id;

      // First partial receipt of 4 kg -> status must be partially_received, received_quantity = 4
      const firstRecRes = await mgrApp.request(
        `/api/inventory/purchase-orders/${poId}/receive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({ items: [{ ingredientId, receivedQuantity: 4 }] }),
        },
        env
      );
      expect(firstRecRes.status).toBe(200);
      const firstRecBody = (await firstRecRes.json()) as {
        data: { status: string; items: Array<{ received_quantity: number }> };
      };
      expect(firstRecBody.data.status).toBe('partially_received');
      expect(Number(firstRecBody.data.items[0].received_quantity)).toBe(4);

      // Second receipt of remaining 6 kg -> cumulative received_quantity = 10, status = received
      const secondRecRes = await mgrApp.request(
        `/api/inventory/purchase-orders/${poId}/receive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({ items: [{ ingredientId, receivedQuantity: 6 }] }),
        },
        env
      );
      expect(secondRecRes.status).toBe(200);
      const secondRecBody = (await secondRecRes.json()) as {
        data: { status: string; items: Array<{ received_quantity: number }> };
      };
      expect(secondRecBody.data.status).toBe('received');
      expect(Number(secondRecBody.data.items[0].received_quantity)).toBe(10);
    });
  });

  describe('5. Reports RBAC, Tenant Isolation, Refunded/Failed Exclusion & CSV Formula Neutralization', () => {
    const today = new Date().toISOString().slice(0, 10);

    beforeEach(async () => {
      await env.AURA_DB.prepare(
        `INSERT INTO customers (id, name, email, phone, loyalty_tier, tenant_id, created_at)
         VALUES ('cust_rep_1', '=CMD()|\n+SUM(1,2)', ' pipe@example.com', '0909000111', 'gold', 'tenant_a', ?)`
      ).bind(`${today}T08:00:00.000Z`).run();

      await env.AURA_DB.prepare(
        `INSERT INTO orders (id, customer_id, customer_name, customer_phone, status, payment_status, subtotal, total, items, tenant_id, created_at)
         VALUES
           ('ord_valid', 'cust_rep_1', '|calc', 'line1\n=2+2', 'completed', 'paid', 120000, 120000, '[{"name":"Latte","qty":2,"price":60000}]', 'tenant_a', ?),
           ('ord_refunded_status', 'cust_rep_1', 'Customer', '0909000111', 'refunded', 'refunded', 500000, 500000, '[{"name":"Latte","qty":5,"price":100000}]', 'tenant_a', ?),
           ('ord_refunded_pay', 'cust_rep_1', 'Customer', '0909000111', 'completed', 'refunded', 300000, 300000, '[{"name":"Espresso","qty":3,"price":100000}]', 'tenant_a', ?),
           ('ord_failed', 'cust_rep_1', 'Customer', '0909000111', 'failed', 'failed', 250000, 250000, '[{"name":"Mocha","qty":2,"price":125000}]', 'tenant_a', ?)`
      ).bind(
        `${today}T09:00:00.000Z`,
        `${today}T10:00:00.000Z`,
        `${today}T11:00:00.000Z`,
        `${today}T12:00:00.000Z`
      ).run();
    });

    it('rejects unauthenticated (401), non-staff (403), supervisor on /export (403), and cross-tenant user.tenantId (403)', async () => {
      const anonApp = buildReportsApp(null, 'tenant_a');
      const customerApp = buildReportsApp({ id: 'cust_1', role: 'customer', tenantId: 'tenant_a' }, 'tenant_a');
      const crossMgrApp = buildReportsApp({ id: 'mgr_b', role: 'manager', tenantId: 'tenant_b' }, 'tenant_a');
      const supApp = buildReportsApp({ id: 'sup_a', role: 'supervisor', tenantId: 'tenant_a' }, 'tenant_a');

      const endpoints = [
        `/api/reports/daily?from=${today}&to=${today}`,
        '/api/reports/summary',
        `/api/reports/orders?from=${today}&to=${today}`,
        `/api/reports/top-products?from=${today}&to=${today}`,
        `/api/reports/peak-hours?from=${today}&to=${today}`,
        '/api/reports/customer-metrics',
        `/api/reports/export?type=orders&from=${today}&to=${today}`,
      ];

      for (const ep of endpoints) {
        const r401 = await anonApp.request(ep, { headers: { 'X-Tenant-ID': 'tenant_a' } }, env);
        expect(r401.status).toBe(401);

        const r403Cust = await customerApp.request(ep, { headers: { 'X-Tenant-ID': 'tenant_a' } }, env);
        expect(r403Cust.status).toBe(403);

        const r403Cross = await crossMgrApp.request(ep, { headers: { 'X-Tenant-ID': 'tenant_a' } }, env);
        expect(r403Cross.status).toBe(403);
      }

      const supSummary = await supApp.request('/api/reports/summary', { headers: { 'X-Tenant-ID': 'tenant_a' } }, env);
      expect(supSummary.status).toBe(200);

      const supExport = await supApp.request(
        `/api/reports/export?type=orders&from=${today}&to=${today}`,
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(supExport.status).toBe(403);
    });

    it('excludes refunded and failed orders from daily, summary, top-products, peak-hours, customer-metrics, and exports', async () => {
      const mgrApp = buildReportsApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' }, 'tenant_a');

      const summaryRes = await mgrApp.request('/api/reports/summary', { headers: { 'X-Tenant-ID': 'tenant_a' } }, env);
      expect(summaryRes.status).toBe(200);
      const summaryBody = (await summaryRes.json()) as {
        data: { total_revenue: number; total_orders: number };
      };
      expect(summaryBody.data.total_revenue).toBe(120000);
      expect(summaryBody.data.total_orders).toBe(1);

      const dailyRes = await mgrApp.request(
        `/api/reports/daily?from=${today}&to=${today}`,
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(dailyRes.status).toBe(200);
      const dailyBody = (await dailyRes.json()) as {
        data: Array<{ date: string; orders: number; revenue: number }>;
      };
      expect(dailyBody.data[0].orders).toBe(1);
      expect(dailyBody.data[0].revenue).toBe(120000);

      const topProdRes = await mgrApp.request(
        `/api/reports/top-products?from=${today}&to=${today}`,
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(topProdRes.status).toBe(200);
      const topProdBody = (await topProdRes.json()) as {
        data: Array<{ name: string; qty: number; revenue: number }>;
      };
      expect(topProdBody.data).toEqual([{ name: 'Latte', qty: 2, revenue: 120000 }]);

      const custMetricsRes = await mgrApp.request(
        '/api/reports/customer-metrics',
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(custMetricsRes.status).toBe(200);
      const custMetricsBody = (await custMetricsRes.json()) as {
        data: { avg_spend_per_customer: number; repeat_rate: number };
      };
      expect(custMetricsBody.data.avg_spend_per_customer).toBe(120000);
      expect(custMetricsBody.data.repeat_rate).toBe(0);
    });

    it('neutralizes leading pipe (|) and multiline formula injection in CSV export cells', async () => {
      const mgrApp = buildReportsApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' }, 'tenant_a');

      const ordersCsvRes = await mgrApp.request(
        `/api/reports/export?type=orders&from=${today}&to=${today}`,
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(ordersCsvRes.status).toBe(200);
      const ordersCsvText = await ordersCsvRes.text();
      expect(ordersCsvText).toContain("'|calc");
      expect(ordersCsvText).toContain('"line1\n\'=2+2"');

      const custCsvRes = await mgrApp.request(
        `/api/reports/export?type=customers&from=${today}&to=${today}`,
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(custCsvRes.status).toBe(200);
      const custCsvText = await custCsvRes.text();
      expect(custCsvText).toContain('"\'=CMD()|\n\'+SUM(1,2)"');
      expect(custCsvText).toContain(',120000,1,gold,');
    });
  });
});
