// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerIngredientHandlers } from '../routes/openapi-inventory-handlers/ingredient-handlers';
import { registerMovementHandlers } from '../routes/openapi-inventory-handlers/movement-handlers';
import { registerPurchaseOrderHandlers } from '../routes/openapi-inventory-handlers/purchase-order-handlers';
import { deductInventoryForOrder } from '../../../packages/domain/inventory/src/routes/order-deduction';

function createMemoryD1(
  sqlite: DatabaseSync,
  options: {
    concurrentIngredientRead?: boolean;
    failSecondIngredient?: boolean;
    disableBatch?: boolean;
  } = {}
) {
  let releaseRead!: () => void;
  const readBarrier = new Promise<void>((r) => {
    releaseRead = r;
  });
  let ingredientReads = 0;
  let failSecond = Boolean(options.failSecondIngredient);
  const runners = new WeakMap<object, () => unknown>();

  const db = {
    prepare(query: string) {
      let args: unknown[] = [];
      const run = () => {
        if (
          failSecond &&
          query.includes('UPDATE ingredients SET current_stock =') &&
          args.includes('ing2')
        ) {
          throw new Error('synthetic failure before second ingredient update');
        }
        const result = sqlite.prepare(query).run(...(args as never[]));
        return { success: true, meta: { changes: Number(result.changes) } };
      };
      const st = {
        bind(...values: unknown[]) {
          args = values;
          return st;
        },
        async first() {
          const row = sqlite.prepare(query).get(...(args as never[])) ?? null;
          if (options.concurrentIngredientRead && query === 'SELECT * FROM ingredients WHERE id = ?') {
            ingredientReads += 1;
            if (ingredientReads === 2) releaseRead();
            await readBarrier;
          }
          return row;
        },
        async all() {
          return { success: true, results: sqlite.prepare(query).all(...(args as never[])) };
        },
        async run() {
          return run();
        },
      };
      runners.set(st, run);
      return st;
    },
    ...(options.disableBatch
      ? {}
      : {
          async batch(statements: object[]) {
            sqlite.exec('BEGIN');
            try {
              const results = statements.map((st) => runners.get(st)!());
              sqlite.exec('COMMIT');
              return results;
            } catch (err) {
              sqlite.exec('ROLLBACK');
              throw err;
            }
          },
        }),
  };

  return {
    db,
    clearFault: () => {
      failSecond = false;
    },
  };
}

function createAuthApp(role: string = 'manager', tenantId: string = 'default') {
  const app = new OpenAPIHono();
  app.use('*', async (c, next) => {
    (c as unknown as { set: (k: string, v: unknown) => void }).set('user', {
      id: `${role}-1`,
      role,
      tenantId,
    });
    (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', tenantId);
    await next();
  });
  return app;
}

describe('Issues #241-#243 inventory regressions', () => {
  describe('#241 stale ingredient edit & stocktake concurrency', () => {
    it('rejects stale PATCH with 409 when stock/cost changed concurrently and preserves live values on metadata-only edit', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, category TEXT, unit TEXT,
          cost_per_unit REAL, current_stock REAL, min_stock REAL, max_stock REAL,
          is_active INTEGER, tenant_id TEXT, updated_at TEXT
        );
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY, sku TEXT, name TEXT, category TEXT, unit TEXT,
          cost_per_unit REAL, unit_cost REAL, current_stock REAL, min_stock REAL,
          max_stock REAL, active INTEGER, is_active INTEGER, tenant_id TEXT, updated_at TEXT
        );
        INSERT INTO ingredients VALUES ('ing-1','CF-01','Coffee','coffee','g',10,100,10,500,1,'default','t1');
        INSERT INTO inventory_items VALUES ('ing-1','CF-01','Coffee','coffee','g',10,10,100,10,500,1,1,'default','t1');
      `);
      const { db } = createMemoryD1(sqlite);
      const app = createAuthApp('manager', 'default');
      registerIngredientHandlers(app as never);

      // Concurrent receipt updates DB to 120 / 12
      sqlite.exec(
        "UPDATE ingredients SET current_stock = 120, cost_per_unit = 12, updated_at = 't2'; UPDATE inventory_items SET current_stock = 120, cost_per_unit = 12, unit_cost = 12, updated_at = 't2';"
      );

      // Stale PATCH carrying old snapshot precondition -> 409 Conflict
      const staleRes = await app.request(
        '/api/inventory/ingredients/ing-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Coffee stale',
            currentStock: 100,
            costPerUnit: 10,
            expectedCurrentStock: 100,
            expectedCostPerUnit: 10,
            expectedUpdatedAt: 't1',
          }),
        },
        { AURA_DB: db } as never
      );
      expect(staleRes.status).toBe(409);

      // Metadata-only PATCH preserves live stock 120 and cost 12
      const metaRes = await app.request(
        '/api/inventory/ingredients/ing-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Coffee renamed' }),
        },
        { AURA_DB: db } as never
      );
      expect(metaRes.status).toBe(200);
      const after = sqlite
        .prepare('SELECT name, current_stock, cost_per_unit FROM ingredients WHERE id = ?')
        .get('ing-1') as { name: string; current_stock: number; cost_per_unit: number };
      expect(after).toEqual({ name: 'Coffee renamed', current_stock: 120, cost_per_unit: 12 });
      sqlite.close();
    });

    it('rejects stale stocktake delta with 409 and supports authoritative targetStock computed against live DB stock', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE ingredients (id TEXT PRIMARY KEY, sku TEXT, name TEXT, category TEXT, unit TEXT, current_stock REAL, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, current_stock REAL, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_type TEXT, reference_id TEXT, notes TEXT, tenant_id TEXT, created_at TEXT);
        INSERT INTO ingredients VALUES ('ing-1','CF-01','Coffee','coffee','g',100,'default','t1');
        INSERT INTO inventory_items VALUES ('ing-1',100,'default','t1');
      `);
      const { db } = createMemoryD1(sqlite);
      const app = createAuthApp('manager', 'default');
      registerMovementHandlers(app as never);

      // Concurrent receipt changes stock from 100 -> 120
      sqlite.exec(
        "UPDATE ingredients SET current_stock = 120, updated_at = 't2'; UPDATE inventory_items SET current_stock = 120, updated_at = 't2';"
      );

      // Stale stocktake delta with expectedStock: 100 -> 409 Conflict (does not persist 110)
      const staleRes = await app.request(
        '/api/inventory/movements',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredientId: 'ing-1',
            type: 'adjustment',
            quantity: -10,
            expectedStock: 100,
          }),
        },
        { AURA_DB: db } as never
      );
      expect(staleRes.status).toBe(409);
      const midStock = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-1') as {
        current_stock: number;
      };
      expect(midStock.current_stock).toBe(120);

      // Authoritative targetStock: 90 computes delta -30 against live stock 120
      const targetRes = await app.request(
        '/api/inventory/movements',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredientId: 'ing-1',
            type: 'adjustment',
            targetStock: 90,
            notes: 'End-of-shift stocktake',
          }),
        },
        { AURA_DB: db } as never
      );
      expect(targetRes.status).toBe(201);
      const afterIng = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-1') as {
        current_stock: number;
      };
      const afterItem = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('ing-1') as {
        current_stock: number;
      };
      const mov = sqlite.prepare('SELECT quantity FROM stock_movements WHERE ingredient_id = ?').get('ing-1') as {
        quantity: number;
      };
      expect(afterIng.current_stock).toBe(90);
      expect(afterItem.current_stock).toBe(90);
      expect(mov.quantity).toBe(-30);
      sqlite.close();
    });
  });

  describe('#242 BOM partial deduction failure & retry convergence', () => {
    it('resumes missing BOM ingredients and reconciles inventory_items mirror after mid-way failure without double-deducting', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_status TEXT, tenant_id TEXT);
        CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT, unit TEXT, current_stock REAL, cost_per_unit REAL, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT, current_stock REAL, cost_per_unit REAL, active INTEGER, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE recipes (id TEXT PRIMARY KEY, product_id TEXT, name TEXT, instructions TEXT, is_active INTEGER, tenant_id TEXT);
        CREATE TABLE recipe_items (id TEXT PRIMARY KEY, recipe_id TEXT, ingredient_id TEXT, quantity REAL, unit TEXT);
        INSERT INTO orders VALUES ('ord1', 'pending', 'unpaid', 'default');
        INSERT INTO ingredients VALUES ('ing1', 'Coffee', 'g', 100, 1, 'default', NULL), ('ing2', 'Milk', 'ml', 100, 1, 'default', NULL);
        INSERT INTO inventory_items (id, sku, name, unit, current_stock, cost_per_unit, active, tenant_id) VALUES ('ing1', 'ing1', 'Coffee', 'g', 100, 1, 1, 'default'), ('ing2', 'ing2', 'Milk', 'ml', 100, 1, 1, 'default');
        INSERT INTO recipes VALUES ('recipe1', 'drink1', 'Coffee milk', NULL, 1, 'default');
        INSERT INTO recipe_items VALUES ('ri1', 'recipe1', 'ing1', 10, 'g'), ('ri2', 'recipe1', 'ing2', 10, 'ml');
      `);

      // Simulate sequential fallback failure mid-way (ing1 deducted, ing2 throws)
      const { db, clearFault } = createMemoryD1(sqlite, {
        failSecondIngredient: true,
        disableBatch: true,
      });

      await deductInventoryForOrder({ AURA_DB: db as never }, 'ord1', [{ product_id: 'drink1', quantity: 1 }], 'default');
      clearFault();

      // Retry must complete ing2 without double-deducting ing1 and sync inventory_items mirror
      await deductInventoryForOrder({ AURA_DB: db as never }, 'ord1', [{ product_id: 'drink1', quantity: 1 }], 'default');

      // Second retry must be a pure no-op
      await deductInventoryForOrder({ AURA_DB: db as never }, 'ord1', [{ product_id: 'drink1', quantity: 1 }], 'default');

      const ingredients = sqlite.prepare('SELECT id, current_stock FROM ingredients ORDER BY id').all();
      const movements = sqlite
        .prepare('SELECT ingredient_id, type, quantity, reference_id FROM stock_movements ORDER BY ingredient_id')
        .all();
      const items = sqlite.prepare('SELECT id, current_stock FROM inventory_items ORDER BY id').all();

      expect(ingredients).toEqual([
        { id: 'ing1', current_stock: 90 },
        { id: 'ing2', current_stock: 90 },
      ]);
      expect(items).toEqual([
        { id: 'ing1', current_stock: 90 },
        { id: 'ing2', current_stock: 90 },
      ]);
      expect(movements).toEqual([
        { ingredient_id: 'ing1', type: 'consumption', quantity: -10, reference_id: 'ord1' },
        { ingredient_id: 'ing2', type: 'consumption', quantity: -10, reference_id: 'ord1' },
      ]);
      sqlite.close();
    });
  });

  describe('#243 concurrent PO receiving atomic WAC', () => {
    it('computes exact Weighted Average Cost atomically across two concurrent PO receives', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT, unit TEXT, current_stock REAL, cost_per_unit REAL, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE inventory_items (id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT, current_stock REAL, cost_per_unit REAL, active INTEGER, tenant_id TEXT, updated_at TEXT, last_restocked_at TEXT);
        CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, tenant_id TEXT, created_at TEXT);
        CREATE TABLE purchase_orders (id TEXT PRIMARY KEY, supplier_id TEXT, status TEXT, tenant_id TEXT, updated_at TEXT);
        CREATE TABLE purchase_order_items (id TEXT PRIMARY KEY, purchase_order_id TEXT, ingredient_id TEXT, quantity REAL, unit_cost REAL, unit_price REAL, received_quantity REAL, tenant_id TEXT);
        CREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT);
        INSERT INTO ingredients VALUES ('ing1', 'Coffee', 'g', 1000, 300, 'default', NULL);
        INSERT INTO inventory_items (id, sku, name, unit, current_stock, cost_per_unit, active, tenant_id) VALUES ('ing1', 'ing1', 'Coffee', 'g', 1000, 300, 1, 'default');
        INSERT INTO suppliers VALUES ('supplier1', 'Synthetic Supplier', 'default');
        INSERT INTO purchase_orders VALUES ('po1', 'supplier1', 'ordered', 'default', NULL), ('po2', 'supplier1', 'ordered', 'default', NULL);
        INSERT INTO purchase_order_items VALUES ('poi1', 'po1', 'ing1', 1000, 400, 400, 0, 'default'), ('poi2', 'po2', 'ing1', 1000, 700, 700, 0, 'default');
      `);
      const { db } = createMemoryD1(sqlite, { concurrentIngredientRead: true });
      const app = createAuthApp('owner', 'default');
      registerPurchaseOrderHandlers(app as never);

      const receive = (id: string, unitCost: number) =>
        app.request(
          `/api/inventory/purchase-orders/${id}/receive`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ ingredientId: 'ing1', receivedQuantity: 1000, unitCost }] }),
          },
          { AURA_DB: db } as never
        );

      const results = await Promise.all([receive('po1', 400), receive('po2', 700)]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);

      const expectedWac = (1000 * 300 + 1000 * 400 + 1000 * 700) / 3000;
      const ingredient = sqlite
        .prepare("SELECT current_stock, cost_per_unit FROM ingredients WHERE id = 'ing1'")
        .get() as { current_stock: number; cost_per_unit: number };
      const mirror = sqlite
        .prepare("SELECT current_stock, cost_per_unit FROM inventory_items WHERE id = 'ing1'")
        .get() as { current_stock: number; cost_per_unit: number };
      const ledger = sqlite
        .prepare('SELECT ingredient_id, type, quantity, reference_id FROM stock_movements ORDER BY reference_id')
        .all();

      expect(ingredient.current_stock).toBe(3000);
      expect(ingredient.cost_per_unit).toBeCloseTo(expectedWac, 6);
      expect(mirror.current_stock).toBe(3000);
      expect(mirror.cost_per_unit).toBeCloseTo(expectedWac, 6);
      expect(ledger).toHaveLength(2);
      sqlite.close();
    });
  });
});
