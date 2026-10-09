import { createMockEnv, createMockDB, createMockKV } from '../test-utils';

export const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';
export const TEST_CAT_ID = 'cat-coffee';
export const TEST_CAT_SLUG = 'coffee-slug';

export function createProjectionTestEnv() {
  const categories = new Map<string, any>([
    [TEST_CAT_ID, { id: TEST_CAT_ID, name: 'Cà phê', slug: TEST_CAT_SLUG, sort_order: 1 }],
  ]);
  const products = new Map<string, any>();
  const menuItems = new Map<string, any>();
  let orderItemsCount = 0;

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
          const [id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order] = boundParams;
          products.set(id, { id, name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order });
        } else if (_sql.includes('UPDATE products SET name=?')) {
          const [name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order, id] = boundParams;
          const prod = products.get(id);
          if (prod) {
            Object.assign(prod, { name, slug, description, price, compare_at_price, category_id, image_url, is_available, sort_order });
          }
        } else if (_sql.includes('UPDATE products SET is_available = 0') && _sql.includes('WHERE id = ?')) {
          const prod = products.get(boundParams[0]);
          if (prod) prod.is_available = 0;
        } else if (_sql.includes('DELETE FROM products WHERE id = ?')) {
          products.delete(boundParams[0]);
        } else if (_sql.includes('INSERT INTO menu_items')) {
          const [id, category, name, price, description, image_url, tags, badge, available] = boundParams;
          menuItems.set(id, { id, category, name, price, description, image_url, tags, badge, available });
        } else if (_sql.includes('UPDATE menu_items SET available = ?') && _sql.includes('WHERE id = ?')) {
          const [available, id] = boundParams;
          const item = menuItems.get(id);
          if (item) item.available = available;
        } else if (_sql.includes('DELETE FROM menu_items WHERE id = ?')) {
          menuItems.delete(boundParams[0]);
        }
        return { success: true, changes: 1, lastRowId: 1 };
      },
      first: async () => {
        if (_sql.includes('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?')) {
          return { count: orderItemsCount };
        }
        if (_sql.includes('FROM products WHERE slug = ?')) {
          for (const p of products.values()) {
            if (p.slug === boundParams[0]) return p;
          }
          return null;
        }
        if (_sql.includes('FROM products p') && _sql.includes('WHERE p.id = ?')) {
          const prod = products.get(boundParams[0]);
          if (!prod) return null;
          const cat = categories.get(prod.category_id);
          return { ...prod, category_name: cat?.name, category_slug: cat?.slug };
        }
        if (_sql.includes('FROM products WHERE id = ?')) {
          return products.get(boundParams[0]) || null;
        }
        if (_sql.includes('FROM categories WHERE id = ?')) {
          return categories.get(boundParams[0]) || null;
        }
        if (_sql.includes('FROM menu_items WHERE id = ?')) {
          return menuItems.get(boundParams[0]) || null;
        }
        return null;
      },
      all: async () => {
        if (_sql.includes('FROM menu_items WHERE 1 = 1')) {
          const items = Array.from(menuItems.values());
          if (_sql.includes('AND available = 1')) {
            return { results: items.filter((i) => i.available === 1), success: true };
          }
          return { results: items, success: true };
        }
        if (_sql.includes('FROM products p') && _sql.includes('LEFT JOIN categories c')) {
          const results = Array.from(products.values()).map((p) => {
            const cat = categories.get(p.category_id);
            return { ...p, category_slug: cat?.slug };
          });
          return { results, success: true };
        }
        return { results: [], success: true };
      },
    };
    return stmt as any;
  };

  return {
    env: {
      ...createMockEnv(),
      AURA_DB: db,
      AUTH_KV: createMockKV(),
      JWT_SECRET: TEST_SECRET,
    } as any,
    products,
    menuItems,
    setOrderItemsCount: (c: number) => { orderItemsCount = c; },
  };
}
