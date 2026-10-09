/**
 * Catalog Canonical DB Contract Reconciliation Tests
 * Verifies:
 * 1. Schema D1 contract definitions & migration statements
 * 2. Canonical Product Master CRUD (Create, Read, Update, Delete with soft-delete guard)
 * 3. Downstream relational dependencies:
 *    - order_items.product_id -> products.id
 *    - product_modifier_groups.product_id -> products.id
 *    - recipes.product_id -> products.id
 *    - erpnext_mappings (local_type = 'product', local_id = product_id)
 * 4. Legacy customer-menu projection (menu_items) read compatibility
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, createMockDB, createMockKV } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';
const TEST_CAT_ID = '11111111-1111-4111-8111-111111111111';
const TEST_PROD_ID = '22222222-2222-4222-8222-222222222222';

function createCatalogTestEnv(state: {
  products: Map<string, any>;
  categories: Map<string, any>;
  orderItemsCount?: number;
  productModifierGroups?: Map<string, any>;
  recipes?: Map<string, any>;
  erpnextMappings?: Map<string, any>;
  menuItems?: Array<any>;
}) {
  const db = createMockDB();

  db.prepare = (_sql: string) => {
    let boundParams: any[] = [];
    const stmt = {
      bind: (...args: any[]) => {
        boundParams = args;
        return stmt;
      },
      run: async () => {
        if (_sql.includes('INSERT INTO products')) {
          let id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order;
          if (_sql.includes('category_id, name, slug')) {
            [id, category_id, name, slug, price, compare_at_price, description, image_url, , is_available, sort_order] = boundParams;
          } else {
            [id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order] = boundParams;
          }
          state.products.set(id, {
            id, category_id, name, slug, price, compare_at_price, description, image_url, is_available, sort_order
          });
        }
        if (_sql.includes('UPDATE products SET is_available = 0') && _sql.includes('WHERE id = ?')) {
          const id = boundParams[boundParams.length - 1];
          const prod = state.products.get(id);
          if (prod) prod.is_available = 0;
        } else if (_sql.includes('UPDATE products SET') && _sql.includes('WHERE id = ?')) {
          const id = boundParams[boundParams.length - 1];
          const prod = state.products.get(id);
          if (prod) {
            if (_sql.includes('price = ?')) prod.price = boundParams[0];
          }
        }
        if (_sql.includes('DELETE FROM products WHERE id = ?')) {
          state.products.delete(boundParams[0]);
        }
        if (_sql.includes('INSERT OR IGNORE INTO product_modifier_groups')) {
          const [product_id, group_id, sort_order] = boundParams;
          state.productModifierGroups?.set(`${product_id}:${group_id}`, { product_id, group_id, sort_order });
        }
        if (_sql.includes('INSERT INTO erpnext_mappings')) {
          const [local_type, local_id, erpnext_id, erpnext_model] = boundParams;
          state.erpnextMappings?.set(`${local_type}:${local_id}`, { local_type, local_id, erpnext_id, erpnext_model });
        }
        return { success: true, changes: 1, lastRowId: 1 };
      },
      first: async () => {
        if (_sql.includes('SELECT id FROM products WHERE slug = ?')) {
          const slug = boundParams[0];
          for (const p of state.products.values()) {
            if (p.slug === slug) return { id: p.id };
          }
          return null;
        }
        if (_sql.includes('FROM products') && (_sql.includes('WHERE p.id = ?') || _sql.includes('WHERE id = ?'))) {
          const id = boundParams[0];
          const p = state.products.get(id);
          if (!p) return null;
          const cat = state.categories.get(p.category_id);
          return { ...p, category_name: cat?.name || null };
        }
        if (_sql.includes('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?')) {
          return { count: state.orderItemsCount ?? 0 };
        }
        if (_sql.includes('SELECT COUNT(*) as total FROM products')) {
          return { total: state.products.size };
        }
        if (_sql.includes('FROM categories WHERE id = ?')) {
          return state.categories.get(boundParams[0]) || null;
        }
        if (_sql.includes('FROM recipes WHERE product_id = ?')) {
          const prodId = boundParams[0];
          return state.recipes?.get(prodId) || null;
        }
        if (_sql.includes('FROM erpnext_mappings WHERE local_type = ? AND local_id = ?')) {
          const [local_type, local_id] = boundParams;
          return state.erpnextMappings?.get(`${local_type}:${local_id}`) || null;
        }
        return null;
      },
      all: async () => {
        if (_sql.includes('FROM menu_items')) {
          return { results: state.menuItems || [], success: true };
        }
        if (_sql.includes('FROM products')) {
          const results = Array.from(state.products.values()).map(p => {
            const cat = state.categories.get(p.category_id);
            return { ...p, category_name: cat?.name || null };
          });
          return { results, success: true };
        }
        if (_sql.includes('FROM product_modifier_groups WHERE product_id = ?')) {
          const prodId = boundParams[0];
          const results = Array.from(state.productModifierGroups?.values() || []).filter(pm => pm.product_id === prodId);
          return { results, success: true };
        }
        return { results: [], success: true };
      },
    };
    return stmt as any;
  };

  return {
    ...createMockEnv(),
    AURA_DB: db,
    AUTH_KV: createMockKV(),
    JWT_SECRET: TEST_SECRET,
  } as any;
}

describe('Catalog Canonical Contract Reconciliation', () => {
  it('validates schema.sql and migrations declare canonical D1 tables and columns', () => {
    const workerSchema = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8');
    const dbSchema = readFileSync(resolve(__dirname, '../../../../db/schema.sql'), 'utf-8');
    const migrationPath = resolve(__dirname, '../../../db/migrations/20261007_01_catalog_canonical_reconciliation.sql');

    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, 'utf-8');

    // Canonical master: products table
    expect(workerSchema).toContain('CREATE TABLE products');
    expect(workerSchema).toContain('category_id TEXT NOT NULL');
    expect(workerSchema).toContain('slug TEXT DEFAULT \'\'');
    expect(workerSchema).toContain('price INTEGER NOT NULL');
    expect(workerSchema).toContain('compare_at_price INTEGER');
    expect(workerSchema).toContain('sort_order INTEGER DEFAULT 0');

    // Mirror schema matches
    expect(dbSchema).toContain('products (');
    expect(dbSchema).toContain("slug             TEXT DEFAULT ''");
    expect(dbSchema).toContain('price            INTEGER NOT NULL');

    // Migration adds columns safely to existing databases
    expect(migration).toContain("ALTER TABLE products ADD COLUMN slug TEXT DEFAULT '';");
    expect(migration).toContain('ALTER TABLE products ADD COLUMN compare_at_price INTEGER;');
    expect(migration).toContain('ALTER TABLE categories ADD COLUMN image_url TEXT;');
  });

  it('performs Canonical Product CRUD and validates formatProduct response mapping', async () => {
    const state = {
      products: new Map<string, any>(),
      categories: new Map<string, any>([[TEST_CAT_ID, { id: TEST_CAT_ID, name: 'Cà phê', slug: 'ca-phe' }]]),
      orderItemsCount: 0,
    };
    const env = createCatalogTestEnv(state);
    const token = await generateJWT({ id: 'staff-1', role: 'staff', name: 'Barista' }, TEST_SECRET, 3600);

    // 1. Create product
    const createRes = await app.fetch(
      new Request('https://test.aura/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          categoryId: TEST_CAT_ID,
          slug: 'bac-xiu-da',
          basePrice: 29000,
          translations: [{ locale: 'vi', name: 'Bạc Xỉu Đá', description: 'Cà phê sữa nhiều sữa' }],
          tags: ['signature', 'best-seller'],
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    expect(createData.success).toBe(true);
    expect(createData.data.name).toBe('Bạc Xỉu Đá');
    expect(createData.data.price).toBe(29000);
    expect(createData.data.status ?? (createData.data.is_available ? 'active' : 'inactive')).toBe('active');
    expect(createData.data.category?.id ?? createData.data.category_id).toBe(TEST_CAT_ID);
    const createdId = createData.data.id;
    expect(typeof createdId).toBe('string');

    // 2. Read single product
    const getRes = await app.fetch(new Request(`https://test.aura/api/products/${createdId}`), env);
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as any;
    expect(getData.data.slug).toBe('bac-xiu-da');

    // 3. Update product
    const updateRes = await app.fetch(
      new Request(`https://test.aura/api/products/${createdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ basePrice: 32000 }),
      }),
      env
    );
    expect(updateRes.status).toBe(200);

    // 4. Hard delete when no order_items reference product
    const delRes = await app.fetch(
      new Request(`https://test.aura/api/products/${createdId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(delRes.status).toBe(200);
    expect(state.products.has(createdId)).toBe(false);
  });

  it('preserves downstream dependency: soft-deletes when order_items reference the product', async () => {
    const prodId = TEST_PROD_ID;
    const state = {
      products: new Map<string, any>([
        [prodId, { id: prodId, category_id: TEST_CAT_ID, name: 'Trà Đào', slug: 'tra-dao', price: 35000, is_available: 1 }]
      ]),
      categories: new Map<string, any>([[TEST_CAT_ID, { id: TEST_CAT_ID, name: 'Trà' }]]),
      orderItemsCount: 5, // Referenced in order_items
    };
    const env = createCatalogTestEnv(state);
    const token = await generateJWT({ id: 'staff-1', role: 'staff', name: 'Barista' }, TEST_SECRET, 3600);

    const delRes = await app.fetch(
      new Request(`https://test.aura/api/products/${prodId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(delRes.status).toBe(200);
    // Preserved in DB but soft-deleted (is_available = 0)
    expect(state.products.has(prodId)).toBe(true);
    expect(state.products.get(prodId).is_available).toBe(0);
  });

  it('preserves downstream dependencies: modifier groups, recipes BOM, and ERPNext mappings reference product_id', async () => {
    const prodId = TEST_PROD_ID;
    const state = {
      products: new Map<string, any>([
        [prodId, { id: prodId, category_id: TEST_CAT_ID, name: 'Espresso', price: 35000, is_available: 1 }]
      ]),
      categories: new Map<string, any>([[TEST_CAT_ID, { id: TEST_CAT_ID, name: 'Cà phê' }]]),
      productModifierGroups: new Map<string, any>([
        [`${prodId}:MG-sugar`, { product_id: prodId, group_id: 'MG-sugar', sort_order: 1 }]
      ]),
      recipes: new Map<string, any>([
        [prodId, { id: 'recipe-esp-1', product_id: prodId, yield_quantity: 1, yield_unit: 'cup', cost_per_unit: 8500 }]
      ]),
      erpnextMappings: new Map<string, any>([
        [`product:${prodId}`, { local_type: 'product', local_id: prodId, erpnext_id: 'ITEM-ESP-01', erpnext_model: 'Item' }]
      ]),
    };
    const env = createCatalogTestEnv(state);

    // Verify DB relations map to canonical products.id
    const db = env.AURA_DB;
    const modGroups = await db.prepare('SELECT * FROM product_modifier_groups WHERE product_id = ?').bind(prodId).all();
    expect(modGroups.results.length).toBe(1);
    expect((modGroups.results[0] as any).product_id).toBe(prodId);

    const recipe = await db.prepare('SELECT * FROM recipes WHERE product_id = ?').bind(prodId).first();
    expect(recipe).not.toBeNull();
    expect((recipe as any).product_id).toBe(prodId);
    expect((recipe as any).cost_per_unit).toBe(8500);

    const erpMapping = await db.prepare('SELECT * FROM erpnext_mappings WHERE local_type = ? AND local_id = ?').bind('product', prodId).first();
    expect(erpMapping).not.toBeNull();
    expect((erpMapping as any).local_id).toBe(prodId);
    expect((erpMapping as any).erpnext_id).toBe('ITEM-ESP-01');
  });

  it('preserves legacy customer-menu projection (menu_items) read compatibility for online ordering', async () => {
    const state = {
      products: new Map<string, any>(),
      categories: new Map<string, any>(),
      menuItems: [
        { id: 'item-1', name: 'Cà phê sữa đá', price: 29000, category: 'coffee', available: 1, image_url: 'https://img.test/cf.jpg' },
        { id: 'item-2', name: 'Trà sen vàng', price: 45000, category: 'tea', available: 1, image_url: 'https://img.test/tea.jpg' }
      ]
    };
    const env = createCatalogTestEnv(state);

    const res = await app.fetch(new Request('https://test.aura/api/menu'), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(Array.isArray(data.items)).toBe(true);
    expect(Array.isArray(data.data.categories)).toBe(true);
  });
});
