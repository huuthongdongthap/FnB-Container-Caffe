// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { createMockEnv } from '../test-utils';
import { registerIngredientHandlers } from '../../routes/openapi-inventory-handlers/ingredient-handlers';
import { registerMovementHandlers } from '../../routes/openapi-inventory-handlers/movement-handlers';
import { registerSupplierHandlers } from '../../routes/openapi-inventory-handlers/supplier-handlers';
import { registerPurchaseOrderHandlers } from '../../routes/openapi-inventory-handlers/purchase-order-handlers';
import { inventoryCRUD } from '../../../../packages/domain/inventory/src/routes/inventory-crud';
import { inventorySnapshots } from '../../../../packages/domain/inventory/src/routes/inventory-snapshots';
import {
  getRecipeForProduct,
  deductIngredientsForOrder,
  deductOrderExperimentalBom,
} from '../../../../packages/domain/inventory/src/policies/bom-policy';

type TestUser = { id: string; role: string; tenantId?: string; tenant_id?: string } | null;

function createSqliteD1(options?: {
  omitIngredientTenantCol?: boolean;
  omitSupplierTenantCol?: boolean;
}): import('@cloudflare/workers-types').D1Database {
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
    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      payment_terms INTEGER DEFAULT 30,
      is_active INTEGER DEFAULT 1,
      ${options?.omitSupplierTenantCol ? '' : "tenant_id TEXT DEFAULT 'default',"}
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
      ${options?.omitIngredientTenantCol ? '' : "tenant_id TEXT DEFAULT 'default',"}
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE inventory_items (
      id TEXT PRIMARY KEY,
      sku TEXT,
      name TEXT,
      name_en TEXT,
      category TEXT,
      unit TEXT,
      current_stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      max_stock REAL DEFAULT 1000,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default',
      last_restocked_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE inventory_snapshots (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      date TEXT NOT NULL,
      opening_stock REAL DEFAULT 0,
      closing_stock REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default'
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
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
    CREATE TABLE inventory_transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      performed_by TEXT,
      tenant_id TEXT DEFAULT 'default',
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
    CREATE TABLE recipes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE recipe_items (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity REAL NOT NULL
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
    dump: async () => new ArrayBuffer(0),
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function buildOpenApiApp(user: TestUser) {
  const app = new OpenAPIHono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    if (user) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('user', user);
      if (user.tenantId) {
        (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', user.tenantId);
      }
    }
    const headerTenant = c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id') || c.req.query('tenant_id');
    if (headerTenant) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', headerTenant);
    }
    await next();
  });
  registerIngredientHandlers(app);
  registerMovementHandlers(app);
  registerSupplierHandlers(app);
  registerPurchaseOrderHandlers(app);
  return app;
}

function buildDomainInventoryApp(user: TestUser) {
  const app = new Hono<{ Bindings: { AURA_DB: any } }>();
  app.use('*', async (c, next) => {
    if (user) {
      (c as unknown as { set: (k: string, v: unknown) => void }).set('user', user);
    }
    await next();
  });
  inventoryCRUD(app as never);
  inventorySnapshots(app as never);
  return app;
}

describe('Phase 52 Slice AY1: OpenAPI Inventory Handlers & Domain Inventory Security', () => {
  let db: import('@cloudflare/workers-types').D1Database;
  let env: Env;

  beforeEach(() => {
    db = createSqliteD1();
    env = createMockEnv({ AURA_DB: db });
  });

  it('AY1-F1: populates total_cost alongside total_price, preserves unitCost=0, and rejects duplicate ingredientId lines in PO create/update', async () => {
    const app = buildOpenApiApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' });

    await db
      .prepare('INSERT INTO suppliers (id, name, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('sup_a', 'Supplier A', 'tenant_a')
      .run();
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, cost_per_unit, unit_cost, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_1', 'SKU-1', 'Coffee Beans', 'coffee', 'kg', 120000, 120000, 10, 'tenant_a')
      .run();
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, cost_per_unit, unit_cost, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_2', 'SKU-2', 'Promo Sample Syrup', 'syrup', 'l', 85000, 85000, 5, 'tenant_a')
      .run();

    // Duplicate ingredientId lines must be rejected with 400
    const dupRes = await app.request(
      '/api/inventory/purchase-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          supplierId: 'sup_a',
          locationId: 'loc_1',
          items: [
            { ingredientId: 'ing_1', quantity: 2, unitCost: 120000 },
            { ingredientId: 'ing_1', quantity: 3, unitCost: 120000 },
          ],
        }),
      },
      env
    );
    expect(dupRes.status).toBe(400);

    // unitCost: 0 must be preserved (0 total_cost), NOT overwritten with ingredient cost (85000)
    const createRes = await app.request(
      '/api/inventory/purchase-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          supplierId: 'sup_a',
          locationId: 'loc_1',
          items: [
            { ingredientId: 'ing_1', quantity: 2, unitCost: 120000 },
            { ingredientId: 'ing_2', quantity: 5, unitCost: 0 },
          ],
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: {
        id: string;
        total: number;
        total_amount: number;
        items: Array<{ ingredient_id: string; unit_cost: number; total_cost: number; total_price: number }>;
      };
    };
    expect(Number(created.data.total)).toBe(240000);
    expect(Number(created.data.total_amount)).toBe(240000);

    const item1 = created.data.items.find((i) => i.ingredient_id === 'ing_1')!;
    const item2 = created.data.items.find((i) => i.ingredient_id === 'ing_2')!;
    expect(Number(item1.unit_cost)).toBe(120000);
    expect(Number(item1.total_cost)).toBe(240000);
    expect(Number(item1.total_price)).toBe(240000);
    expect(Number(item2.unit_cost)).toBe(0);
    expect(Number(item2.total_cost)).toBe(0);
    expect(Number(item2.total_price)).toBe(0);

    // PATCH with duplicate ingredientId is also rejected
    const patchDupRes = await app.request(
      `/api/inventory/purchase-orders/${created.data.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          items: [
            { ingredientId: 'ing_1', quantity: 1, unitCost: 100000 },
            { ingredientId: 'ing_1', quantity: 4, unitCost: 100000 },
          ],
        }),
      },
      env
    );
    expect(patchDupRes.status).toBe(400);

    // PATCH with omitted unitCost falls back to ingredient cost (120000) while unitCost: 0 preserves 0
    const patchOkRes = await app.request(
      `/api/inventory/purchase-orders/${created.data.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          items: [
            { ingredientId: 'ing_1', quantity: 3 },
            { ingredientId: 'ing_2', quantity: 2, unitCost: 0 },
          ],
        }),
      },
      env
    );
    expect(patchOkRes.status).toBe(200);
    const patched = (await patchOkRes.json()) as {
      data: {
        total: number;
        items: Array<{ ingredient_id: string; unit_cost: number; total_cost: number }>;
      };
    };
    expect(Number(patched.data.total)).toBe(360000);
    const pItem1 = patched.data.items.find((i) => i.ingredient_id === 'ing_1')!;
    const pItem2 = patched.data.items.find((i) => i.ingredient_id === 'ing_2')!;
    expect(Number(pItem1.unit_cost)).toBe(120000);
    expect(Number(pItem1.total_cost)).toBe(360000);
    expect(Number(pItem2.unit_cost)).toBe(0);
    expect(Number(pItem2.total_cost)).toBe(0);
  });

  it('AY1-F2: blocks item replacement and cancellation/status rollback on partially_received POs while allowing notes updates', async () => {
    const app = buildOpenApiApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' });

    await db
      .prepare('INSERT INTO suppliers (id, name, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('sup_a', 'Supplier A', 'tenant_a')
      .run();
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, cost_per_unit, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_1', 'SKU-1', 'Milk', 'dairy', 'l', 30000, 0, 'tenant_a')
      .run();

    const poRes = await app.request(
      '/api/inventory/purchase-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          supplierId: 'sup_a',
          locationId: 'loc_1',
          items: [{ ingredientId: 'ing_1', quantity: 10, unitCost: 30000 }],
        }),
      },
      env
    );
    expect(poRes.status).toBe(201);
    const poId = ((await poRes.json()) as { data: { id: string } }).data.id;

    // Receive 4 of 10 -> status becomes partially_received
    const recRes = await app.request(
      `/api/inventory/purchase-orders/${poId}/receive`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          items: [{ ingredientId: 'ing_1', receivedQuantity: 4 }],
        }),
      },
      env
    );
    expect(recRes.status).toBe(200);

    // Attempt to replace items on partially_received PO -> 400
    const replaceItemsRes = await app.request(
      `/api/inventory/purchase-orders/${poId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          items: [{ ingredientId: 'ing_1', quantity: 10, unitCost: 30000 }],
        }),
      },
      env
    );
    expect(replaceItemsRes.status).toBe(400);

    // Attempt to cancel or revert status to draft on partially_received PO -> 400
    const cancelRes = await app.request(
      `/api/inventory/purchase-orders/${poId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({ status: 'cancelled' }),
      },
      env
    );
    expect(cancelRes.status).toBe(400);

    const draftRollbackRes = await app.request(
      `/api/inventory/purchase-orders/${poId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({ status: 'draft' }),
      },
      env
    );
    expect(draftRollbackRes.status).toBe(400);

    // Updating notes on partially_received PO is still allowed and preserves received_quantity = 4
    const notesRes = await app.request(
      `/api/inventory/purchase-orders/${poId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({ notes: 'Remaining 6L arriving tomorrow' }),
      },
      env
    );
    expect(notesRes.status).toBe(200);
    const notesBody = (await notesRes.json()) as {
      data: { notes: string; items: Array<{ received_quantity: number }> };
    };
    expect(notesBody.data.notes).toBe('Remaining 6L arriving tomorrow');
    expect(Number(notesBody.data.items[0].received_quantity)).toBe(4);
  });

  it('AY1-F3: fails closed on PO update/receive when tenant-scoped UPDATE fails for a non-default tenant', async () => {
    await db
      .prepare('INSERT INTO suppliers (id, name, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('sup_a', 'Supplier A', 'tenant_a')
      .run();
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, cost_per_unit, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_1', 'SKU-1', 'Matcha', 'tea', 'kg', 500000, 2, 'tenant_a')
      .run();
    await db
      .prepare(
        'INSERT INTO purchase_orders (id, po_number, supplier_id, status, total, total_amount, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind('po_a', 'PO-A1', 'sup_a', 'ordered', 500000, 500000, 'tenant_a')
      .run();
    await db
      .prepare(
        'INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity, unit_cost, total_cost, received_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
      )
      .bind('poi_1', 'po_a', 'po_a', 'ing_1', 1, 500000, 500000)
      .run();

    const executedSql: string[] = [];
    const basePrepare = db.prepare.bind(db);
    const wrappedDb = {
      ...db,
      prepare(sql: string) {
        executedSql.push(sql);
        if (
          sql.startsWith('UPDATE ingredients SET current_stock') &&
          sql.includes('tenant_id')
        ) {
          throw new Error('simulated D1 tenant_id column failure on UPDATE ingredients');
        }
        return basePrepare(sql);
      },
    } as unknown as import('@cloudflare/workers-types').D1Database;

    const app = buildOpenApiApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' });
    const recRes = await app.request(
      '/api/inventory/purchase-orders/po_a/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          items: [{ ingredientId: 'ing_1', receivedQuantity: 1 }],
        }),
      },
      createMockEnv({ AURA_DB: wrappedDb })
    );
    expect(recRes.status).toBe(500);
    // Must NOT have executed an unscoped UPDATE ingredients SET current_stock ... WHERE id = ?
    expect(
      executedSql.some(
        (s) => s.startsWith('UPDATE ingredients SET current_stock') && !s.includes('tenant_id')
      )
    ).toBe(false);
  });

  it('AY1-F4 & AY1-F5: movement list scopes joins, avoids cross-tenant fallback scan on empty tenant, rejects unverified ingredient_id, and movement create fails closed when ingredients lacks tenant_id', async () => {
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, cost_per_unit, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_b', 'SKU-B', 'Tenant B Cocoa', 'powder', 'kg', 90000, 20, 'tenant_b')
      .run();
    await db
      .prepare(
        'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_type, notes, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind('tx_b1', 'ing_b', 'in', 20, 'manual', 'Tenant B restock', 'tenant_b', new Date().toISOString())
      .run();
    // Orphan movement with empty ingredient_id
    await db
      .prepare(
        'INSERT INTO stock_movements (id, ingredient_id, type, quantity, notes, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind('mov_orphan', '', 'adjustment', 5, 'Orphan movement', 'tenant_a', new Date().toISOString())
      .run();

    const executedSql: string[] = [];
    const basePrepare = db.prepare.bind(db);
    const spyDb = {
      ...db,
      prepare(sql: string) {
        executedSql.push(sql);
        return basePrepare(sql);
      },
    } as unknown as import('@cloudflare/workers-types').D1Database;

    const appA = buildOpenApiApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' });
    const listRes = await appA.request(
      '/api/inventory/movements',
      {
        method: 'GET',
        headers: { 'X-Tenant-ID': 'tenant_a' },
      },
      createMockEnv({ AURA_DB: spyDb })
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: unknown[]; meta: { total: number } };
    // Neither Tenant B's transaction nor the orphan movement without a valid tenant_a ingredient may appear
    expect(listBody.data).toEqual([]);
    expect(listBody.meta.total).toBe(0);
    // Must not have fallen back to querying inventory_transactions when stock_movements query succeeded with 0 rows
    expect(executedSql.some((s) => s.includes('FROM inventory_transactions'))).toBe(false);

    // AY1-F5: If ingredients table lacks tenant_id column, non-default tenant POST /movements must fail closed (404/500) even if audit_logs has creator metadata
    const legacyDb = createSqliteD1({ omitIngredientTenantCol: true });
    await legacyDb
      .prepare('INSERT INTO ingredients (id, sku, name, category, unit, current_stock, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .bind('ing_legacy', 'SKU-L', 'Legacy Sugar', 'sweetener', 'kg', 50)
      .run();
    await legacyDb
      .prepare(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind('mgr_a', 'ingredient_create', 'ingredient', 'ing_legacy', 'tenant_a', new Date().toISOString())
      .run();
    const createMovRes = await appA.request(
      '/api/inventory/movements',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          ingredientId: 'ing_legacy',
          type: 'in',
          quantity: 10,
        }),
      },
      createMockEnv({ AURA_DB: legacyDb })
    );
    expect(createMovRes.status).toBe(503);
    const legacyStock = await legacyDb
      .prepare('SELECT current_stock FROM ingredients WHERE id = ?')
      .bind('ing_legacy')
      .first<{ current_stock: number }>();
    expect(Number(legacyStock?.current_stock)).toBe(50);
  });

  it('AY1-F6: supplier list does not run unscoped 500-row scan when non-default tenant has 0 suppliers, and supplier create fails closed without tenant_id column', async () => {
    await db
      .prepare('INSERT INTO suppliers (id, name, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('sup_b', 'Tenant B Supplier', 'tenant_b')
      .run();

    const executedSql: string[] = [];
    const basePrepare = db.prepare.bind(db);
    const spyDb = {
      ...db,
      prepare(sql: string) {
        executedSql.push(sql);
        return basePrepare(sql);
      },
    } as unknown as import('@cloudflare/workers-types').D1Database;

    const appA = buildOpenApiApp({ id: 'mgr_a', role: 'manager', tenantId: 'tenant_a' });
    const listRes = await appA.request(
      '/api/inventory/suppliers',
      {
        method: 'GET',
        headers: { 'X-Tenant-ID': 'tenant_a' },
      },
      createMockEnv({ AURA_DB: spyDb })
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: unknown[]; meta: { total: number } };
    expect(listBody.data).toEqual([]);
    expect(listBody.meta.total).toBe(0);
    // Must not execute an unscoped SELECT * FROM suppliers without tenant_id filter
    expect(
      executedSql.some((s) => s.includes('FROM suppliers') && !s.includes('tenant_id'))
    ).toBe(false);

    // Supplier creation on a schema lacking suppliers.tenant_id must fail closed for tenant_a
    const legacySupDb = createSqliteD1({ omitSupplierTenantCol: true });
    const createSupRes = await appA.request(
      '/api/inventory/suppliers',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          name: 'Tenant A Fresh Dairy',
          paymentTerms: 30,
        }),
      },
      createMockEnv({ AURA_DB: legacySupDb })
    );
    expect(createSupRes.status).toBe(500);
  });

  it('AY1-F7: ingredient delete scopes recipe_items and purchase_order_items dependency checks by tenant and fails closed when ingredients.tenant_id is missing', async () => {
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, cost_per_unit, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_a', 'SKU-A', 'Tenant A Oat Milk', 'dairy', 'l', 45000, 10, 'tenant_a')
      .run();

    // Tenant B has a recipe and an active PO referencing the same ingredient_id string ('ing_a')
    await db
      .prepare('INSERT INTO recipes (id, product_id, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('rec_b', 'prod_b', 'tenant_b')
      .run();
    await db
      .prepare('INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity) VALUES (?, ?, ?, ?)')
      .bind('ri_b', 'rec_b', 'ing_a', 0.2)
      .run();
    await db
      .prepare('INSERT INTO suppliers (id, name, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('sup_b', 'Supplier B', 'tenant_b')
      .run();
    await db
      .prepare('INSERT INTO purchase_orders (id, supplier_id, status, tenant_id) VALUES (?, ?, ?, ?)')
      .bind('po_b', 'sup_b', 'ordered', 'tenant_b')
      .run();
    await db
      .prepare('INSERT INTO purchase_order_items (id, purchase_order_id, po_id, ingredient_id, quantity) VALUES (?, ?, ?, ?, ?)')
      .bind('poi_b', 'po_b', 'po_b', 'ing_a', 5)
      .run();

    const appA = buildOpenApiApp({ id: 'owner_a', role: 'owner', tenantId: 'tenant_a' });

    // Tenant B's recipe/PO must NOT block Tenant A from deleting its own ingredient
    const delAllowedRes = await appA.request(
      '/api/inventory/ingredients/ing_a',
      {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': 'tenant_a' },
      },
      env
    );
    expect(delAllowedRes.status).toBe(200);

    // Re-insert ing_a and add a Tenant A recipe -> now deletion is blocked with 409
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, cost_per_unit, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_a', 'SKU-A', 'Tenant A Oat Milk', 'dairy', 'l', 45000, 10, 'tenant_a')
      .run();
    await db
      .prepare('INSERT INTO recipes (id, product_id, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('rec_a', 'prod_a', 'tenant_a')
      .run();
    await db
      .prepare('INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity) VALUES (?, ?, ?, ?)')
      .bind('ri_a', 'rec_a', 'ing_a', 0.25)
      .run();

    const delBlockedRes = await appA.request(
      '/api/inventory/ingredients/ing_a',
      {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': 'tenant_a' },
      },
      env
    );
    expect(delBlockedRes.status).toBe(409);

    // Fail closed when ingredients lacks tenant_id for non-default tenant (create -> 500, patch/delete -> 404, list -> empty)
    const legacyIngDb = createSqliteD1({ omitIngredientTenantCol: true });
    await legacyIngDb
      .prepare('INSERT INTO ingredients (id, sku, name, category, unit, current_stock, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .bind('ing_unscoped', 'SKU-U', 'Unscoped Tea', 'tea', 'kg', 12)
      .run();
    const listLegacyRes = await appA.request(
      '/api/inventory/ingredients',
      {
        method: 'GET',
        headers: { 'X-Tenant-ID': 'tenant_a' },
      },
      createMockEnv({ AURA_DB: legacyIngDb })
    );
    expect(listLegacyRes.status).toBe(200);
    const listLegacyBody = (await listLegacyRes.json()) as { data: unknown[] };
    expect(listLegacyBody.data).toEqual([]);

    const createLegacyIngRes = await appA.request(
      '/api/inventory/ingredients',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
        body: JSON.stringify({
          sku: 'SKU-NEW',
          name: 'New Tenant A Ingredient',
          category: 'coffee',
          unit: 'kg',
          currentStock: 5,
          costPerUnit: 100000,
        }),
      },
      createMockEnv({ AURA_DB: legacyIngDb })
    );
    expect(createLegacyIngRes.status).toBe(500);

    const delLegacyIngRes = await appA.request(
      '/api/inventory/ingredients/ing_unscoped',
      {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': 'tenant_a' },
      },
      createMockEnv({ AURA_DB: legacyIngDb })
    );
    expect(delLegacyIngRes.status).toBe(404);
  });

  it('AY1-F8: domain inventoryCRUD and inventorySnapshots reject unauthenticated reads and block default-tenant owners from cross-tenant access', async () => {
    await db
      .prepare(
        'INSERT INTO inventory_items (id, sku, name, category, unit, current_stock, min_stock, max_stock, cost_per_unit, active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('item_b', 'SKU-B1', 'Tenant B Espresso', 'coffee', 'kg', 15, 2, 50, 200000, 'tenant_b')
      .run();

    // 1. Unauthenticated caller must receive 403 on both inventoryCRUD and inventorySnapshots
    const unauthApp = buildDomainInventoryApp(null);
    const unauthListRes = await unauthApp.request('/?tenant_id=tenant_b', { method: 'GET' }, { AURA_DB: db });
    expect(unauthListRes.status).toBe(403);

    const unauthSnapRes = await unauthApp.request('/item_b/snapshots?tenant_id=tenant_b', { method: 'GET' }, { AURA_DB: db });
    expect(unauthSnapRes.status).toBe(403);

    // 2. Owner of 'default' tenant (not '*' or 'hq') must be denied cross-tenant read on tenant_b
    const defaultOwnerApp = buildDomainInventoryApp({ id: 'owner_def', role: 'owner', tenantId: 'default' });
    const crossReadRes = await defaultOwnerApp.request(
      '/?tenant_id=tenant_b',
      { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_b' } },
      { AURA_DB: db }
    );
    expect(crossReadRes.status).toBe(403);

    const crossSnapReadRes = await defaultOwnerApp.request(
      '/item_b/snapshots?tenant_id=tenant_b',
      { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_b' } },
      { AURA_DB: db }
    );
    expect(crossSnapReadRes.status).toBe(403);

    // 3. Wildcard HQ admin (tenantId: '*') can read tenant_b and record a tenant-scoped snapshot
    const hqAdminApp = buildDomainInventoryApp({ id: 'hq_root', role: 'admin', tenantId: '*' });
    const hqReadRes = await hqAdminApp.request(
      '/?tenant_id=tenant_b',
      { method: 'GET', headers: { 'X-Tenant-ID': 'tenant_b' } },
      { AURA_DB: db }
    );
    expect(hqReadRes.status).toBe(200);

    const hqSnapCreateRes = await hqAdminApp.request(
      '/item_b/snapshots?tenant_id=tenant_b',
      { method: 'POST', headers: { 'X-Tenant-ID': 'tenant_b' } },
      { AURA_DB: db }
    );
    expect(hqSnapCreateRes.status).toBe(201);
    const snapRow = await db
      .prepare('SELECT tenant_id, closing_stock FROM inventory_snapshots WHERE item_id = ?')
      .bind('item_b')
      .first<{ tenant_id: string; closing_stock: number }>();
    expect(snapRow?.tenant_id).toBe('tenant_b');
    expect(Number(snapRow?.closing_stock)).toBe(15);
  });

  it('AY1-F9: bom-policy fails closed on recipe_items join error for non-default tenants and synchronizes inventory_items stock during BOM deduction', async () => {
    await db
      .prepare('INSERT INTO recipes (id, product_id, is_active, tenant_id) VALUES (?, ?, 1, ?)')
      .bind('rec_a', 'latte_a', 'tenant_a')
      .run();
    await db
      .prepare('INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity) VALUES (?, ?, ?, ?)')
      .bind('ri_a1', 'rec_a', 'ing_a1', 0.25)
      .run();
    await db
      .prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, current_stock, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_a1', 'SKU-MILK', 'Fresh Milk', 'dairy', 'l', 10, 'tenant_a')
      .run();
    await db
      .prepare(
        'INSERT INTO inventory_items (id, sku, name, category, unit, current_stock, active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
      )
      .bind('ing_a1', 'SKU-MILK', 'Fresh Milk', 'dairy', 'l', 10, 'tenant_a')
      .run();

    // 1. If the tenant-scoped recipe_items JOIN fails for a non-default tenant, getRecipeForProduct returns []
    const basePrepare = db.prepare.bind(db);
    const failingJoinDb = {
      ...db,
      prepare(sql: string) {
        if (sql.includes('FROM recipe_items') && sql.includes('LEFT JOIN ingredients')) {
          throw new Error('simulated join failure');
        }
        return basePrepare(sql);
      },
    };
    const failedComponents = await getRecipeForProduct(failingJoinDb as never, 'latte_a', 'tenant_a');
    expect(failedComponents).toEqual([]);

    // 2. Normal BOM deduction updates both ingredients and inventory_items for tenant_a
    expect(deductOrderExperimentalBom).toBe(deductIngredientsForOrder);
    await deductIngredientsForOrder(
      { AURA_DB: db as never },
      'ord_a_100',
      [{ product_id: 'latte_a', quantity: 4 }],
      'tenant_a'
    );

    const ingAfter = await db
      .prepare('SELECT current_stock FROM ingredients WHERE id = ? AND tenant_id = ?')
      .bind('ing_a1', 'tenant_a')
      .first<{ current_stock: number }>();
    const itemAfter = await db
      .prepare('SELECT current_stock FROM inventory_items WHERE id = ? AND tenant_id = ?')
      .bind('ing_a1', 'tenant_a')
      .first<{ current_stock: number }>();

    expect(Number(ingAfter?.current_stock)).toBe(9);
    expect(Number(itemAfter?.current_stock)).toBe(9);
  });
});
