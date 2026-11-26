// @vitest-environment node
/**
 * Inventory integrity: provisioning BOM shape, unit conversion blast radius, and
 * the forecasting ingredient fallback.
 *
 * All three defects share one failure mode — inventory looks fine until a tenant
 * that is not the flagship uses it. They are exercised here against real SQLite
 * rather than mocks, because the defects live in the SQL the queries issue.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { D1Database, ExecutionContext, KVNamespace } from '@cloudflare/workers-types';
import { generateJWT } from '../../lib/jwt';
import { provisionSelfServeTenant } from '../../lib/saas-provisioning';
import { inventoryForecastingRouter } from '../../routes/inventory-forecasting';
import type { Env } from '../../types/env';
import {
  deductOrderStock,
  getCanonicalRecipe,
} from '../../../../packages/domain/inventory/src/policies/inventory-recipe-policy';

const JWT_SECRET = 'inventory-integrity-regression-jwt-secret-32ch!';

function createSchemaDb(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(fs.readFileSync(path.resolve(__dirname, '../../../schema.sql'), 'utf8'));

  // Columns that live D1 carries from later migrations but the canonical schema
  // still omits. Without them the recipe lookup would take a fallback path that
  // production never takes.
  for (const ddl of ['ALTER TABLE recipes ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1']) {
    try {
      sqlite.exec(ddl);
    } catch {
      // already present
    }
  }

  const prepare = (sql: string) => {
    const bound = (params: unknown[]) => ({
      bind: (...next: unknown[]) => bound(next),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const row = sqlite.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        return (colName ? (row[colName] ?? null) : row) as unknown as T;
      },
      all: async <T = Record<string, unknown>>() => ({
        results: sqlite.prepare(sql).all(...(params as never[])) as unknown as T[],
        success: true,
        meta: { changes: 0 },
      }),
      run: async () => {
        const info = sqlite.prepare(sql).run(...(params as never[]));
        return {
          success: true,
          results: [],
          meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
        };
      },
      raw: async () => [],
    });
    return bound([]);
  };

  const db = {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out: unknown[] = [];
      for (const stmt of stmts) out.push(await stmt.run());
      return out;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;

  return { db, sqlite };
}

function createMemoryKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, String(value));
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async (key: string) => ({ value: store.get(key) ?? null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

describe('self-serve provisioning seeds a BOM the deduction path can read', () => {
  it('writes both BOM tables and deducts ingredient stock for a freshly provisioned tenant', async () => {
    const { db, sqlite } = createSchemaDb();

    const result = await provisionSelfServeTenant(db, {
      shopName: 'Quán Trà Sớm',
      slug: 'quan-tra-som',
      ownerName: 'Chủ Quán',
      ownerEmail: 'owner@quan-tra-som.test',
      ownerPhone: '0909123456',
      password: 'StrongPassword#2026',
      templateId: 'traditional-cafe',
      planId: 'pro',
    });

    // The recipe and its component rows exist in the table the deducer reads.
    const recipeId = `rcp_quan-tra-som_ca-phe-sua-da`;
    const deductRows = sqlite
      .prepare('SELECT ingredient_id, quantity, unit FROM recipe_items WHERE recipe_id = ? ORDER BY ingredient_id')
      .all(recipeId) as Array<{ ingredient_id: string; quantity: number; unit: string }>;
    expect(deductRows.length).toBeGreaterThan(0);

    const guardRows = sqlite
      .prepare('SELECT ingredient_id FROM recipe_ingredients WHERE recipe_id = ?')
      .all(recipeId) as Array<{ ingredient_id: string }>;
    expect(guardRows.map((r) => r.ingredient_id).sort()).toEqual(deductRows.map((r) => r.ingredient_id).sort());

    const stockBefore = Number(
      (sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing_quan-tra-som_cafe-bot') as {
        current_stock: number;
      }).current_stock
    );

    const deduction = await deductOrderStock(
      db,
      'ord_provisioned_1',
      [{ productId: 'prd_quan-tra-som_ca-phe-sua-da', quantity: 2 }],
      { tenantId: result.tenantId }
    );

    expect(deduction.ok).toBe(true);
    expect(deduction.depletions.length).toBeGreaterThan(0);

    const movements = sqlite
      .prepare(
        "SELECT ingredient_id, quantity FROM stock_movements WHERE reference_id = 'ord_provisioned_1' AND reference_type = 'order'"
      )
      .all() as Array<{ ingredient_id: string; quantity: number }>;
    expect(movements).toContainEqual({ ingredient_id: 'ing_quan-tra-som_cafe-bot', quantity: -50 });

    const stockAfter = Number(
      (sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing_quan-tra-som_cafe-bot') as {
        current_stock: number;
      }).current_stock
    );
    expect(stockAfter).toBeCloseTo(stockBefore - 50, 6);
  });
});

describe('incompatible BOM units degrade one component, not the whole order', () => {
  function seedTwoComponentRecipe(sqlite: DatabaseSync): void {
    sqlite.exec(`
      INSERT INTO ingredients (tenant_id, id, name, sku, unit, cost_per_unit, current_stock)
      VALUES ('default', 'ing-coffee', 'Cà phê', 'CF-1', 'g', 250, 5000),
             ('default', 'ing-cup', 'Ly giấy', 'CUP-1', 'pcs', 1200, 100);
      INSERT INTO recipes (tenant_id, id, product_id, name) VALUES ('default', 'rec-mix', 'prod-mix', 'Mix');
      INSERT INTO recipe_items (tenant_id, id, recipe_id, ingredient_id, quantity, unit)
      VALUES ('default', 'ri-1', 'rec-mix', 'ing-coffee', 25, 'g'),
             ('default', 'ri-2', 'rec-mix', 'ing-cup', 30, 'ml');
    `);
  }

  it('deducts the convertible component and skips the one whose stock unit cannot express it', async () => {
    const { db, sqlite } = createSchemaDb();
    seedTwoComponentRecipe(sqlite);

    const deduction = await deductOrderStock(db, 'ord_mixed_units', [{ productId: 'prod-mix', quantity: 2 }], {
      tenantId: 'default',
    });

    expect(deduction.ok).toBe(true);
    expect(deduction.depletions.map((d) => d.ingredientId)).toEqual(['ing-coffee']);

    const movements = sqlite
      .prepare("SELECT ingredient_id, quantity FROM stock_movements WHERE reference_id = 'ord_mixed_units'")
      .all() as Array<{ ingredient_id: string; quantity: number }>;
    expect(movements).toEqual([{ ingredient_id: 'ing-coffee', quantity: -50 }]);

    // The unusable line leaves no trace in stock.
    expect(sqlite.prepare("SELECT current_stock FROM ingredients WHERE id = 'ing-cup'").get()).toEqual({ current_stock: 100 });
  });

  it('still reports a recipe unit cost, counting only the convertible components', async () => {
    const { db, sqlite } = createSchemaDb();
    seedTwoComponentRecipe(sqlite);

    const recipe = await getCanonicalRecipe(db, 'prod-mix', 'default');

    expect(recipe).not.toBeNull();
    expect(recipe!.components).toHaveLength(2);
    expect(recipe!.unitCost).toBeCloseTo(25 * 250, 6);
  });
});

describe('forecasting lists ingredients that have no inventory_items mirror', () => {
  async function signToken(user: { id: string; role: string; tenantId: string }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return generateJWT(
      {
        id: user.id,
        sub: user.id,
        email: `${user.id}@aura.test`,
        name: user.id,
        role: user.role as never,
        tenantId: user.tenantId,
        tenant_id: user.tenantId,
        authVersion: 1,
        authTime: now,
        sessionType: 'staff-web',
        exp: now + 3600,
      } as never,
      JWT_SECRET,
      3600
    );
  }

  it('shows the mirrored item once and the ingredient-only item too', async () => {
    const { db, sqlite } = createSchemaDb();
    sqlite.exec(`
      INSERT INTO users (id, name, role, tenant_id, is_active, auth_version)
      VALUES ('mgr-b', 'Manager B', 'manager', 'store-b', 1, 1);
      INSERT INTO inventory_items (id, sku, tenant_id, name, unit, current_stock, min_stock, max_stock, active)
      VALUES ('inv-milk', 'MILK-B', 'store-b', 'Sữa tươi', 'l', 20, 5, 50, 1);
      INSERT INTO ingredients (tenant_id, id, name, sku, unit, current_stock, min_stock, max_stock)
      VALUES ('store-b', 'ing-milk', 'Sữa tươi', 'MILK-B', 'l', 20, 5, 50),
             ('store-b', 'ing-sugar', 'Đường', 'SUGAR-B', 'kg', 12, 2, 30);
    `);

    const token = await signToken({ id: 'mgr-b', role: 'manager', tenantId: 'store-b' });
    const env = { AURA_DB: db, AUTH_KV: createMemoryKv(), CACHE_KV: createMemoryKv(), JWT_SECRET } as unknown as Env;

    const res = await inventoryForecastingRouter.request(
      'http://localhost/run-rate?days=7',
      { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'store-b' } },
      env,
      ctx
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    // `inv-milk` is the mirrored row; `ing-milk` must not appear a second time;
    // `ing-sugar` has no inventory_items counterpart and must still be forecast.
    expect(body.data.map((r) => r.id).sort()).toEqual(['ing-sugar', 'inv-milk']);
  });
});
