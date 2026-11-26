// @vitest-environment node
/**
 * Stock movement write invariants.
 *
 * These tests drive the real handler against an in-memory SQLite database so the
 * guards are exercised as SQL, not as mocks. The D1 test double returns genuine
 * `meta.changes` values and runs batches inside a SQLite transaction, so a failed
 * batch really does roll back.
 */
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerMovementHandlers } from '../routes/openapi-inventory-handlers/movement-handlers';
import { IngredientCreateSchema, IngredientUpdateSchema } from '../schemas/inventory/ingredients';

interface Statement {
  run: () => Promise<{ success: boolean; meta: { changes: number } }>;
}

interface MemoryD1Options {
  /** SQLite statements that must throw once the stock row has been written */
  failOnSql?: RegExp;
  /** how many ingredient stock rows are updated before the failure fires */
  failAfter?: number;
  /** the test double omits batch(), like the smallest hand-written mocks */
  disableBatch?: boolean;
  /** invoked on every stock-mutation statement, before it executes */
  beforeWrite?: (sql: string) => void;
}

function createMemoryD1(sqlite: DatabaseSync, options: MemoryD1Options = {}) {
  const runners = new WeakMap<object, () => unknown>();
  let writesSeen = 0;

  const db: Record<string, unknown> = {
    prepare(query: string) {
      let args: unknown[] = [];
      const run = () => {
        if (/UPDATE (ingredients|inventory_items) SET current_stock/.test(query)) {
          writesSeen += 1;
          options.beforeWrite?.(query);
        }
        if (options.failOnSql?.test(query) && (options.failAfter === undefined || writesSeen >= options.failAfter)) {
          throw new Error('synthetic write failure');
        }
        const result = sqlite.prepare(query).run(...(args as never[]));
        return { success: true, meta: { changes: Number(result.changes) } };
      };
      const stmt = {
        bind(...values: unknown[]) {
          args = values;
          return stmt;
        },
        async first() {
          return sqlite.prepare(query).get(...(args as never[])) ?? null;
        },
        async all() {
          return { success: true, results: sqlite.prepare(query).all(...(args as never[])) };
        },
        async run() {
          return run();
        },
      };
      runners.set(stmt, run);
      return stmt;
    },
  };

  if (!options.disableBatch) {
    db.batch = async (statements: Statement[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((stmt) => runners.get(stmt)!());
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    };
  }

  return db as never;
}

const MOVEMENT_SCHEMA = `
  CREATE TABLE ingredients (
    id TEXT PRIMARY KEY, sku TEXT, name TEXT, category TEXT, unit TEXT,
    cost_per_unit REAL, current_stock REAL NOT NULL, min_stock REAL, max_stock REAL,
    is_active INTEGER, tenant_id TEXT, updated_at TEXT
  );
  CREATE TABLE inventory_items (
    id TEXT PRIMARY KEY, sku TEXT, name TEXT, current_stock REAL NOT NULL,
    tenant_id TEXT, updated_at TEXT
  );
  CREATE TABLE stock_movements (
    id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT,
    reference_type TEXT, notes TEXT, created_by TEXT, tenant_id TEXT, created_at TEXT
  );
  CREATE TABLE inventory_transactions (
    id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_type TEXT,
    reference_id TEXT, notes TEXT, tenant_id TEXT, created_at TEXT
  );
  INSERT INTO ingredients VALUES
    ('ing-1','CF-01','Coffee','coffee','g',10,100,10,500,1,'default','t1');
  INSERT INTO inventory_items VALUES ('ing-1','CF-01','Coffee',100,'default','t1');
`;

function createApp(role = 'manager', tenantId = 'default') {
  const app = new OpenAPIHono();
  app.use('*', async (c, next) => {
    (c as unknown as { set: (k: string, v: unknown) => void }).set('user', { id: `${role}-1`, role, tenantId });
    (c as unknown as { set: (k: string, v: unknown) => void }).set('tenantId', tenantId);
    await next();
  });
  registerMovementHandlers(app as never);
  return app;
}

function post(app: OpenAPIHono, body: Record<string, unknown>, db: never) {
  return app.request(
    '/api/inventory/movements',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { AURA_DB: db } as never
  );
}

function stockOf(sqlite: DatabaseSync) {
  const ing = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-1') as {
    current_stock: number;
  };
  const mirror = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('ing-1') as {
    current_stock: number;
  };
  return { ingredient: ing.current_stock, mirror: mirror.current_stock };
}

function ledgerCount(sqlite: DatabaseSync) {
  const mov = sqlite.prepare('SELECT COUNT(*) AS n FROM stock_movements').get() as { n: number };
  const tx = sqlite.prepare('SELECT COUNT(*) AS n FROM inventory_transactions').get() as { n: number };
  return { movements: mov.n, transactions: tx.n };
}

describe('stock movement compare-and-swap write', () => {
  it('rejects a stocktake whose expected stock is superseded between read and write', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    // A receipt lands after the handler read stock=100 but before it writes:
    // the handler's own read is still 100, the row is already 120.
    let injected = false;
    const db = createMemoryD1(sqlite, {
      beforeWrite: (sql) => {
        if (sql.includes('UPDATE ingredients') && !injected) {
          injected = true;
          sqlite.exec(
            "UPDATE ingredients SET current_stock = 120, updated_at = 't2' WHERE id = 'ing-1'; " +
              "UPDATE inventory_items SET current_stock = 120, updated_at = 't2' WHERE id = 'ing-1';"
          );
        }
      },
    });

    const res = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'adjustment', quantity: -10, expectedStock: 100 },
      db
    );

    expect(res.status).toBe(409);
    expect(stockOf(sqlite)).toEqual({ ingredient: 120, mirror: 120 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('rejects a target stocktake when the stock the delta was derived from changed concurrently', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    // Handler reads 100 and computes delta -10 for targetStock=90. Before the
    // write lands, a receipt raises stock to 140; applying -10 or blindly
    // overwriting to 90 would fabricate the ledger delta.
    let injected = false;
    const db = createMemoryD1(sqlite, {
      beforeWrite: (sql) => {
        if (sql.includes('UPDATE ingredients') && !injected) {
          injected = true;
          sqlite.exec(
            "UPDATE ingredients SET current_stock = 140, updated_at = 't2' WHERE id = 'ing-1'; " +
              "UPDATE inventory_items SET current_stock = 140, updated_at = 't2' WHERE id = 'ing-1';"
          );
        }
      },
    });

    const res = await post(createApp(), { ingredientId: 'ing-1', type: 'adjustment', targetStock: 90 }, db);

    expect(res.status).toBe(409);
    expect(stockOf(sqlite)).toEqual({ ingredient: 140, mirror: 140 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('rejects a stale updated_at precondition even when the stock value matches', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    let injected = false;
    const db = createMemoryD1(sqlite, {
      beforeWrite: (sql) => {
        if (sql.includes('UPDATE ingredients') && !injected) {
          injected = true;
          sqlite.exec("UPDATE ingredients SET updated_at = 't9' WHERE id = 'ing-1'");
        }
      },
    });

    const res = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'adjustment', quantity: 5, expectedStock: 100, expectedUpdatedAt: 't1' },
      db
    );

    expect(res.status).toBe(409);
    expect(stockOf(sqlite)).toEqual({ ingredient: 100, mirror: 100 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('sets a target stocktake atomically and writes the delta the guard matched', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    const res = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'adjustment', targetStock: 90, notes: 'End-of-shift stocktake' },
      createMemoryD1(sqlite)
    );

    expect(res.status).toBe(201);
    expect(stockOf(sqlite)).toEqual({ ingredient: 90, mirror: 90 });
    const mov = sqlite.prepare('SELECT quantity, tenant_id FROM stock_movements').get() as {
      quantity: number;
      tenant_id: string;
    };
    expect(mov).toEqual({ quantity: -10, tenant_id: 'default' });
    expect(ledgerCount(sqlite)).toEqual({ movements: 1, transactions: 1 });
    sqlite.close();
  });

  it('does not move stock when the ledger insert fails', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    const res = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'in', quantity: 25 },
      createMemoryD1(sqlite, { failOnSql: /INSERT INTO stock_movements/ })
    );

    expect(res.status).toBe(500);
    expect(stockOf(sqlite)).toEqual({ ingredient: 100, mirror: 100 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('does not move stock when the canonical transaction ledger fails', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    const res = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'in', quantity: 25 },
      createMemoryD1(sqlite, { failOnSql: /INSERT INTO inventory_transactions/ })
    );

    expect(res.status).toBe(500);
    expect(stockOf(sqlite)).toEqual({ ingredient: 100, mirror: 100 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('surfaces a ledger failure without retrying the stock write when batch() is absent', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    let stockUpdates = 0;
    const db = createMemoryD1(sqlite, {
      disableBatch: true,
      failOnSql: /INSERT INTO stock_movements/,
      beforeWrite: (sql) => {
        if (sql.includes('UPDATE ingredients')) stockUpdates += 1;
      },
    });

    const res = await post(createApp(), { ingredientId: 'ing-1', type: 'in', quantity: 25 }, db);

    expect(res.status).toBe(500);
    expect(stockUpdates).toBe(1);
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('applies an inbound receipt once and converges a drifted inventory_items mirror', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);
    // Simulate a previously drifted mirror row; the write sets the mirror from
    // the authoritative ingredient value so the two converge instead of
    // keeping a permanent offset.
    sqlite.exec("UPDATE inventory_items SET current_stock = 85 WHERE id = 'ing-1'");

    const res = await post(createApp(), { ingredientId: 'ing-1', type: 'in', quantity: 25 }, createMemoryD1(sqlite));

    expect(res.status).toBe(201);
    expect(stockOf(sqlite)).toEqual({ ingredient: 125, mirror: 125 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 1, transactions: 1 });
    sqlite.close();
  });

  it('rejects an outbound movement that would overdraw stock, without a ledger row', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    const res = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'waste', quantity: 150 },
      createMemoryD1(sqlite)
    );

    expect(res.status).toBe(400);
    expect(stockOf(sqlite)).toEqual({ ingredient: 100, mirror: 100 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('reports the outbound overdraft as insufficient stock, not as a concurrent change', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);
    // The handler reads 100, a concurrent write drops it to 40 before the guard:
    // 40 - 60 < 0 fails the non-negative guard and nothing else is stale.
    let injected = false;
    const db = createMemoryD1(sqlite, {
      beforeWrite: (sql) => {
        if (sql.includes('UPDATE ingredients') && !injected) {
          injected = true;
          sqlite.exec("UPDATE ingredients SET current_stock = 40 WHERE id = 'ing-1'");
        }
      },
    });

    const res = await post(createApp(), { ingredientId: 'ing-1', type: 'out', quantity: 60 }, db);

    expect(res.status).toBe(400);
    expect(stockOf(sqlite).ingredient).toBe(40);
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('rolls back the ingredient write when the inventory_items mirror write fails', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MOVEMENT_SCHEMA);

    const res = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'in', quantity: 10, expectedStock: 100 },
      createMemoryD1(sqlite, { failOnSql: /UPDATE inventory_items/, failAfter: 1 })
    );

    expect(res.status).toBe(500);
    expect(stockOf(sqlite)).toEqual({ ingredient: 100, mirror: 100 });
    expect(ledgerCount(sqlite)).toEqual({ movements: 0, transactions: 0 });
    sqlite.close();
  });

  it('logs a warning and completes the movement when the mirror tables are absent', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE ingredients (
        id TEXT PRIMARY KEY, sku TEXT, name TEXT, category TEXT, unit TEXT,
        cost_per_unit REAL, current_stock REAL NOT NULL, tenant_id TEXT, updated_at TEXT
      );
      CREATE TABLE stock_movements (
        id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT,
        reference_type TEXT, notes TEXT, created_by TEXT, tenant_id TEXT, created_at TEXT
      );
      INSERT INTO ingredients VALUES ('ing-1','CF-01','Coffee','coffee','g',10,100,'default','t1');
    `);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const res = await post(createApp(), { ingredientId: 'ing-1', type: 'in', quantity: 15 }, createMemoryD1(sqlite));

      expect(res.status).toBe(201);
      const ing = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-1') as {
        current_stock: number;
      };
      expect(ing.current_stock).toBe(115);
      expect(warn).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(warn.mock.calls[0]?.[0] ?? '{}')) as Record<string, unknown>;
      expect(payload).toMatchObject({
        msg: 'inventory_mirror_unavailable',
        ingredient_id: 'ing-1',
        delta: 15,
      });
    } finally {
      warn.mockRestore();
      sqlite.close();
    }
  });

  it('guards the canonical inventory_items path with the same compare-and-swap semantics', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE inventory_items (
        id TEXT PRIMARY KEY, sku TEXT, name TEXT, current_stock REAL NOT NULL,
        tenant_id TEXT, updated_at TEXT
      );
      CREATE TABLE inventory_transactions (
        id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_type TEXT,
        reference_id TEXT, notes TEXT, tenant_id TEXT, created_at TEXT
      );
      INSERT INTO inventory_items VALUES ('ing-1','CF-01','Coffee',100,'default','t1');
    `);

    let injected = false;
    const db = createMemoryD1(sqlite, {
      beforeWrite: (sql) => {
        if (sql.includes('UPDATE inventory_items') && !injected) {
          injected = true;
          sqlite.exec("UPDATE inventory_items SET current_stock = 130, updated_at = 't2' WHERE id = 'ing-1'");
        }
      },
    });

    const stale = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'adjustment', quantity: -10, expectedStock: 100 },
      db
    );
    expect(stale.status).toBe(409);

    const countBefore = (sqlite.prepare('SELECT COUNT(*) AS n FROM inventory_transactions').get() as { n: number }).n;
    expect(countBefore).toBe(0);

    const fresh = await post(
      createApp(),
      { ingredientId: 'ing-1', type: 'adjustment', targetStock: 110, expectedStock: 130 },
      createMemoryD1(sqlite)
    );
    expect(fresh.status).toBe(201);
    const item = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('ing-1') as {
      current_stock: number;
    };
    const tx = sqlite.prepare('SELECT quantity FROM inventory_transactions').get() as { quantity: number };
    expect(item.current_stock).toBe(110);
    expect(tx.quantity).toBe(-20);
    sqlite.close();
  });
});

describe('ingredient stock schema', () => {
  const base = { sku: 'CF-01', name: 'Coffee', unit: 'kg', costPerUnit: 1000 };

  it('rejects negative, non-finite and non-numeric currentStock', () => {
    for (const currentStock of [-1, -0.0001, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(IngredientCreateSchema.safeParse({ ...base, currentStock }).success).toBe(false);
      expect(IngredientUpdateSchema.safeParse({ currentStock }).success).toBe(false);
    }
  });

  it('accepts zero and fractional stock because units like kg and L are measured', () => {
    expect(IngredientCreateSchema.safeParse({ ...base, currentStock: 0 }).success).toBe(true);
    expect(IngredientCreateSchema.safeParse({ ...base, currentStock: 2.75 }).success).toBe(true);
    expect(IngredientUpdateSchema.safeParse({ currentStock: 0.5 }).success).toBe(true);
  });
});
