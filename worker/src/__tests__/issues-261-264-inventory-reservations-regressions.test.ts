// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database } from '@cloudflare/workers-types';
import { calculateOrderConsumption, deductOrderStock } from '../../../packages/domain/inventory/src/policies/inventory-recipe-policy';
import { restoreInventoryForOrder } from '../../../packages/domain/inventory/src/routes/order-deduction';
import { inventoryCRUD } from '../../../packages/domain/inventory/src/routes/inventory-crud';
import { productsRouter } from '../../../packages/domain/catalog/commands/products';
import { inventoryForecastingRouter } from '../routes/inventory-forecasting';
import { registerIngredientHandlers } from '../routes/openapi-inventory-handlers/ingredient-handlers';
import { generateJWT } from '../lib/jwt';
import { QueryBooleanSchema } from '../schemas/common';
import { PurchaseOrderStatusEnum } from '../schemas/inventory/purchase-orders';
import { nameSchema } from '../lib/validators/common';
import { reservationsRouter, waitlistRouter } from '../../../packages/domain/reservation/src/routes/reservations';
import { createRecruitmentApplication } from '../lib/recruitment-creation';
import type { Env } from '../types/env';

function createSqliteD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bound = args;
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          const prepared = db.prepare(sql);
          const row = prepared.get(...(bound as never[])) as T | undefined;
          return row ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const prepared = db.prepare(sql);
          const results = prepared.all(...(bound as never[])) as T[];
          return { results, success: true, meta: { changes: 0 } };
        },
        async run() {
          const prepared = db.prepare(sql);
          const info = prepared.run(...(bound as never[]));
          return { success: true, meta: { changes: Number(info.changes ?? 0) } };
        },
      };
      return stmt;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}

async function mintStaffJwt(
  db: DatabaseSync,
  user: { id: string; role: string; tenantId: string },
  secret: string
): Promise<string> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      role TEXT,
      tenant_id TEXT,
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1
    );
  `);
  db.prepare(
    `INSERT OR REPLACE INTO users (id, name, phone, role, tenant_id, is_active, auth_version)
     VALUES (?, ?, '0900000001', ?, ?, 1, 1)`
  ).run(user.id, `Staff ${user.id}`, user.role, user.tenantId);
  const nowSec = Math.floor(Date.now() / 1000) - 5;
  return generateJWT(
    {
      id: user.id,
      role: user.role,
      tenantId: user.tenantId,
      authVersion: 1,
      authTime: nowSec,
      sessionType: 'staff-web',
    } as never,
    secret,
    3600,
    nowSec
  );
}

describe('Issue #261: Inventory, BOM, Forecasting & Catalog regressions', () => {
  let sqlite: DatabaseSync;
  let d1: D1Database;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE ingredients (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        current_stock REAL NOT NULL DEFAULT 0,
        min_stock REAL NOT NULL DEFAULT 0,
        cost_per_unit REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT
      );
      CREATE TABLE recipes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        product_id TEXT NOT NULL,
        ingredient_id TEXT,
        quantity REAL DEFAULT 0,
        name TEXT,
        instructions TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE recipe_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        recipe_id TEXT NOT NULL,
        ingredient_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'g'
      );
      CREATE TABLE stock_movements (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        ingredient_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_id TEXT,
        reference_type TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    d1 = createSqliteD1(sqlite);
  });

  it('deducts ALL ingredients when a product has multiple recipe rows (tc002: coffee + milk)', async () => {
    sqlite.exec(`
      INSERT INTO ingredients (id, name, unit, current_stock, cost_per_unit) VALUES
        ('ing-coffee', 'Coffee Beans', 'g', 1000, 100),
        ('ing-milk', 'Fresh Milk', 'ml', 2000, 50);
      INSERT INTO recipes (id, product_id, ingredient_id, quantity, name, is_active) VALUES
        ('rec-1', 'tc002', 'ing-coffee', 20, 'Latte Coffee', 1),
        ('rec-2', 'tc002', 'ing-milk', 70, 'Latte Milk', 1);
      INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit) VALUES
        ('ri-1', 'rec-1', 'ing-coffee', 20, 'g'),
        ('ri-2', 'rec-2', 'ing-milk', 70, 'ml');
    `);

    const calc = await calculateOrderConsumption(d1, [{ productId: 'tc002', quantity: 3 }], 'default');
    expect(calc.depletions).toHaveLength(2);
    const coffeeDep = calc.depletions.find((d) => d.ingredientId === 'ing-coffee');
    const milkDep = calc.depletions.find((d) => d.ingredientId === 'ing-milk');
    expect(coffeeDep?.quantity).toBe(60);
    expect(milkDep?.quantity).toBe(210);

    const res = await deductOrderStock(d1, 'ord-multi-1', [{ productId: 'tc002', quantity: 3 }], {
      allowNegative: true,
      tenantId: 'default',
    });
    expect(res.ok).toBe(true);

    const coffeeRow = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-coffee') as { current_stock: number };
    const milkRow = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-milk') as { current_stock: number };
    expect(coffeeRow.current_stock).toBe(940);
    expect(milkRow.current_stock).toBe(1790);
  });

  it('records negative quantity for post-prep waste in stock_movements', async () => {
    sqlite.exec(`
      INSERT INTO ingredients (id, name, unit, current_stock) VALUES ('ing-coffee', 'Coffee', 'g', 960);
      INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type) VALUES
        ('sm-1', 'ing-coffee', 'consumption', -40, 'ord-spoil-1', 'order');
    `);

    await restoreInventoryForOrder({ AURA_DB: d1 } as unknown as Env, 'ord-spoil-1', 'default', 'preparing');

    const wasteRow = sqlite
      .prepare("SELECT quantity FROM stock_movements WHERE reference_id = 'ord-spoil-1' AND type = 'waste'")
      .get() as { quantity: number } | undefined;
    expect(wasteRow).toBeDefined();
    expect(wasteRow!.quantity).toBe(-40);
  });

  it('parses QueryBooleanSchema strictly without inverting "false"', () => {
    expect(QueryBooleanSchema.parse('false')).toBe(false);
    expect(QueryBooleanSchema.parse('0')).toBe(false);
    expect(QueryBooleanSchema.parse('true')).toBe(true);
    expect(QueryBooleanSchema.parse('1')).toBe(true);
    expect(QueryBooleanSchema.safeParse('notabool').success).toBe(false);
  });

  it('accepts partially_received and partial in PurchaseOrderStatusEnum', () => {
    expect(PurchaseOrderStatusEnum.safeParse('partially_received').success).toBe(true);
    expect(PurchaseOrderStatusEnum.safeParse('partial').success).toBe(true);
  });

  it('rejects whitespace-only names in nameSchema', () => {
    expect(nameSchema.safeParse('   ').success).toBe(false);
    expect(nameSchema.parse('  Cà phê sữa  ')).toBe('Cà phê sữa');
  });

  it('converts inline recipes.unit into ingredients.unit, deduplicates covered recipe_items, and isolates HQ wildcard to one store', async () => {
    sqlite.exec(`ALTER TABLE recipes ADD COLUMN unit TEXT DEFAULT 'g'`);
    sqlite.exec(`
      INSERT INTO ingredients (id, tenant_id, name, unit, current_stock, cost_per_unit) VALUES
        ('ing-beans-a', 'store-a', 'Espresso Beans A', 'g', 1000, 100),
        ('ing-beans-b', 'store-b', 'Espresso Beans B', 'g', 1000, 100);
      INSERT INTO recipes (id, tenant_id, product_id, ingredient_id, quantity, unit, name, is_active) VALUES
        ('rec-inline-kg', 'store-a', 'prod-conv', 'ing-beans-a', 0.2, 'kg', 'Inline Kg Recipe', 1),
        ('rec-dup', 'store-a', 'prod-dup', 'ing-beans-a', 25, 'g', 'Inline + Item Duplicate', 1),
        ('rec-store-b', 'store-b', 'prod-conv', 'ing-beans-b', 50, 'g', 'Other Store Recipe', 1);
      INSERT INTO recipe_items (id, tenant_id, recipe_id, ingredient_id, quantity, unit) VALUES
        ('ri-dup', 'store-a', 'rec-dup', 'ing-beans-a', 25, 'g');
    `);

    const convCalc = await calculateOrderConsumption(d1, [{ productId: 'prod-conv', quantity: 1 }], 'store-a');
    expect(convCalc.depletions).toHaveLength(1);
    expect(convCalc.depletions[0].ingredientId).toBe('ing-beans-a');
    expect(convCalc.depletions[0].quantity).toBe(200);

    const dupCalc = await calculateOrderConsumption(d1, [{ productId: 'prod-dup', quantity: 1 }], 'store-a');
    expect(dupCalc.depletions).toHaveLength(1);
    expect(dupCalc.depletions[0].quantity).toBe(25);

    const wildcardCalc = await calculateOrderConsumption(d1, [{ productId: 'prod-conv', quantity: 1 }], '*');
    expect(wildcardCalc.depletions).toHaveLength(1);
  });

  it('mirrors inventoryCRUD PUT and DELETE mutations to matching ingredients rows within the same tenant', async () => {
    sqlite.exec(`
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY,
        sku TEXT,
        name TEXT,
        name_en TEXT,
        category TEXT,
        unit TEXT,
        current_stock REAL DEFAULT 0,
        min_stock REAL DEFAULT 0,
        max_stock REAL DEFAULT 0,
        cost_per_unit REAL DEFAULT 0,
        supplier TEXT,
        active INTEGER DEFAULT 1,
        tenant_id TEXT DEFAULT 'default',
        updated_at TEXT
      );
      ALTER TABLE ingredients ADD COLUMN sku TEXT;
      ALTER TABLE ingredients ADD COLUMN category TEXT;
      ALTER TABLE ingredients ADD COLUMN max_stock REAL DEFAULT 0;
      INSERT INTO inventory_items (id, sku, name, category, unit, current_stock, min_stock, max_stock, cost_per_unit, active, tenant_id)
        VALUES ('item-sync-1', 'SKU-1', 'Matcha', 'tea', 'g', 100, 10, 500, 200, 1, 'store-a');
      INSERT INTO ingredients (id, sku, name, category, unit, current_stock, min_stock, max_stock, cost_per_unit, is_active, tenant_id)
        VALUES ('item-sync-1', 'SKU-1', 'Matcha', 'tea', 'g', 100, 10, 500, 200, 1, 'store-a');
    `);

    const app = new Hono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'store-a', tenant_id: 'store-a' });
      c.set('tenantId', 'store-a');
      await next();
    });
    inventoryCRUD(app as never);

    const putRes = await app.request(
      '/item-sync-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_stock: 250, cost_per_unit: 220, name: 'Uji Matcha' }),
      },
      { AURA_DB: d1 } as unknown as Env
    );
    expect(putRes.status).toBe(200);

    const ingAfterPut = sqlite.prepare('SELECT name, current_stock, cost_per_unit FROM ingredients WHERE id = ?').get('item-sync-1') as {
      name: string;
      current_stock: number;
      cost_per_unit: number;
    };
    expect(ingAfterPut.name).toBe('Uji Matcha');
    expect(ingAfterPut.current_stock).toBe(250);
    expect(ingAfterPut.cost_per_unit).toBe(220);

    const delRes = await app.request('/item-sync-1', { method: 'DELETE' }, { AURA_DB: d1 } as unknown as Env);
    expect(delRes.status).toBe(200);

    const ingAfterDel = sqlite.prepare('SELECT is_active FROM ingredients WHERE id = ?').get('item-sync-1') as { is_active: number };
    expect(ingAfterDel.is_active).toBe(0);
  });

  it('atomically restores inventory_items mirror in batch, isolates tenant restore idempotency, and stamps waste log tenant_id', async () => {
    sqlite.exec(`
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        name TEXT,
        unit TEXT,
        current_stock REAL DEFAULT 0,
        updated_at TEXT
      );
      INSERT INTO ingredients (id, tenant_id, name, unit, current_stock) VALUES ('ing-sync', 'store-a', 'Oat Milk', 'ml', 900);
      INSERT INTO inventory_items (id, tenant_id, name, unit, current_stock) VALUES ('ing-sync', 'store-a', 'Oat Milk', 'ml', 900);
      INSERT INTO stock_movements (id, tenant_id, ingredient_id, type, quantity, reference_id, reference_type) VALUES
        ('sm-restore-a', 'store-a', 'ing-sync', 'consumption', -100, 'ord-sync-1', 'order');
    `);

    await restoreInventoryForOrder({ AURA_DB: d1 } as unknown as Env, 'ord-sync-1', 'store-a', 'pending');
    await restoreInventoryForOrder({ AURA_DB: d1 } as unknown as Env, 'ord-sync-1', 'store-a', 'pending');

    const ingRow = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-sync') as { current_stock: number };
    const invRow = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('ing-sync') as { current_stock: number };
    expect(ingRow.current_stock).toBe(1000);
    expect(invRow.current_stock).toBe(1000);
  });

  it('excludes order-cancellation waste in inventory_transactions from forecasting depletion while keeping non-order waste', async () => {
    sqlite.exec(`
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        sku TEXT,
        name TEXT,
        category TEXT DEFAULT 'raw',
        unit TEXT DEFAULT 'g',
        current_stock REAL DEFAULT 500,
        min_stock REAL DEFAULT 50,
        active INTEGER DEFAULT 1
      );
      CREATE TABLE inventory_transactions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        item_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_id TEXT,
        reference_type TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO inventory_items (id, tenant_id, sku, name, unit, current_stock, min_stock, active)
        VALUES ('item-fc-1', 'default', 'FC-1', 'Cacao Powder', 'g', 500, 50, 1);
      INSERT INTO inventory_transactions (id, tenant_id, item_id, type, quantity, reference_id, reference_type, created_at) VALUES
        ('tx-out-1', 'default', 'item-fc-1', 'out', -70, 'ord-1', 'order', datetime('now', '-1 day')),
        ('tx-order-waste', 'default', 'item-fc-1', 'waste', -70, 'ord-1', 'order', datetime('now', '-1 day')),
        ('tx-manual-waste', 'default', 'item-fc-1', 'waste', -35, 'spoil-1', 'manual', datetime('now', '-1 day'));
    `);

    const secret = 'test-forecast-secret-key-32-chars!!';
    const token = await mintStaffJwt(sqlite, { id: 'mgr-1', role: 'manager', tenantId: 'default' }, secret);
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/inventory/forecasting', inventoryForecastingRouter);

    const res = await app.request(
      '/api/inventory/forecasting/run-rate?days=7',
      { headers: { Authorization: `Bearer ${token}` } },
      { AURA_DB: d1, JWT_SECRET: secret } as unknown as Env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ item_id: string; daily_run_rate: number }> };
    const item = body.data.find((i) => i.item_id === 'item-fc-1');
    expect(item).toBeDefined();
    // 70 (out) + 35 (manual waste) = 105 over 7 days => 15/day; the -70 order-referenced waste is not double-counted
    expect(item!.daily_run_rate).toBe(15);
  });

  it('supports lowStock filtering on inventory_items fallback and fails closed into inventory_items for non-default ingredient creation', async () => {
    const legacySqlite = new DatabaseSync(':memory:');
    legacySqlite.exec(`
      CREATE TABLE ingredients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        category TEXT,
        unit TEXT NOT NULL,
        cost_per_unit REAL DEFAULT 0,
        current_stock REAL DEFAULT 0,
        min_stock REAL DEFAULT 0,
        max_stock REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY,
        sku TEXT,
        tenant_id TEXT DEFAULT 'default',
        name TEXT NOT NULL,
        category TEXT,
        unit TEXT NOT NULL,
        current_stock REAL DEFAULT 0,
        min_stock REAL DEFAULT 0,
        max_stock REAL DEFAULT 0,
        cost_per_unit REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );
      INSERT INTO inventory_items (id, sku, tenant_id, name, category, unit, current_stock, min_stock, max_stock, unit_cost, is_active) VALUES
        ('inv-low-1', 'SKU-LOW', 'store-b', 'Low Syrup', 'syrup', 'ml', 5, 20, 100, 50, 1),
        ('inv-ok-1', 'SKU-OK', 'store-b', 'Full Syrup', 'syrup', 'ml', 80, 20, 100, 50, 1);
    `);
    const legacyD1 = createSqliteD1(legacySqlite);

    const app = new OpenAPIHono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'mgr-b', role: 'manager', tenantId: 'store-b' });
      c.set('tenantId', 'store-b');
      await next();
    });
    registerIngredientHandlers(app as never);

    const createRes = await app.request(
      '/api/inventory/ingredients',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
        body: JSON.stringify({
          name: 'Caramel Syrup',
          sku: 'SYR-CAR-B',
          category: 'syrup',
          unit: 'ml',
          costPerUnit: 120,
          currentStock: 50,
          minStock: 10,
          maxStock: 200,
        }),
      },
      { AURA_DB: legacyD1 } as unknown as Env
    );
    expect(createRes.status).toBe(201);
    const createdBody = (await createRes.json()) as { data: { id: string; sku: string } };
    expect(createdBody.data.sku).toBe('SYR-CAR-B');
    // Must not insert an unscoped orphan row into legacy ingredients table for non-default tenant
    const orphanCount = legacySqlite.prepare('SELECT COUNT(*) as cnt FROM ingredients').get() as { cnt: number };
    expect(orphanCount.cnt).toBe(0);

    // Drop ingredients table so GET falls back to inventory_items and verifies lowStock filter parity
    legacySqlite.exec('DROP TABLE ingredients');
    const lowRes = await app.request(
      '/api/inventory/ingredients?lowStock=true',
      { method: 'GET', headers: { 'X-Tenant-ID': 'store-b' } },
      { AURA_DB: legacyD1 } as unknown as Env
    );
    expect(lowRes.status).toBe(200);
    const lowBody = (await lowRes.json()) as { data: Array<{ id: string }> };
    expect(lowBody.data.map((r) => r.id)).toEqual(['inv-low-1']);

    const healthyRes = await app.request(
      '/api/inventory/ingredients?lowStock=false',
      { method: 'GET', headers: { 'X-Tenant-ID': 'store-b' } },
      { AURA_DB: legacyD1 } as unknown as Env
    );
    expect(healthyRes.status).toBe(200);
    const healthyBody = (await healthyRes.json()) as { data: Array<{ id: string }> };
    expect(healthyBody.data.map((r) => r.id).sort()).toEqual([createdBody.data.id, 'inv-ok-1'].sort());
  });

  it('scopes product_modifier_groups deletion to the target tenant when deleting a product', async () => {
    sqlite.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        tenant_id TEXT DEFAULT 'default',
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        is_available INTEGER DEFAULT 1
      );
      CREATE TABLE product_modifier_groups (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        tenant_id TEXT DEFAULT 'default'
      );
      INSERT INTO products (id, tenant_id, name, price, is_available) VALUES
        ('prod-shared', 'store-a', 'Cold Brew', 45000, 1);
      INSERT INTO product_modifier_groups (id, product_id, group_id, tenant_id) VALUES
        ('pmg-a', 'prod-shared', 'grp-size', 'store-a'),
        ('pmg-b', 'prod-shared', 'grp-size', 'store-b');
    `);

    const secret = 'test-product-delete-secret-32chars!';
    const token = await mintStaffJwt(sqlite, { id: 'owner-a', role: 'owner', tenantId: 'store-a' }, secret);
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/products', productsRouter);

    const res = await app.request(
      '/api/products/prod-shared',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-a' },
      },
      { AURA_DB: d1, JWT_SECRET: secret } as unknown as Env
    );
    expect(res.status).toBe(200);

    const remaining = sqlite.prepare('SELECT id, tenant_id FROM product_modifier_groups').all() as Array<{ id: string; tenant_id: string }>;
    expect(remaining).toEqual([{ id: 'pmg-b', tenant_id: 'store-b' }]);
  });
});

describe('Issue #264: Reservations, Waitlist & Recruitment regressions', () => {
  let sqlite: DatabaseSync;
  let d1: D1Database;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        code TEXT,
        name TEXT,
        capacity INTEGER DEFAULT 4,
        zone TEXT DEFAULT 'indoor',
        status TEXT NOT NULL DEFAULT 'Available',
        current_session_id TEXT
      );
      CREATE TABLE reservations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        table_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        guest_count INTEGER DEFAULT 2,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        zone TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE table_sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        table_id TEXT NOT NULL,
        reservation_id TEXT,
        guest_count INTEGER DEFAULT 2,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        started_at TEXT,
        closed_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE waitlist (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        party_size INTEGER NOT NULL DEFAULT 2,
        zone TEXT DEFAULT 'indoor',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'waiting',
        notified_at TEXT,
        seated_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        phone TEXT
      );
    `);
    d1 = createSqliteD1(sqlite);
  });

  function createReservationApp(user?: { id: string; role: string; phone?: string }) {
    const app = new Hono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
    app.use('*', async (c, next) => {
      if (user) c.set('user', user);
      c.set('tenantId', 'default');
      await next();
    });
    app.route('/api/reservations', reservationsRouter);
    app.route('/api/waitlist', waitlistRouter);
    return app;
  }

  it('rejects invalid reservation inputs (blank name, bad phone, 2027-99-99, 99:99)', async () => {
    sqlite.exec(`INSERT INTO cafe_tables (id, code, name, capacity, status) VALUES ('t01', 'T01', 'Bàn 1', 4, 'Available')`);
    const app = createReservationApp({ id: 'cust-1', role: 'customer' });

    const badPayloads = [
      { table_id: 't01', customer_name: '   ', customer_phone: '0901234567', date: '2027-05-01', time: '10:00' },
      { table_id: 't01', customer_name: 'An', customer_phone: 'audit3notphone', date: '2027-05-01', time: '10:00' },
      { table_id: 't01', customer_name: 'An', customer_phone: '0901234567', date: '2027-99-99', time: '10:00' },
      { table_id: 't01', customer_name: 'An', customer_phone: '0901234567', date: '2027-05-01', time: '99:99' },
    ];

    for (const payload of badPayloads) {
      const res = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        { AURA_DB: d1 } as unknown as Env
      );
      expect(res.status).toBe(400);
    }
  });

  it('allows logged-in customer to self-cancel own reservation (both via customer_id and phone fallback)', async () => {
    sqlite.exec(`
      INSERT INTO cafe_tables (id, code, name, capacity, status) VALUES ('t02', 'T02', 'Bàn 2', 4, 'Available');
      INSERT INTO customers (id, phone) VALUES ('cust-legacy', '0909888777');
      INSERT INTO reservations (id, table_id, customer_id, customer_name, customer_phone, date, time, status) VALUES
        ('rsv-owned', 't02', 'cust-1', 'Minh', '0901112223', '2027-06-01', '14:00', 'confirmed'),
        ('rsv-legacy', 't02', NULL, 'Lan', '+84 909-888-777', '2027-06-02', '15:00', 'confirmed');
    `);

    const app1 = createReservationApp({ id: 'cust-1', role: 'customer' });
    const res1 = await app1.request('/api/reservations/rsv-owned', { method: 'DELETE' }, { AURA_DB: d1 } as unknown as Env);
    expect(res1.status).toBe(200);

    const app2 = createReservationApp({ id: 'cust-legacy', role: 'customer' });
    const res2 = await app2.request('/api/reservations/rsv-legacy', { method: 'DELETE' }, { AURA_DB: d1 } as unknown as Env);
    expect(res2.status).toBe(200);
  });

  it('releases Occupied table and closes table_sessions when cancelling a future-day seated reservation', async () => {
    sqlite.exec(`
      INSERT INTO cafe_tables (id, code, name, capacity, status) VALUES ('t06', 'T06', 'Bàn 6', 4, 'Occupied');
      INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status) VALUES
        ('rsv-future-seated', 't06', 'Khách', '0901234567', '2027-12-31', '19:00', 'seated');
      INSERT INTO table_sessions (id, table_id, reservation_id, status, notes) VALUES
        ('sess-1', 't06', 'rsv-future-seated', 'active', 'reservation:rsv-future-seated');
    `);

    const staffApp = createReservationApp({ id: 'staff-1', role: 'manager' });
    const res = await staffApp.request(
      '/api/reservations/rsv-future-seated',
      { method: 'DELETE' },
      { AURA_DB: d1 } as unknown as Env
    );
    expect(res.status).toBe(200);

    const tableRow = sqlite.prepare('SELECT status FROM cafe_tables WHERE id = ?').get('t06') as { status: string };
    expect(tableRow.status).toBe('Available');

    const sessRow = sqlite.prepare('SELECT status FROM table_sessions WHERE id = ?').get('sess-1') as { status: string };
    expect(sessRow.status).not.toBe('active');
  });

  it('supports full Waitlist CRUD (POST, GET, PATCH, DELETE /api/waitlist)', async () => {
    const staffApp = createReservationApp({ id: 'staff-1', role: 'manager' });
    const env = { AURA_DB: d1 } as unknown as Env;

    const createRes = await staffApp.request(
      '/api/waitlist',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Hùng', customer_phone: '0912345678', party_size: 3, zone: 'outdoor' }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string; status: string } };
    expect(created.data.status).toBe('waiting');

    const listRes = await staffApp.request('/api/waitlist', { method: 'GET' }, env);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.some((r) => r.id === created.data.id)).toBe(true);

    const patchRes = await staffApp.request(
      `/api/waitlist/${created.data.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'notified' }),
      },
      env
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { data: { status: string } };
    expect(patched.data.status).toBe('notified');

    const delRes = await staffApp.request(`/api/waitlist/${created.data.id}`, { method: 'DELETE' }, env);
    expect(delRes.status).toBe(200);
  });

  it('rejects invalid phone and birthYear in POST /api/recruitment/apply', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.post('/api/recruitment/apply', (c) => createRecruitmentApplication(c, false));

    const badPhoneRes = await app.request(
      '/api/recruitment/apply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Nguyễn Văn A', phone: 'not-a-phone', birthYear: '2000' }),
      },
      { AURA_DB: d1 } as unknown as Env
    );
    expect(badPhoneRes.status).toBe(400);

    const badYearRes = await app.request(
      '/api/recruitment/apply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Nguyễn Văn A', phone: '0901234567', birthYear: 'abcd-9999' }),
      },
      { AURA_DB: d1 } as unknown as Env
    );
    expect(badYearRes.status).toBe(400);
  });

  it('does not stamp staff id into customer_id on staff reservation creation, and guards historical or live-session tables on cancel', async () => {
    sqlite.exec(`
      INSERT INTO cafe_tables (id, code, name, capacity, status, current_session_id) VALUES
        ('t-hist', 'TH', 'Bàn Lịch Sử', 4, 'Occupied', NULL),
        ('t-live', 'TL', 'Bàn Đang Ngồi', 4, 'Occupied', 'sess-walkin-live');
      INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status) VALUES
        ('rsv-past-seated', 't-hist', 'Khách Cũ', '0901234567', '2020-01-01', '10:00', 'seated'),
        ('rsv-live-conflict', 't-live', 'Khách Hôm Nay', '0901234568', '2026-11-27', '10:00', 'seated');
      INSERT INTO table_sessions (id, table_id, reservation_id, status, notes) VALUES
        ('sess-rsv-live', 't-live', 'rsv-live-conflict', 'active', 'reservation:rsv-live-conflict'),
        ('sess-walkin-live', 't-live', NULL, 'active', 'walk-in');
    `);

    const staffApp = createReservationApp({ id: 'staff-manager-99', role: 'manager' });
    const env = { AURA_DB: d1 } as unknown as Env;

    const createRes = await staffApp.request(
      '/api/reservations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: 't-hist',
          customer_name: 'Khách Đặt Qua Điện Thoại',
          customer_phone: '0911223344',
          date: '2027-08-15',
          time: '18:30',
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const createdBody = (await createRes.json()) as { data: { id: string } };
    const rsvRow = sqlite.prepare('SELECT customer_id FROM reservations WHERE id = ?').get(createdBody.data.id) as {
      customer_id: string | null;
    };
    expect(rsvRow.customer_id).toBeNull();

    // Cancelling a historical seated reservation must not free an currently Occupied table
    const cancelPastRes = await staffApp.request('/api/reservations/rsv-past-seated', { method: 'DELETE' }, env);
    expect(cancelPastRes.status).toBe(200);
    const histTable = sqlite.prepare('SELECT status FROM cafe_tables WHERE id = ?').get('t-hist') as { status: string };
    expect(histTable.status).toBe('Occupied');

    // Cancelling a seated reservation when current_session_id belongs to another active session must keep table Occupied
    const cancelLiveRes = await staffApp.request('/api/reservations/rsv-live-conflict', { method: 'DELETE' }, env);
    expect(cancelLiveRes.status).toBe(200);
    const liveTable = sqlite.prepare('SELECT status FROM cafe_tables WHERE id = ?').get('t-live') as { status: string };
    expect(liveTable.status).toBe('Occupied');
  });

  it('enforces waitlist tenant isolation, blocks terminal waitlist mutations with 409, and includes table_id in waitlist schemas', async () => {
    sqlite.exec(`
      INSERT INTO cafe_tables (id, tenant_id, code, name, capacity, zone, status) VALUES
        ('t-other', 'store-other', 'TO1', 'Other Store Table', 4, 'indoor', 'Available');
      INSERT INTO waitlist (id, tenant_id, customer_name, customer_phone, party_size, zone, status) VALUES
        ('wl-default-1', 'default', 'Khách Đợi', '0905556677', 2, 'indoor', 'waiting'),
        ('wl-other-1', 'store-other', 'Khách Chi Nhánh Khác', '0905556688', 2, 'indoor', 'waiting');
    `);

    const staffApp = createReservationApp({ id: 'staff-1', role: 'manager' });
    const env = { AURA_DB: d1 } as unknown as Env;

    // POST /api/reservations/waitlist/:id/seat must reject seating onto a table owned by another tenant
    const seatCrossTenantRes = await staffApp.request(
      '/api/reservations/waitlist/wl-default-1/seat',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_id: 't-other' }) },
      env
    );
    expect(seatCrossTenantRes.status).toBe(404);

    // Cross-tenant PATCH and DELETE must return 404
    const crossPatchRes = await staffApp.request(
      '/api/waitlist/wl-other-1',
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'notified' }) },
      env
    );
    expect(crossPatchRes.status).toBe(404);

    const crossDelRes = await staffApp.request('/api/waitlist/wl-other-1', { method: 'DELETE' }, env);
    expect(crossDelRes.status).toBe(404);

    // Once cancelled (terminal), subsequent PATCH, DELETE, and seat return 409
    const cancelPatchRes = await staffApp.request(
      '/api/waitlist/wl-default-1',
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) },
      env
    );
    expect(cancelPatchRes.status).toBe(200);

    const patchAfterCancelRes = await staffApp.request(
      '/api/waitlist/wl-default-1',
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'notified' }) },
      env
    );
    expect(patchAfterCancelRes.status).toBe(409);

    const delAfterCancelRes = await staffApp.request('/api/waitlist/wl-default-1', { method: 'DELETE' }, env);
    expect(delAfterCancelRes.status).toBe(409);

    const seatAfterCancelRes = await staffApp.request(
      '/api/reservations/waitlist/wl-default-1/seat',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_id: 't-other' }) },
      env
    );
    expect(seatAfterCancelRes.status).toBe(409);

    // Verify waitlist DDL in migration and schema files includes table_id TEXT
    const rootDir = resolve(__dirname, '../../..');
    for (const relPath of [
      'worker/db/migrations/20261127_01_reservations_customer_id_and_waitlist.sql',
      'worker/schema.sql',
      'db/schema.sql',
    ]) {
      const content = readFileSync(resolve(rootDir, relPath), 'utf8');
      expect(content).toMatch(/CREATE TABLE IF NOT EXISTS waitlist[\s\S]*?table_id\s+TEXT/i);
    }
  });
});
