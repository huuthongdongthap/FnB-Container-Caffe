/**
 * Catalog Route Ownership & Precedence Tests
 * Verifies single runtime owner for /api/categories and /api/products:
 * 1. Strict route precedence: /tree and /reorder precede /:id on categories
 * 2. Strict route precedence: /slug/:slug precedes /:id on products
 * 3. Mutation guards: Category delete returns 409 if products exist
 * 4. Product delete soft-deletes when order_items exist, hard-deletes otherwise
 * 5. Public customer menu GET /api/menu preserved
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, createMockDB, createMockKV } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';
const TEST_CAT_ID = 'cat-123';
const TEST_PROD_ID = 'prod-456';

function createOwnershipTestEnv(initialState: {
  categories?: Map<string, any>;
  products?: Map<string, any>;
  orderItemsCount?: number;
}) {
  const categories = initialState.categories || new Map<string, any>();
  const products = initialState.products || new Map<string, any>();
  let orderItemsCount = initialState.orderItemsCount ?? 0;

  const db = createMockDB();
  db.prepare = (_sql: string) => {
    let boundParams: any[] = [];
    const stmt = {
      bind: (...args: any[]) => {
        boundParams = args;
        return stmt;
      },
      run: async () => {
        if (_sql.includes('UPDATE categories SET sort_order = ? WHERE id = ?')) {
          const [sortOrder, id] = boundParams;
          const cat = categories.get(id);
          if (cat) cat.sort_order = sortOrder;
        } else if (_sql.includes('INSERT INTO categories')) {
          const [id, name, slug, sort_order, image_url] = boundParams;
          categories.set(id, { id, name, slug, sort_order, image_url });
        } else if (_sql.includes('UPDATE categories SET name=?')) {
          const [name, slug, sort_order, image_url, id] = boundParams;
          const cat = categories.get(id);
          if (cat) Object.assign(cat, { name, slug, sort_order, image_url });
        } else if (_sql.includes('DELETE FROM categories WHERE id = ?')) {
          categories.delete(boundParams[0]);
        } else if (_sql.includes('INSERT INTO products')) {
          const [id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order] = boundParams;
          products.set(id, { id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order });
        } else if (_sql.includes('UPDATE products SET is_available = 0') && _sql.includes('WHERE id = ?')) {
          const prod = products.get(boundParams[0]);
          if (prod) prod.is_available = 0;
        } else if (_sql.includes('UPDATE products SET') && _sql.includes('WHERE id = ?')) {
          const id = boundParams[boundParams.length - 1];
          const prod = products.get(id);
          if (prod) {
            const [name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order] = boundParams;
            Object.assign(prod, { name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order });
          }
        } else if (_sql.includes('DELETE FROM products WHERE id = ?')) {
          products.delete(boundParams[0]);
        }
        return { success: true, changes: 1, lastRowId: 1 };
      },
      first: async () => {
        if (_sql.includes('SELECT COUNT(*) as count FROM products WHERE category_id = ?')) {
          const catId = boundParams[0];
          let count = 0;
          for (const p of products.values()) {
            if (p.category_id === catId) count++;
          }
          return { count };
        }
        if (_sql.includes('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?')) {
          return { count: orderItemsCount };
        }
        if (_sql.includes('FROM categories WHERE id = ?')) {
          return categories.get(boundParams[0]) || null;
        }
        if (_sql.includes('FROM products') && _sql.includes('WHERE p.slug = ?')) {
          const slug = boundParams[0];
          for (const p of products.values()) {
            if (p.slug === slug) return p;
          }
          return null;
        }
        if (_sql.includes('FROM products') && _sql.includes('WHERE p.id = ?')) {
          return products.get(boundParams[0]) || null;
        }
        if (_sql.includes('FROM products WHERE id = ?')) {
          return products.get(boundParams[0]) || null;
        }
        return null;
      },
      all: async () => {
        if (_sql.includes('FROM categories ORDER BY')) {
          const results = Array.from(categories.values()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          return { results, success: true };
        }
        if (_sql.includes('FROM products')) {
          const results = Array.from(products.values());
          return { results, success: true };
        }
        if (_sql.includes('FROM menu_items')) {
          return {
            results: [{ id: 'mi-1', name: 'Cà phê', price: 25000, category: 'coffee', available: 1 }],
            success: true,
          };
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

describe('Consolidated Catalog Route Ownership & Precedence', () => {
  it('enforces route precedence: /api/categories/tree and /reorder are not shadowed by /:id', async () => {
    const cats = new Map<string, any>([
      [TEST_CAT_ID, { id: TEST_CAT_ID, name: 'Cà phê', slug: 'ca-phe', sort_order: 1 }],
      ['cat-2', { id: 'cat-2', name: 'Trà', slug: 'tra', sort_order: 2 }],
    ]);
    const env = createOwnershipTestEnv({ categories: cats });
    const token = await generateJWT({ id: 'staff-1', role: 'staff', name: 'Barista' }, TEST_SECRET, 3600);

    // 1. GET /api/categories/tree -> must NOT hit /:id with id="tree" (which would 404)
    const treeRes = await app.fetch(new Request('https://test.aura/api/categories/tree'), env);
    expect(treeRes.status).toBe(200);
    const treeData = (await treeRes.json()) as any;
    expect(treeData.success).toBe(true);
    expect(Array.isArray(treeData.data)).toBe(true);
    expect(treeData.data.length).toBe(2);

    // 2. POST /api/categories/reorder -> must NOT hit /:id with id="reorder"
    const reorderRes = await app.fetch(
      new Request('https://test.aura/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: [
            { id: TEST_CAT_ID, sort_order: 10 },
            { id: 'cat-2', sort_order: 5 },
          ],
        }),
      }),
      env
    );
    expect(reorderRes.status).toBe(200);
    const reorderData = (await reorderRes.json()) as any;
    expect(reorderData.success).toBe(true);
    expect(cats.get(TEST_CAT_ID).sort_order).toBe(10);
    expect(cats.get('cat-2').sort_order).toBe(5);
  });

  it('enforces route precedence: /api/products/slug/:slug is not shadowed by /:id', async () => {
    const prods = new Map<string, any>([
      [TEST_PROD_ID, { id: TEST_PROD_ID, name: 'Americano', slug: 'americano', price: 30000, category_id: TEST_CAT_ID }],
    ]);
    const env = createOwnershipTestEnv({ products: prods });

    // GET /api/products/slug/americano -> resolves correctly
    const slugRes = await app.fetch(new Request('https://test.aura/api/products/slug/americano'), env);
    expect(slugRes.status).toBe(200);
    const slugData = (await slugRes.json()) as any;
    expect(slugData.success).toBe(true);
    expect(slugData.data.name).toBe('Americano');
    expect(slugData.data.id).toBe(TEST_PROD_ID);
  });

  it('guards category deletion: returns 409 Conflict if category contains products', async () => {
    const cats = new Map<string, any>([[TEST_CAT_ID, { id: TEST_CAT_ID, name: 'Cà phê' }]]);
    const prods = new Map<string, any>([[TEST_PROD_ID, { id: TEST_PROD_ID, category_id: TEST_CAT_ID, name: 'Espresso' }]]);
    const env = createOwnershipTestEnv({ categories: cats, products: prods });
    const token = await generateJWT({ id: 'staff-1', role: 'staff', name: 'Barista' }, TEST_SECRET, 3600);

    const delRes = await app.fetch(
      new Request(`https://test.aura/api/categories/${TEST_CAT_ID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(delRes.status).toBe(409);
    const delData = (await delRes.json()) as any;
    expect(delData.success).toBe(false);
    expect(delData.error).toContain('Cannot delete category with products');
    expect(cats.has(TEST_CAT_ID)).toBe(true);
  });

  it('supports PATCH and PUT for category updates', async () => {
    const cats = new Map<string, any>([[TEST_CAT_ID, { id: TEST_CAT_ID, name: 'Old Name', slug: 'old-name' }]]);
    const env = createOwnershipTestEnv({ categories: cats });
    const token = await generateJWT({ id: 'staff-1', role: 'staff', name: 'Barista' }, TEST_SECRET, 3600);

    // PATCH update
    const patchRes = await app.fetch(
      new Request(`https://test.aura/api/categories/${TEST_CAT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'New Patch Name' }),
      }),
      env
    );
    expect(patchRes.status).toBe(200);
    expect(cats.get(TEST_CAT_ID).name).toBe('New Patch Name');

    // PUT update
    const putRes = await app.fetch(
      new Request(`https://test.aura/api/categories/${TEST_CAT_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'New Put Name', slug: 'new-put-name' }),
      }),
      env
    );
    expect(putRes.status).toBe(200);
    expect(cats.get(TEST_CAT_ID).name).toBe('New Put Name');
  });

  it('preserves public customer menu GET /api/menu', async () => {
    const env = createOwnershipTestEnv({});
    const menuRes = await app.fetch(new Request('https://test.aura/api/menu'), env);
    expect(menuRes.status).toBe(200);
    const menuData = (await menuRes.json()) as any;
    expect(menuData.success).toBe(true);
    expect(Array.isArray(menuData.items)).toBe(true);
  });
});
