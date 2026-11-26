// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerPurchaseOrderHandlers } from '../routes/openapi-inventory-handlers/purchase-order-handlers';

interface MemoryD1Options {
  failOnThirdItemWrite?: boolean;
  concurrentReadBarrierCount?: number;
}

function createTransactionalMemoryD1(sqlite: DatabaseSync, options: MemoryD1Options = {}) {
  let failThirdItem = Boolean(options.failOnThirdItemWrite);
  const barrierTarget = options.concurrentReadBarrierCount ?? 0;
  let ingredientReads = 0;
  let releaseBarrier!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseBarrier = resolve;
  });
  const runners = new WeakMap<object, () => unknown>();

  const db = {
    prepare(query: string) {
      let args: unknown[] = [];
      const run = () => {
        if (
          failThirdItem &&
          query.includes('UPDATE ingredients SET current_stock =') &&
          args.includes('ing-3')
        ) {
          throw new Error('simulated storage fault while applying third line item');
        }
        const res = sqlite.prepare(query).run(...(args as never[]));
        return {
          success: true,
          meta: {
            changes: Number(res.changes ?? 0),
            last_row_id: Number(res.lastInsertRowid ?? 0),
          },
        };
      };
      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async first() {
          const row = sqlite.prepare(query).get(...(args as never[])) ?? null;
          if (barrierTarget > 0 && query === 'SELECT * FROM ingredients WHERE id = ?') {
            ingredientReads += 1;
            if (ingredientReads >= barrierTarget) {
              releaseBarrier();
            }
            await barrier;
          }
          return row;
        },
        async all() {
          return {
            success: true,
            results: sqlite.prepare(query).all(...(args as never[])),
          };
        },
        async run() {
          return run();
        },
      };
      runners.set(stmt, run);
      return stmt;
    },
    async batch(statements: object[]) {
      sqlite.exec('BEGIN');
      try {
        const out = statements.map((st) => {
          const fn = runners.get(st);
          if (!fn) {
            throw new Error('Unregistered statement in D1 batch');
          }
          return fn();
        });
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };

  return {
    db,
    clearFault() {
      failThirdItem = false;
    },
  };
}

function createAuthApp(role: string = 'manager', tenantId: string = 'store-a') {
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
  registerPurchaseOrderHandlers(app as never);
  return app;
}

function seedPurchaseOrderSchema(sqlite: DatabaseSync, tenant: string = 'store-a') {
  sqlite.exec(`
    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT '${tenant}'
    );
    CREATE TABLE ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_stock REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      tenant_id TEXT DEFAULT '${tenant}',
      updated_at TEXT
    );
    CREATE TABLE inventory_items (
      id TEXT PRIMARY KEY,
      sku TEXT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_stock REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT '${tenant}',
      last_restocked_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE stock_movements (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      created_by TEXT,
      tenant_id TEXT DEFAULT '${tenant}',
      created_at TEXT
    );
    CREATE TABLE inventory_transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      notes TEXT,
      tenant_id TEXT DEFAULT '${tenant}',
      created_at TEXT
    );
    CREATE TABLE purchase_orders (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ordered',
      tenant_id TEXT DEFAULT '${tenant}',
      updated_at TEXT
    );
    CREATE TABLE purchase_order_items (
      id TEXT PRIMARY KEY,
      purchase_order_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL,
      unit_price REAL,
      received_quantity REAL DEFAULT 0,
      tenant_id TEXT DEFAULT '${tenant}'
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      metadata TEXT,
      tenant_id TEXT,
      created_at TEXT
    );
    INSERT INTO suppliers VALUES ('sup-1', 'Mekong Roasters', 1, '${tenant}');
  `);
}

describe('purchase order receive atomicity and concurrency', () => {
  it('rolls back all items, stock, WAC, ledgers, and PO status when item 3 of a 3-item PO fails, and applies exactly once on retry', async () => {
    const sqlite = new DatabaseSync(':memory:');
    seedPurchaseOrderSchema(sqlite, 'store-a');
    sqlite.exec(`
      INSERT INTO ingredients VALUES
        ('ing-1', 'Arabica Beans', 'kg', 10, 100, 'store-a', 't0'),
        ('ing-2', 'Oat Milk', 'L', 20, 50, 'store-a', 't0'),
        ('ing-3', 'Vanilla Syrup', 'btl', 5, 200, 'store-a', 't0');
      INSERT INTO inventory_items VALUES
        ('ing-1', 'ING-1', 'Arabica Beans', 'kg', 10, 100, 1, 'store-a', NULL, 't0'),
        ('ing-2', 'ING-2', 'Oat Milk', 'L', 20, 50, 1, 'store-a', NULL, 't0'),
        ('ing-3', 'ING-3', 'Vanilla Syrup', 'btl', 5, 200, 1, 'store-a', NULL, 't0');
      INSERT INTO purchase_orders VALUES ('po-3items', 'sup-1', 'ordered', 'store-a', 't0');
      INSERT INTO purchase_order_items VALUES
        ('poi-1', 'po-3items', 'ing-1', 10, 200, 200, 0, 'store-a'),
        ('poi-2', 'po-3items', 'ing-2', 20, 80, 80, 0, 'store-a'),
        ('poi-3', 'po-3items', 'ing-3', 5, 300, 300, 0, 'store-a');
    `);

    const { db, clearFault } = createTransactionalMemoryD1(sqlite, { failOnThirdItemWrite: true });
    const app = createAuthApp('manager', 'store-a');

    const payload = {
      items: [
        { ingredientId: 'ing-1', receivedQuantity: 10, unitCost: 200 },
        { ingredientId: 'ing-2', receivedQuantity: 20, unitCost: 80 },
        { ingredientId: 'ing-3', receivedQuantity: 5, unitCost: 300 },
      ],
    };

    const failedRes = await app.request(
      '/api/inventory/purchase-orders/po-3items/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { AURA_DB: db } as never
    );
    expect(failedRes.status).toBe(500);

    // Nothing from items 1 or 2 may remain applied after item 3 throws.
    const poAfterFail = sqlite
      .prepare('SELECT status, updated_at FROM purchase_orders WHERE id = ?')
      .get('po-3items') as { status: string; updated_at: string };
    expect(poAfterFail).toEqual({ status: 'ordered', updated_at: 't0' });

    const poiAfterFail = sqlite
      .prepare('SELECT id, received_quantity FROM purchase_order_items ORDER BY id')
      .all();
    expect(poiAfterFail).toEqual([
      { id: 'poi-1', received_quantity: 0 },
      { id: 'poi-2', received_quantity: 0 },
      { id: 'poi-3', received_quantity: 0 },
    ]);

    const ingAfterFail = sqlite
      .prepare('SELECT id, current_stock, cost_per_unit FROM ingredients ORDER BY id')
      .all();
    expect(ingAfterFail).toEqual([
      { id: 'ing-1', current_stock: 10, cost_per_unit: 100 },
      { id: 'ing-2', current_stock: 20, cost_per_unit: 50 },
      { id: 'ing-3', current_stock: 5, cost_per_unit: 200 },
    ]);

    const mirrorAfterFail = sqlite
      .prepare('SELECT id, current_stock, cost_per_unit FROM inventory_items ORDER BY id')
      .all();
    expect(mirrorAfterFail).toEqual([
      { id: 'ing-1', current_stock: 10, cost_per_unit: 100 },
      { id: 'ing-2', current_stock: 20, cost_per_unit: 50 },
      { id: 'ing-3', current_stock: 5, cost_per_unit: 200 },
    ]);

    const movementsAfterFail = sqlite.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get() as { cnt: number };
    const txAfterFail = sqlite.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as { cnt: number };
    expect(movementsAfterFail.cnt).toBe(0);
    expect(txAfterFail.cnt).toBe(0);

    // Clear fault and retry -> must apply each item exactly once.
    clearFault();
    const retryRes = await app.request(
      '/api/inventory/purchase-orders/po-3items/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { AURA_DB: db } as never
    );
    expect(retryRes.status).toBe(200);

    const poAfterRetry = sqlite
      .prepare('SELECT status FROM purchase_orders WHERE id = ?')
      .get('po-3items') as { status: string };
    expect(poAfterRetry.status).toBe('received');

    const poiAfterRetry = sqlite
      .prepare('SELECT id, received_quantity FROM purchase_order_items ORDER BY id')
      .all();
    expect(poiAfterRetry).toEqual([
      { id: 'poi-1', received_quantity: 10 },
      { id: 'poi-2', received_quantity: 20 },
      { id: 'poi-3', received_quantity: 5 },
    ]);

    const ingAfterRetry = sqlite
      .prepare('SELECT id, current_stock, cost_per_unit FROM ingredients ORDER BY id')
      .all();
    expect(ingAfterRetry).toEqual([
      { id: 'ing-1', current_stock: 20, cost_per_unit: 150 },
      { id: 'ing-2', current_stock: 40, cost_per_unit: 65 },
      { id: 'ing-3', current_stock: 10, cost_per_unit: 250 },
    ]);

    const mirrorAfterRetry = sqlite
      .prepare('SELECT id, current_stock, cost_per_unit FROM inventory_items ORDER BY id')
      .all();
    expect(mirrorAfterRetry).toEqual([
      { id: 'ing-1', current_stock: 20, cost_per_unit: 150 },
      { id: 'ing-2', current_stock: 40, cost_per_unit: 65 },
      { id: 'ing-3', current_stock: 10, cost_per_unit: 250 },
    ]);

    const movementsAfterRetry = sqlite.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get() as { cnt: number };
    const txAfterRetry = sqlite.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as { cnt: number };
    expect(movementsAfterRetry.cnt).toBe(3);
    expect(txAfterRetry.cnt).toBe(3);
    sqlite.close();
  });

  it('prevents double stock on concurrent double-receive of the same PO (one 200, one 409)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    seedPurchaseOrderSchema(sqlite, 'store-a');
    sqlite.exec(`
      INSERT INTO ingredients VALUES ('ing-1', 'Arabica Beans', 'kg', 50, 100, 'store-a', 't0');
      INSERT INTO inventory_items VALUES ('ing-1', 'ING-1', 'Arabica Beans', 'kg', 50, 100, 1, 'store-a', NULL, 't0');
      INSERT INTO purchase_orders VALUES ('po-race', 'sup-1', 'ordered', 'store-a', 't0');
      INSERT INTO purchase_order_items VALUES ('poi-race', 'po-race', 'ing-1', 25, 160, 160, 0, 'store-a');
    `);

    // Synchronize both concurrent requests after they have read the pre-receive state,
    // so both enter db.batch believing the PO is still 'ordered' with received_quantity = 0.
    const { db } = createTransactionalMemoryD1(sqlite, { concurrentReadBarrierCount: 2 });
    const app = createAuthApp('manager', 'store-a');

    const callReceive = () =>
      app.request(
        '/api/inventory/purchase-orders/po-race/receive',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ ingredientId: 'ing-1', receivedQuantity: 25, unitCost: 160 }],
          }),
        },
        { AURA_DB: db } as never
      );

    const [resA, resB] = await Promise.all([callReceive(), callReceive()]);
    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const ing = sqlite
      .prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE id = ?')
      .get('ing-1') as { current_stock: number; cost_per_unit: number };
    const mirror = sqlite
      .prepare('SELECT current_stock, cost_per_unit FROM inventory_items WHERE id = ?')
      .get('ing-1') as { current_stock: number; cost_per_unit: number };
    const poi = sqlite
      .prepare('SELECT received_quantity FROM purchase_order_items WHERE id = ?')
      .get('poi-race') as { received_quantity: number };
    const movCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get() as { cnt: number };
    const txCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as { cnt: number };

    const expectedWac = (50 * 100 + 25 * 160) / 75;
    expect(ing.current_stock).toBe(75);
    expect(ing.cost_per_unit).toBeCloseTo(expectedWac, 6);
    expect(mirror.current_stock).toBe(75);
    expect(mirror.cost_per_unit).toBeCloseTo(expectedWac, 6);
    expect(poi.received_quantity).toBe(25);
    expect(movCount.cnt).toBe(1);
    expect(txCount.cnt).toBe(1);
    sqlite.close();
  });

  it('computes WAC with MAX(0, current_stock) clamp and unitCost override across positive and negative starting stock', async () => {
    const sqlite = new DatabaseSync(':memory:');
    seedPurchaseOrderSchema(sqlite, 'store-a');
    sqlite.exec(`
      INSERT INTO ingredients VALUES
        ('ing-pos', 'Positive Stock Bean', 'kg', 100, 300, 'store-a', 't0'),
        ('ing-neg', 'Negative Deficit Bean', 'kg', -20, 300, 'store-a', 't0');
      INSERT INTO inventory_items VALUES
        ('ing-pos', 'POS', 'Positive Stock Bean', 'kg', 100, 300, 1, 'store-a', NULL, 't0'),
        ('ing-neg', 'NEG', 'Negative Deficit Bean', 'kg', -20, 300, 1, 'store-a', NULL, 't0');
      INSERT INTO purchase_orders VALUES ('po-wac', 'sup-1', 'ordered', 'store-a', 't0');
      INSERT INTO purchase_order_items VALUES
        ('poi-pos', 'po-wac', 'ing-pos', 50, 400, 400, 0, 'store-a'),
        ('poi-neg', 'po-wac', 'ing-neg', 50, 400, 400, 0, 'store-a');
    `);

    const { db } = createTransactionalMemoryD1(sqlite);
    const app = createAuthApp('owner', 'store-a');

    // Override unitCost on ing-pos to 600, let ing-neg use PO line unit_cost 400.
    const res = await app.request(
      '/api/inventory/purchase-orders/po-wac/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { ingredientId: 'ing-pos', receivedQuantity: 50, unitCost: 600 },
            { ingredientId: 'ing-neg', receivedQuantity: 50 },
          ],
        }),
      },
      { AURA_DB: db } as never
    );
    expect(res.status).toBe(200);

    // ing-pos: (100 * 300 + 50 * 600) / 150 = 400, stock = 150
    // ing-neg: MAX(0, -20) = 0 -> (0 * 300 + 50 * 400) / (0 + 50) = 400, stock = -20 + 50 = 30
    const posIng = sqlite
      .prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE id = ?')
      .get('ing-pos') as { current_stock: number; cost_per_unit: number };
    const negIng = sqlite
      .prepare('SELECT current_stock, cost_per_unit FROM ingredients WHERE id = ?')
      .get('ing-neg') as { current_stock: number; cost_per_unit: number };
    const posMirror = sqlite
      .prepare('SELECT current_stock, cost_per_unit FROM inventory_items WHERE id = ?')
      .get('ing-pos') as { current_stock: number; cost_per_unit: number };
    const negMirror = sqlite
      .prepare('SELECT current_stock, cost_per_unit FROM inventory_items WHERE id = ?')
      .get('ing-neg') as { current_stock: number; cost_per_unit: number };

    expect(posIng).toEqual({ current_stock: 150, cost_per_unit: 400 });
    expect(posMirror).toEqual({ current_stock: 150, cost_per_unit: 400 });
    expect(negIng).toEqual({ current_stock: 30, cost_per_unit: 400 });
    expect(negMirror).toEqual({ current_stock: 30, cost_per_unit: 400 });
    sqlite.close();
  });

  it('transitions through partially_received to received across partial receipts and blocks over-receipt', async () => {
    const sqlite = new DatabaseSync(':memory:');
    seedPurchaseOrderSchema(sqlite, 'store-a');
    sqlite.exec(`
      INSERT INTO ingredients VALUES ('ing-1', 'Arabica Beans', 'kg', 10, 100, 'store-a', 't0');
      INSERT INTO inventory_items VALUES ('ing-1', 'ING-1', 'Arabica Beans', 'kg', 10, 100, 1, 'store-a', NULL, 't0');
      INSERT INTO purchase_orders VALUES ('po-partial', 'sup-1', 'ordered', 'store-a', 't0');
      INSERT INTO purchase_order_items VALUES ('poi-1', 'po-partial', 'ing-1', 10, 200, 200, 0, 'store-a');
    `);

    const { db } = createTransactionalMemoryD1(sqlite);
    const app = createAuthApp('manager', 'store-a');

    // First partial receipt: 4 of 10
    const firstRes = await app.request(
      '/api/inventory/purchase-orders/po-partial/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ ingredientId: 'ing-1', receivedQuantity: 4 }] }),
      },
      { AURA_DB: db } as never
    );
    expect(firstRes.status).toBe(200);
    const firstBody = (await firstRes.json()) as { data: { status: string; items: Array<{ received_quantity: number }> } };
    expect(firstBody.data.status).toBe('partially_received');
    expect(Number(firstBody.data.items[0].received_quantity)).toBe(4);

    // Over-receipt attempt: 7 more (4 + 7 > 10) -> 400 with state unchanged
    const overRes = await app.request(
      '/api/inventory/purchase-orders/po-partial/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ ingredientId: 'ing-1', receivedQuantity: 7 }] }),
      },
      { AURA_DB: db } as never
    );
    expect(overRes.status).toBe(400);

    // Second partial receipt: remaining 6 of 10 -> status = 'received'
    const secondRes = await app.request(
      '/api/inventory/purchase-orders/po-partial/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ ingredientId: 'ing-1', receivedQuantity: 6 }] }),
      },
      { AURA_DB: db } as never
    );
    expect(secondRes.status).toBe(200);
    const secondBody = (await secondRes.json()) as { data: { status: string; items: Array<{ received_quantity: number }> } };
    expect(secondBody.data.status).toBe('received');
    expect(Number(secondBody.data.items[0].received_quantity)).toBe(10);

    const ing = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-1') as { current_stock: number };
    expect(ing.current_stock).toBe(20);
    sqlite.close();
  });

  it('transitions PO status to received when two concurrent partial receives complete all lines', async () => {
    const sqlite = new DatabaseSync(':memory:');
    seedPurchaseOrderSchema(sqlite, 'store-a');
    sqlite.exec(`
      INSERT INTO ingredients VALUES
        ('ing-a', 'Coffee A', 'kg', 10, 100, 'store-a', 't0'),
        ('ing-b', 'Milk B', 'L', 20, 50, 'store-a', 't0');
      INSERT INTO inventory_items VALUES
        ('ing-a', 'ING-A', 'Coffee A', 'kg', 10, 100, 1, 'store-a', NULL, 't0'),
        ('ing-b', 'ING-B', 'Milk B', 'L', 20, 50, 1, 'store-a', NULL, 't0');
      INSERT INTO purchase_orders VALUES ('po-split', 'sup-1', 'ordered', 'store-a', 't0');
      INSERT INTO purchase_order_items VALUES
        ('poi-a', 'po-split', 'ing-a', 10, 100, 100, 0, 'store-a'),
        ('poi-b', 'po-split', 'ing-b', 20, 50, 50, 0, 'store-a');
    `);

    const { db } = createTransactionalMemoryD1(sqlite, { concurrentReadBarrierCount: 2 });
    const app = createAuthApp('manager', 'store-a');

    const [resA, resB] = await Promise.all([
      app.request(
        '/api/inventory/purchase-orders/po-split/receive',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ ingredientId: 'ing-a', receivedQuantity: 10 }] }),
        },
        { AURA_DB: db } as never
      ),
      app.request(
        '/api/inventory/purchase-orders/po-split/receive',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ ingredientId: 'ing-b', receivedQuantity: 20 }] }),
        },
        { AURA_DB: db } as never
      ),
    ]);

    expect([resA.status, resB.status]).toEqual([200, 200]);
    const po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get('po-split') as { status: string };
    expect(po.status).toBe('received');
    sqlite.close();
  });
});
