// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deductOrderStock } from '../../../packages/domain/inventory/src/policies/inventory-recipe-policy';
import {
  deductInventoryForOrder,
  restoreInventoryForOrder,
} from '../../../packages/domain/inventory/src/routes/order-deduction';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../worker/db/migrations/20261126_01_stock_movements_order_consumption_dedup.sql'
);

const BASE_SCHEMA = `
  CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_status TEXT, tenant_id TEXT);
  CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT, unit TEXT, current_stock REAL, cost_per_unit REAL, tenant_id TEXT, updated_at TEXT);
  CREATE TABLE inventory_items (id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT, current_stock REAL, cost_per_unit REAL, active INTEGER, tenant_id TEXT, updated_at TEXT);
  CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, tenant_id TEXT, created_at TEXT);
  CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, tenant_id TEXT, created_at TEXT);
  CREATE TABLE recipes (id TEXT PRIMARY KEY, product_id TEXT, name TEXT, instructions TEXT, is_active INTEGER, tenant_id TEXT);
  CREATE TABLE recipe_items (id TEXT PRIMARY KEY, recipe_id TEXT, ingredient_id TEXT, quantity REAL, unit TEXT);
  INSERT INTO orders VALUES ('ord1', 'pending', 'paid', 'default');
  INSERT INTO ingredients VALUES
    ('ing1', 'Coffee', 'g', 100, 1, 'default', NULL),
    ('ing2', 'Milk', 'ml', 100, 1, 'default', NULL);
  INSERT INTO inventory_items (id, sku, name, unit, current_stock, cost_per_unit, active, tenant_id)
    VALUES ('ing1', 'ing1', 'Coffee', 'g', 100, 1, 1, 'default'), ('ing2', 'ing2', 'Milk', 'ml', 100, 1, 1, 'default');
  INSERT INTO recipes VALUES ('recipe1', 'drink1', 'Coffee milk', NULL, 1, 'default');
  INSERT INTO recipe_items VALUES ('ri1', 'recipe1', 'ing1', 10, 'g'), ('ri2', 'recipe1', 'ing2', 10, 'ml');
`;

interface HarnessOptions {
  /** Release a shared barrier once both concurrent callers have read ingredient rows. */
  rendezvousIngredientRead?: boolean;
  /** Run the write path without db.batch, exercising the sequential fallback. */
  disableBatch?: boolean;
  /** Report a stale (higher) current_stock for the pre-write verification read. */
  staleVerificationStock?: Record<string, number>;
}

function createMemoryD1(sqlite: DatabaseSync, options: HarnessOptions = {}) {
  let releaseBarrier!: () => void;
  const barrier = new Promise<void>((r) => {
    releaseBarrier = r;
  });
  let ingredientReads = 0;
  const runners = new WeakMap<object, () => unknown>();
  const STALE_SQL = 'SELECT id, current_stock, tenant_id FROM ingredients WHERE id = ?';

  const db = {
    prepare(query: string) {
      let args: unknown[] = [];
      const run = () => {
        const result = sqlite.prepare(query).run(...(args as never[]));
        return { success: true, meta: { changes: Number(result.changes) } };
      };
      const st = {
        bind(...values: unknown[]) {
          args = values;
          return st;
        },
        async first() {
          if (options.staleVerificationStock && query === STALE_SQL) {
            const id = String(args[0]);
            const stale = options.staleVerificationStock[id];
            if (typeof stale === 'number') {
              return { id, current_stock: stale, tenant_id: 'default' };
            }
          }
          const row = sqlite.prepare(query).get(...(args as never[])) ?? null;
          if (options.rendezvousIngredientRead && query === 'SELECT id, tenant_id FROM ingredients WHERE id = ?') {
            ingredientReads += 1;
            if (ingredientReads >= 2) releaseBarrier();
            await barrier;
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
  return db;
}

function seed(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(BASE_SCHEMA);
  sqlite.exec(readFileSync(MIGRATION_PATH, 'utf8'));
  return sqlite;
}

function consumptionRows(sqlite: DatabaseSync) {
  return sqlite
    .prepare(
      "SELECT id, ingredient_id, type, quantity, reference_id FROM stock_movements WHERE reference_id = 'ord1' ORDER BY ingredient_id"
    )
    .all();
}

describe('BOM deduction concurrency and ledger idempotency', () => {
  it('deducts once when two concurrent retries both pass the pre-write idempotency check', async () => {
    const sqlite = seed();
    const db = createMemoryD1(sqlite, { rendezvousIngredientRead: true });

    const [first, second] = await Promise.all([
      deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], { tenantId: 'default' }),
      deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], { tenantId: 'default' }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const applied = [first, second].filter((r) => !r.alreadyDeducted);
    expect(applied).toHaveLength(1);
    expect(applied[0].depletions.map((d) => d.ingredientId).sort()).toEqual(['ing1', 'ing2']);
    const skipped = [first, second].find((r) => r.alreadyDeducted);
    expect(skipped?.depletions).toEqual([]);

    expect(consumptionRows(sqlite)).toEqual([
      { id: expect.any(String), ingredient_id: 'ing1', type: 'consumption', quantity: -10, reference_id: 'ord1' },
      { id: expect.any(String), ingredient_id: 'ing2', type: 'consumption', quantity: -10, reference_id: 'ord1' },
    ]);
    expect(sqlite.prepare('SELECT id, current_stock FROM ingredients ORDER BY id').all()).toEqual([
      { id: 'ing1', current_stock: 90 },
      { id: 'ing2', current_stock: 90 },
    ]);
    sqlite.close();
  });

  it('keeps a single ledger row and a single deduction when the webhook path is retried concurrently', async () => {
    const sqlite = seed();
    const db = createMemoryD1(sqlite, { rendezvousIngredientRead: true });

    await Promise.all([
      deductInventoryForOrder({ AURA_DB: db as never }, 'ord1', [{ product_id: 'drink1', quantity: 1 }], 'default'),
      deductInventoryForOrder({ AURA_DB: db as never }, 'ord1', [{ product_id: 'drink1', quantity: 1 }], 'default'),
    ]);

    expect(consumptionRows(sqlite)).toEqual([
      { id: expect.any(String), ingredient_id: 'ing1', type: 'consumption', quantity: -10, reference_id: 'ord1' },
      { id: expect.any(String), ingredient_id: 'ing2', type: 'consumption', quantity: -10, reference_id: 'ord1' },
    ]);
    expect(sqlite.prepare('SELECT id, current_stock FROM ingredients ORDER BY id').all()).toEqual([
      { id: 'ing1', current_stock: 90 },
      { id: 'ing2', current_stock: 90 },
    ]);
    expect(sqlite.prepare('SELECT id, current_stock FROM inventory_items ORDER BY id').all()).toEqual([
      { id: 'ing1', current_stock: 90 },
      { id: 'ing2', current_stock: 90 },
    ]);
    sqlite.close();
  });

  it('refuses a second deduction of the same order even when the pre-check is bypassed entirely', async () => {
    const sqlite = seed();
    const db = createMemoryD1(sqlite);

    const first = await deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], { tenantId: 'default' });
    expect(first.ok).toBe(true);
    // Rewind stock so only the database constraint, not the stock guard, can prevent a second deduction
    sqlite.exec('UPDATE ingredients SET current_stock = 100');
    const second = await deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], { tenantId: 'default' });

    expect(second.alreadyDeducted).toBe(true);
    expect(second.depletions).toEqual([]);
    expect(consumptionRows(sqlite)).toHaveLength(2);
    expect(sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing1')).toEqual({ current_stock: 100 });
    sqlite.close();
  });

  it('re-keys pre-existing duplicate consumption rows instead of deleting them and blocks new duplicates', () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(BASE_SCHEMA);
    sqlite.exec(`
      INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, notes, tenant_id, created_at) VALUES
        ('dup_early', 'ing1', 'consumption', -10, 'ord1', 'order', 'first', 'default', '2026-01-01T00:00:00Z'),
        ('dup_late',  'ing1', 'consumption', -10, 'ord1', 'order', 'second', 'default', '2026-01-02T00:00:00Z'),
        ('dup_null',  'ing1', 'consumption', -10, 'ord1', 'order', NULL, NULL, '2026-01-03T00:00:00Z'),
        ('restore',   'ing1', 'adjustment', 10, 'ord1', 'order', NULL, 'default', '2026-01-04T00:00:00Z');
    `);

    const migration = readFileSync(MIGRATION_PATH, 'utf8');
    sqlite.exec(migration);

    const rows = sqlite
      .prepare("SELECT id, type, quantity, notes FROM stock_movements WHERE reference_id = 'ord1' ORDER BY id")
      .all();
    expect(rows).toEqual([
      { id: 'dup_early', type: 'consumption', quantity: -10, notes: 'first' },
      { id: 'dup_late', type: 'consumption_duplicate', quantity: -10, notes: 'second [duplicate order consumption re-keyed]' },
      { id: 'dup_null', type: 'consumption_duplicate', quantity: -10, notes: '[duplicate order consumption re-keyed]' },
      { id: 'restore', type: 'adjustment', quantity: 10, notes: null },
    ]);

    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type, tenant_id) VALUES ('dup_new', 'ing1', 'consumption', -10, 'ord1', 'order', 'default')"
        )
        .run()
    ).toThrow(/UNIQUE constraint failed/);

    // Re-applying must be a no-op and must not fail
    expect(() => sqlite.exec(migration)).not.toThrow();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM stock_movements WHERE type = 'consumption'").get()).toEqual({ n: 1 });
    sqlite.close();
  });

  it('restores stock on void without breaking the index and never re-deducts the voided order', async () => {
    const sqlite = seed();
    const db = createMemoryD1(sqlite);
    const env = { AURA_DB: db as never };

    const deducted = await deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], { tenantId: 'default' });
    expect(deducted.ok).toBe(true);

    await restoreInventoryForOrder(env as never, 'ord1', 'default', 'pending');
    await restoreInventoryForOrder(env as never, 'ord1', 'default', 'pending');

    const restoreRows = sqlite
      .prepare("SELECT ingredient_id, type, quantity FROM stock_movements WHERE reference_id = 'ord1' AND type = 'adjustment' ORDER BY ingredient_id")
      .all();
    expect(restoreRows).toEqual([
      { ingredient_id: 'ing1', type: 'adjustment', quantity: 10 },
      { ingredient_id: 'ing2', type: 'adjustment', quantity: 10 },
    ]);
    expect(sqlite.prepare('SELECT id, current_stock FROM ingredients ORDER BY id').all()).toEqual([
      { id: 'ing1', current_stock: 100 },
      { id: 'ing2', current_stock: 100 },
    ]);

    // The consumption ledger row survives the void, so a redelivered webhook is still a no-op
    const retried = await deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], { tenantId: 'default' });
    expect(retried.alreadyDeducted).toBe(true);
    expect(retried.depletions).toEqual([]);
    expect(sqlite.prepare('SELECT id, current_stock FROM ingredients ORDER BY id').all()).toEqual([
      { id: 'ing1', current_stock: 100 },
      { id: 'ing2', current_stock: 100 },
    ]);
    sqlite.close();
  });

  it('keeps stock non-negative in the sequential fallback when stock drops after the pre-check', async () => {
    const sqlite = seed();
    // The verification read still sees 100 while the real row holds only 4: the write-time guard must hold
    const db = createMemoryD1(sqlite, {
      disableBatch: true,
      staleVerificationStock: { ing1: 100 },
    });
    sqlite.exec("UPDATE ingredients SET current_stock = 4 WHERE id = 'ing1'");

    const result = await deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], { tenantId: 'default' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('insufficient_stock');
    expect(result.insufficientIngredients).toEqual([{ ingredientId: 'ing1', needed: 10, available: 4 }]);
    expect(result.depletions.map((d) => d.ingredientId)).toEqual(['ing2']);
    const rows = sqlite
      .prepare("SELECT ingredient_id, type, quantity FROM stock_movements WHERE reference_id = 'ord1'")
      .all();
    expect(rows).toEqual([{ ingredient_id: 'ing2', type: 'consumption', quantity: -10 }]);
    expect(sqlite.prepare('SELECT id, current_stock FROM ingredients ORDER BY id').all()).toEqual([
      { id: 'ing1', current_stock: 4 },
      { id: 'ing2', current_stock: 90 },
    ]);
    sqlite.close();
  });

  it('folds two order lines resolving to the same ingredient into one ledger row without losing stock', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_status TEXT, tenant_id TEXT);
      CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT, unit TEXT, current_stock REAL, cost_per_unit REAL, tenant_id TEXT, updated_at TEXT);
      CREATE TABLE stock_movements (id TEXT PRIMARY KEY, ingredient_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, tenant_id TEXT, created_at TEXT);
      CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT, type TEXT, quantity REAL, reference_id TEXT, reference_type TEXT, notes TEXT, tenant_id TEXT, created_at TEXT);
      CREATE TABLE recipes (id TEXT PRIMARY KEY, product_id TEXT, name TEXT, instructions TEXT, is_active INTEGER, tenant_id TEXT);
      CREATE TABLE recipe_items (id TEXT PRIMARY KEY, recipe_id TEXT, ingredient_id TEXT, quantity REAL, unit TEXT);
      INSERT INTO orders VALUES ('ord1', 'pending', 'paid', 'default');
      INSERT INTO ingredients VALUES ('bottled', 'Bottled water', 'pcs', 20, 1, 'default', NULL);
    `);
    sqlite.exec(readFileSync(MIGRATION_PATH, 'utf8'));
    const db = createMemoryD1(sqlite);

    await deductInventoryForOrder(
      { AURA_DB: db as never },
      'ord1',
      [
        { product_id: 'bottled', name: '', quantity: 3 },
        { product_id: 'bottled', name: '', quantity: 2 },
      ],
      'default'
    );

    expect(sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('bottled')).toEqual({ current_stock: 15 });
    expect(
      sqlite.prepare("SELECT type, quantity FROM stock_movements WHERE reference_id = 'ord1'").all()
    ).toEqual([{ type: 'consumption', quantity: -5 }]);
    sqlite.close();
  });

  it('allows negative stock through the sequential fallback when allowNegative is set', async () => {
    const sqlite = seed();
    const db = createMemoryD1(sqlite, { disableBatch: true });
    sqlite.exec("UPDATE ingredients SET current_stock = 4 WHERE id = 'ing1'");

    const result = await deductOrderStock(db as never, 'ord1', [{ productId: 'drink1', quantity: 1 }], {
      tenantId: 'default',
      allowNegative: true,
    });

    expect(result.ok).toBe(true);
    expect(result.depletions.map((d) => d.ingredientId).sort()).toEqual(['ing1', 'ing2']);
    expect(sqlite.prepare("SELECT current_stock FROM ingredients WHERE id = 'ing1'").get()).toEqual({ current_stock: -6 });
    sqlite.close();
  });
});
