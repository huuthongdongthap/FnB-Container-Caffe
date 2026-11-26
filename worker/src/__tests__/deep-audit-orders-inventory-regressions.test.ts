// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { updateOrder } from '../../../packages/domain/order/commands/update-order';
import { createOrder } from '../../../packages/domain/order/commands/create-order';
import { handleOpenApiUpdateOrder } from '../routes/openapi-orders-handlers/order-write-handlers';
import { registerIngredientHandlers } from '../routes/openapi-inventory-handlers/ingredient-handlers';
import { registerMovementHandlers } from '../routes/openapi-inventory-handlers/movement-handlers';
import { registerPurchaseOrderHandlers } from '../routes/openapi-inventory-handlers/purchase-order-handlers';

function createMemoryD1(
  sqlite: DatabaseSync,
  hooks?: {
    afterFirst?: (query: string, args: unknown[]) => void;
    beforeRun?: (query: string, args: unknown[]) => { meta: { changes: number } } | void;
  }
) {
  const runners = new WeakMap<object, () => { success: boolean; meta: { changes: number } }>();
  const db = {
    prepare(query: string) {
      let args: unknown[] = [];
      const run = () => {
        const override = hooks?.beforeRun?.(query, args);
        if (override) return { success: true, ...override };
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
          hooks?.afterFirst?.(query, args);
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
    async batch(statements: object[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((st) => {
          const runner = runners.get(st);
          if (!runner) throw new Error('Unknown statement in batch');
          return runner();
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };
  return db;
}

describe('Deep audit orders & inventory regressions', () => {
  it('1. updateOrder enforces assigned_shipper_id ownership for shipper field updates', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        status TEXT,
        items TEXT,
        total REAL,
        order_number TEXT,
        payment_status TEXT,
        payment_method TEXT,
        order_type TEXT,
        assigned_shipper_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        notes TEXT,
        delivery_time TEXT,
        started_at TEXT,
        ready_at TEXT,
        table_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        tenant_id TEXT,
        session_id TEXT
      );
      INSERT INTO orders (id, status, items, total, payment_status, order_type, assigned_shipper_id, tenant_id)
      VALUES ('ord-1', 'delivering', '[]', 50000, 'unpaid', 'delivery', 'shipper-1', 't1');
    `);
    const db = createMemoryD1(sqlite);

    const foreignRes = await updateOrder(
      new Request('http://localhost/api/orders/ord-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Left at door' }),
      }),
      { AURA_DB: db },
      'ord-1',
      'shipper',
      't1',
      'shipper-2'
    );
    expect(foreignRes.status).toBe(403);

    const ownRes = await updateOrder(
      new Request('http://localhost/api/orders/ord-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Arriving now' }),
      }),
      { AURA_DB: db },
      'ord-1',
      'shipper',
      't1',
      'shipper-1'
    );
    expect(ownRes.status).toBe(200);
  });

  it('2. createOrder pay_now COD rollback removes cash_payment_attributions and decrements staff_shifts', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE menu_items (id TEXT PRIMARY KEY, name TEXT, price REAL, available INTEGER, tenant_id TEXT);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, order_number TEXT, customer_name TEXT, customer_phone TEXT,
        customer_email TEXT, customer_address TEXT, items TEXT, subtotal REAL, discount REAL,
        tax REAL, total REAL, status TEXT, payment_method TEXT, payment_status TEXT,
        order_type TEXT, table_id TEXT, notes TEXT, delivery_time TEXT, is_cod INTEGER,
        customer_id TEXT, tenant_id TEXT, guest_token_hash TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY, order_id TEXT, menu_item_id TEXT, name TEXT,
        quantity INTEGER, price REAL, notes TEXT, tenant_id TEXT, created_at TEXT
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount REAL, status TEXT,
        tenant_id TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE staff_shifts (
        id TEXT PRIMARY KEY, staff_id TEXT, clock_in TEXT, clock_out TEXT,
        cash_sales REAL, total_sales REAL, order_count INTEGER, tenant_id TEXT
      );
      CREATE TABLE shift_reconciliations (id TEXT PRIMARY KEY, shift_id TEXT, tenant_id TEXT);
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY, tenant_id TEXT, shift_id TEXT, collected_by TEXT, settled_at TEXT
      );
      CREATE TABLE promotions (
        id TEXT PRIMARY KEY, code TEXT, type TEXT, value REAL, min_order_amount REAL,
        max_discount REAL, is_active INTEGER, starts_at TEXT, ends_at TEXT,
        usage_limit INTEGER, per_customer_limit INTEGER, tenant_id TEXT
      );
      CREATE TABLE promotion_redemptions (
        promotion_id TEXT, code TEXT, order_id TEXT UNIQUE, customer_id TEXT,
        discount_amount REAL, order_total REAL, tenant_id TEXT, redeemed_at TEXT
      );
      CREATE TABLE order_creation_requests (order_id TEXT);
      CREATE TABLE loyalty_transactions (order_id TEXT);
      CREATE TABLE cashback_transactions (order_id TEXT);

      INSERT INTO menu_items VALUES ('m1', 'Latte', 50000, 1, 't1');
      INSERT INTO staff_shifts VALUES ('sh-1', 'cashier-1', '2026-11-26T01:00:00Z', NULL, 100000, 100000, 2, 't1');
      INSERT INTO promotions VALUES ('p1', 'ONCE', 'fixed', 10000, 0, NULL, 1, NULL, NULL, 100, 1, 't1');
      INSERT INTO orders (id, status, customer_phone, tenant_id) VALUES ('ord-prev', 'pending', '0901234567', 't1');
    `);

    let injectedRace = false;
    const db = createMemoryD1(sqlite, {
      afterFirst(query) {
        // Inject a competing redemption right after the pre-insert promotion check so post-commit check triggers rollback
        if (!injectedRace && query.includes('FROM promotion_redemptions')) {
          injectedRace = true;
          sqlite
            .prepare(
              `INSERT INTO promotion_redemptions (promotion_id, code, order_id, customer_id, discount_amount, order_total, tenant_id, redeemed_at)
               VALUES ('p1', 'ONCE', 'ord-prev', '0901234567', 10000, 50000, 't1', '2026-11-26T02:00:00Z')`
            )
            .run();
        }
      },
    });

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': 't1' },
      body: JSON.stringify({
        items: [{ menu_item_id: 'm1', quantity: 1 }],
        customer_name: 'Alice',
        customer_phone: '0901234567',
        payment_method: 'cod',
        pay_now: true,
        order_type: 'takeaway',
        promo_code: 'ONCE',
      }),
    });

    const res = await createOrder(req, { AURA_DB: db }, undefined, {
      id: 'cashier-1',
      role: 'cashier',
      tenantId: 't1',
    });
    expect(res.status).toBe(400);

    const attrs = sqlite.prepare('SELECT * FROM cash_payment_attributions').all();
    expect(attrs).toHaveLength(0);

    const shift = sqlite
      .prepare('SELECT cash_sales, total_sales, order_count FROM staff_shifts WHERE id = ?')
      .get('sh-1') as { cash_sales: number; total_sales: number; order_count: number };
    expect(shift.cash_sales).toBe(100000);
    expect(shift.total_sales).toBe(100000);
    expect(shift.order_count).toBe(2);
  });

  it('3. handleOpenApiUpdateOrder blocks shippers on non-delivery orders and foreign assigned_shipper_id', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, status TEXT, payment_status TEXT, customer_id TEXT,
        tenant_id TEXT, order_type TEXT, assigned_shipper_id TEXT, notes TEXT, updated_at TEXT
      );
      INSERT INTO orders VALUES ('ord-dine', 'pending', 'unpaid', NULL, 't1', 'dine_in', NULL, NULL, '2026-11-26T00:00:00Z');
      INSERT INTO orders VALUES ('ord-del', 'delivering', 'unpaid', NULL, 't1', 'delivery', 'shipper-1', NULL, '2026-11-26T00:00:00Z');
    `);
    const db = createMemoryD1(sqlite);

    const app = new Hono<{ Bindings: Record<string, unknown>; Variables: { user?: { id: string; role: string; tenantId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'shipper-2', role: 'shipper', tenantId: 't1' });
      await next();
    });
    app.patch('/api/orders/:id', (c) => handleOpenApiUpdateOrder(c as never));

    const dineRes = await app.request(
      'http://localhost/api/orders/ord-dine',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 't1' },
        body: JSON.stringify({ notes: 'tamper' }),
      },
      { AURA_DB: db }
    );
    expect(dineRes.status).toBe(403);

    const foreignDelRes = await app.request(
      'http://localhost/api/orders/ord-del',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 't1' },
        body: JSON.stringify({ notes: 'tamper' }),
      },
      { AURA_DB: db }
    );
    expect(foreignDelRes.status).toBe(403);
  });

  it('4. POST /api/inventory/movements enforces SQL CAS and returns 409 on concurrent write', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY, name TEXT, unit TEXT, current_stock REAL, min_stock REAL,
        cost_per_unit REAL, unit_cost REAL, tenant_id TEXT, updated_at TEXT
      );
      CREATE TABLE inventory_transactions (
        id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL,
        reference_type TEXT, reference_id TEXT, notes TEXT, tenant_id TEXT, created_at TEXT
      );
      INSERT INTO inventory_items VALUES ('item-1', 'Milk', 'ml', 100, 10, 20, 20, 't1', '2026-11-26T01:00:00Z');
    `);

    let mutatedConcurrently = false;
    const db = createMemoryD1(sqlite, {
      afterFirst(query) {
        if (!mutatedConcurrently && query.includes('FROM inventory_items WHERE id = ?')) {
          mutatedConcurrently = true;
          sqlite
            .prepare("UPDATE inventory_items SET current_stock = 80, updated_at = '2026-11-26T01:05:00Z' WHERE id = 'item-1'")
            .run();
        }
      },
    });

    const app = new OpenAPIHono<{ Bindings: Record<string, unknown>; Variables: { user?: { id: string; role: string; tenantId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 't1' });
      await next();
    });
    registerMovementHandlers(app as never);

    const res = await app.request(
      'http://localhost/api/inventory/movements',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 't1' },
        body: JSON.stringify({
          ingredientId: 'item-1',
          type: 'in',
          quantity: 50,
          expectedStock: 100,
          expectedUpdatedAt: '2026-11-26T01:00:00Z',
        }),
      },
      { AURA_DB: db }
    );
    expect(res.status).toBe(409);
  });

  it('5. PATCH /api/inventory/ingredients/:id enforces SQL CAS on canonical inventory_items', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY, name TEXT, sku TEXT, unit TEXT, current_stock REAL,
        min_stock REAL, max_stock REAL, cost_per_unit REAL, unit_cost REAL,
        active INTEGER, is_active INTEGER, tenant_id TEXT, updated_at TEXT
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY, user_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT,
        details TEXT, tenant_id TEXT, created_at TEXT
      );
      INSERT INTO inventory_items VALUES ('item-2', 'Beans', 'SKU-2', 'g', 500, 50, 1000, 100, 100, 1, 1, 't1', '2026-11-26T01:00:00Z');
    `);

    let mutatedConcurrently = false;
    const db = createMemoryD1(sqlite, {
      afterFirst(query) {
        if (!mutatedConcurrently && query.includes('FROM inventory_items WHERE id = ?')) {
          mutatedConcurrently = true;
          sqlite
            .prepare("UPDATE inventory_items SET cost_per_unit = 120, unit_cost = 120, updated_at = '2026-11-26T01:05:00Z' WHERE id = 'item-2'")
            .run();
        }
      },
    });

    const app = new OpenAPIHono<{ Bindings: Record<string, unknown>; Variables: { user?: { id: string; role: string; tenantId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 't1' });
      await next();
    });
    registerIngredientHandlers(app as never);

    const res = await app.request(
      'http://localhost/api/inventory/ingredients/item-2',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 't1' },
        body: JSON.stringify({
          costPerUnit: 150,
          expectedCostPerUnit: 100,
          expectedUpdatedAt: '2026-11-26T01:00:00Z',
        }),
      },
      { AURA_DB: db }
    );
    expect(res.status).toBe(409);
  });

  it('6 & 7. PO receive updates canonical WAC (cost_per_unit & unit_cost) and restores them on rollback', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY, name TEXT, unit TEXT, current_stock REAL,
        cost_per_unit REAL, unit_cost REAL, last_restocked_at TEXT, tenant_id TEXT, updated_at TEXT
      );
      CREATE TABLE purchase_orders (
        id TEXT PRIMARY KEY, supplier_id TEXT, status TEXT, total_amount REAL, tenant_id TEXT, updated_at TEXT
      );
      CREATE TABLE purchase_order_items (
        id TEXT PRIMARY KEY, purchase_order_id TEXT, ingredient_id TEXT,
        quantity REAL, received_quantity REAL, unit_cost REAL, tenant_id TEXT
      );
      CREATE TABLE inventory_transactions (
        id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL,
        reference_type TEXT, reference_id TEXT, notes TEXT, tenant_id TEXT, created_at TEXT
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY, user_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT,
        details TEXT, tenant_id TEXT, created_at TEXT
      );
      INSERT INTO inventory_items VALUES ('item-3', 'Syrup', 'ml', 10, 100, 100, NULL, 't1', '2026-11-26T00:00:00Z');
      INSERT INTO purchase_orders VALUES ('po-1', 'sup-1', 'ordered', 2000, 't1', '2026-11-26T00:00:00Z');
      INSERT INTO purchase_order_items VALUES ('poi-1', 'po-1', 'item-3', 10, 0, 200, 't1');
    `);

    const db = createMemoryD1(sqlite);
    const app = new OpenAPIHono<{ Bindings: Record<string, unknown>; Variables: { user?: { id: string; role: string; tenantId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 't1' });
      await next();
    });
    registerPurchaseOrderHandlers(app as never);

    // First: successful canonical receive -> WAC = (10*100 + 10*200) / 20 = 150
    const okRes = await app.request(
      'http://localhost/api/inventory/purchase-orders/po-1/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 't1' },
        body: JSON.stringify({
          items: [{ ingredientId: 'item-3', receivedQuantity: 10, unitCost: 200 }],
        }),
      },
      { AURA_DB: db }
    );
    expect(okRes.status).toBe(200);
    const afterReceive = sqlite
      .prepare('SELECT current_stock, cost_per_unit, unit_cost FROM inventory_items WHERE id = ?')
      .get('item-3') as { current_stock: number; cost_per_unit: number; unit_cost: number };
    expect(afterReceive.current_stock).toBe(20);
    expect(afterReceive.cost_per_unit).toBe(150);
    expect(afterReceive.unit_cost).toBe(150);

    // Second: simulate a concurrent PO status transition -> atomic batch CAS rejects with 409 and rolls back stock + WAC + line receipt
    sqlite.exec(`
      INSERT INTO purchase_orders VALUES ('po-2', 'sup-1', 'ordered', 3000, 't1', '2026-11-26T00:00:00Z');
      INSERT INTO purchase_order_items VALUES ('poi-2', 'po-2', 'item-3', 10, 0, 300, 't1');
    `);
    let racedPoStatus = false;
    const conflictDb = createMemoryD1(sqlite, {
      afterFirst(query, args) {
        if (!racedPoStatus && query.includes('FROM purchase_orders WHERE id = ?') && args[0] === 'po-2') {
          racedPoStatus = true;
          sqlite.prepare("UPDATE purchase_orders SET status = 'received' WHERE id = 'po-2'").run();
        }
      },
    });
    const conflictRes = await app.request(
      'http://localhost/api/inventory/purchase-orders/po-2/receive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 't1' },
        body: JSON.stringify({
          items: [{ ingredientId: 'item-3', receivedQuantity: 10, unitCost: 300 }],
        }),
      },
      { AURA_DB: conflictDb }
    );
    expect(conflictRes.status).toBe(409);

    const afterRollback = sqlite
      .prepare('SELECT current_stock, cost_per_unit, unit_cost FROM inventory_items WHERE id = ?')
      .get('item-3') as { current_stock: number; cost_per_unit: number; unit_cost: number };
    expect(afterRollback.current_stock).toBe(20);
    expect(afterRollback.cost_per_unit).toBe(150);
    expect(afterRollback.unit_cost).toBe(150);
    const poItemAfterRollback = sqlite
      .prepare('SELECT received_quantity FROM purchase_order_items WHERE id = ?')
      .get('poi-2') as { received_quantity: number };
    expect(poItemAfterRollback.received_quantity).toBe(0);
  });
});
