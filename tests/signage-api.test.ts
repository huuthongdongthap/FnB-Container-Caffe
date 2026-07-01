/**
 * Signage API Tests — Xibo digital signage widget endpoints
 *
 * Tests /api/signage/menu and /api/signage/promos endpoints.
 * These endpoints return public data for local network Xibo players.
 * No auth required, CORS enabled, Cache-Control: public, max-age=300.
 *
 * @jest-test-type unit
 */

import { describe, test, expect, vi } from 'vitest';
import { signageRouter } from '../worker/src/routes/signage.ts';

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {};
  ['categories', 'products', 'promotions']
    .forEach(t => { tables[t] = [...(seedData[t] || [])]; });

  function parseWhere(sql: string) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const table = fromMatch ? fromMatch[1] : null;
    const condMatch = sql.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/g);
    if (!condMatch || !table) return null;
    const conditions: Array<{ col: string; op: string; bindIdx?: number; literal?: string | number }> = [];
    let bindIdx = 0;
    for (const c of condMatch) {
      const m = c.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/)!;
      const vt = m[3];
      if (vt === '?') { conditions.push({ col: m[1], op: m[2], bindIdx }); bindIdx++; }
      else if (vt.startsWith("'") || vt.startsWith('"')) { conditions.push({ col: m[1], op: m[2], literal: vt.slice(1, -1) }); }
      else { conditions.push({ col: m[1], op: m[2], literal: Number(vt) }); }
    }
    return { table, conditions };
  }

  function matchRow(row: any, conditions: any[], bindValues: any[], q: string) {
    const beforeWhere = q.split('WHERE')[0];
    const placeholdersInBeforeWhere = (beforeWhere.match(/\?/g) || []).length;
    for (const cond of conditions) {
      const val = cond.literal !== undefined ? cond.literal : bindValues[placeholdersInBeforeWhere + cond.bindIdx];
      const rowVal = row[cond.col];
      if (rowVal == null && val != null) return false;
      switch (cond.op) {
        case '=':  if (String(rowVal) !== String(val)) return false; break;
        case '!=': if (String(rowVal) === String(val)) return false; break;
        case '>':  if (Number(rowVal) <= Number(val)) return false; break;
        case '<':  if (Number(rowVal) >= Number(val)) return false; break;
        default:   if (String(rowVal) !== String(val)) return false; break;
      }
    }
    return true;
  }

  /**
   * Parse SQL column aliases from SELECT clause.
   * Handles: col AS alias, table.col AS alias
   */
  function parseAliases(sql: string) {
    const selectEnd = sql.search(/\bFROM\b/i);
    if (selectEnd === -1) return null;
    const selectClause = sql.slice(0, selectEnd).replace(/SELECT\s+/i, '').trim();
    const aliases: Record<string, string> = {};
    const re = /(?:(\w+)\.)?(\w+)\s+AS\s+(\w+)/gi;
    let m;
    while ((m = re.exec(selectClause)) !== null) {
      aliases[m[3].toLowerCase()] = m[2];
    }
    return Object.keys(aliases).length > 0 ? aliases : null;
  }

  /**
   * Determine the primary table name from SQL (first table after FROM/JOIN).
   */
  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  function applyAliases(row: any, aliases: Record<string, string> | null) {
    if (!aliases) return row;
    const aliased: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      aliased[key] = row[key];
    }
    for (const [alias, original] of Object.entries(aliases)) {
      if (row[original] !== undefined && !(alias in row)) {
        aliased[alias] = row[original];
      }
    }
    return aliased;
  }

  const db: any = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        all: vi.fn(async function () {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const aliases = parseAliases(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          let results;
          if (!parsed) {
            results = [...rows];
          } else if (parsed.table && tables[parsed.table]) {
            if (parsed.conditions.length === 0) {
              results = [...tables[parsed.table]];
            } else {
              results = tables[parsed.table].filter((r: any) => matchRow(r, parsed.conditions, this._bindValues, q));
            }
          } else {
            results = [...rows];
          }
          if (aliases) {
            results = results.map((r: any) => applyAliases(r, aliases));
          }
          return { results };
        }),
      };
      return stmt;
    }),
  };
  return db;
}

// ── Mock Env ──────────────────────────────────────────────────────
function createMockEnv(overrides: Record<string, any> = {}) {
  return {
    AURA_DB: createMockD1(),
    ...overrides,
  };
}

// ── Seed Data ─────────────────────────────────────────────────────
const seedCategories = [
  { id: 'cat-1', name: 'Cafe Đặc Sản', slug: 'cafe-dac-san', description: 'Specialty coffee', sort_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-2', name: 'Trà Trái Cây', slug: 'tra-trai-cay', description: 'Fruit teas', sort_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-3', name: 'Bánh Ngọt', slug: 'banh-ngot', description: 'Pastries', sort_order: 3, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

const seedProducts = [
  { id: 'prod-1', category_id: 'cat-1', name: 'Espresso', price: 35000, description: 'Đậm vị', image_url: '/images/espresso.jpg', tags: '["coffee"]', badge: null, is_available: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-2', category_id: 'cat-1', name: 'Cappuccino', price: 45000, description: 'Béo ngậy', image_url: '/images/cappuccino.jpg', tags: '["coffee","milk"]', badge: 'BESTSELLER', is_available: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-3', category_id: 'cat-2', name: 'Trà Đào', price: 39000, description: 'Trà đào cam sả', image_url: '/images/tra-dao.jpg', tags: '["tea","fruit"]', badge: null, is_available: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-4', category_id: 'cat-2', name: 'Trà Chanh', price: 25000, description: 'Mát lạnh', image_url: '/images/tra-chanh.jpg', tags: '["tea"]', badge: null, is_available: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-5', category_id: 'cat-3', name: 'Bánh Croissant', price: 25000, description: 'Bơ giòn tan', image_url: '/images/croissant.jpg', tags: '["pastry"]', badge: null, is_available: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

const seedActivePromotions = [
  { code: 'AURA20', percent: 20, max_discount: 50000, min_order: 0, usage_limit: 100, usage_count: 5, starts_at: '2026-06-01T00:00:00Z', expires_at: '2026-07-31T23:59:59Z', is_active: 1, created_at: '2026-06-01T00:00:00Z' },
  { code: 'WELCOME', percent: 10, max_discount: 30000, min_order: 0, usage_limit: 0, usage_count: 10, starts_at: null, expires_at: null, is_active: 1, created_at: '2026-06-01T00:00:00Z' },
];

const seedInactivePromotions = [
  { code: 'EXPIRED', percent: 15, max_discount: 20000, min_order: 0, usage_limit: 0, usage_count: 50, starts_at: null, expires_at: '2026-01-01T00:00:00Z', is_active: 0, created_at: '2026-01-01T00:00:00Z' },
];

describe('GET /api/signage/menu', () => {
  test('returns categories with products grouped inside', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ categories: seedCategories, products: seedProducts });

    const res = await signageRouter.request('/menu', { method: 'GET' }, env);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    // Verify categories are sorted by sort_order
    expect(body.data[0].id).toBe('cat-1');
    expect(body.data[1].id).toBe('cat-2');
    expect(body.data[2].id).toBe('cat-3');
  });

  test('each category contains products with name, price, image', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ categories: seedCategories, products: seedProducts });

    const res = await signageRouter.request('/menu', { method: 'GET' }, env);
    const body: any = await res.json();

    const cafeCategory = body.data.find((c: any) => c.id === 'cat-1');
    expect(cafeCategory).toBeDefined();
    expect(Array.isArray(cafeCategory.products)).toBe(true);
    expect(cafeCategory.products.length).toBeGreaterThan(0);

    const product = cafeCategory.products[0];
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('image');
    expect(typeof product.name).toBe('string');
    expect(typeof product.price).toBe('number');
    expect(typeof product.image).toBe('string');
  });

  test('products are sorted alphabetically within categories (SQL ORDER BY)', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({
      categories: [{ id: 'cat-1', name: 'Test', slug: 'test', sort_order: 1 }],
      products: [
        { id: 'prod-b', category_id: 'cat-1', name: 'B', price: 10000, image_url: '/b.jpg', is_available: 1 },
        { id: 'prod-a', category_id: 'cat-1', name: 'A', price: 10000, image_url: '/a.jpg', is_available: 1 },
        { id: 'prod-c', category_id: 'cat-1', name: 'C', price: 10000, image_url: '/c.jpg', is_available: 1 },
      ],
    });

    const res = await signageRouter.request('/menu', { method: 'GET' }, env);
    expect(res.status).toBe(200);

    // Verify SQL passed to prepare() contains ORDER BY on name ascending
    const prepareCalls = (env.AURA_DB.prepare as any).mock.calls;
    const menuQuery = prepareCalls.find((call: any) => call[0].includes('FROM products'));
    expect(menuQuery).toBeDefined();
    expect(menuQuery[0]).toMatch(/ORDER BY.*p\.name\s+ASC/i);
  });

  test('only available products (is_available = 1) are returned', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ categories: seedCategories, products: seedProducts });

    const res = await signageRouter.request('/menu', { method: 'GET' }, env);
    const body: any = await res.json();

    // Trà Chanh (prod-4) has is_available = 0, should not appear
    const allProducts = body.data.flatMap((c: any) => c.products);
    const unavailable = allProducts.find((p: any) => p.name === 'Trà Chanh');
    expect(unavailable).toBeUndefined();
  });

  test('returns empty array for categories when no products', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({
      categories: [{ id: 'cat-1', name: 'Empty', slug: 'empty', sort_order: 1 }],
      products: [],
    });

    const res = await signageRouter.request('/menu', { method: 'GET' }, env);
    const body: any = await res.json();

    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test('sets Cache-Control header to public, max-age=300', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ categories: seedCategories, products: seedProducts });

    const res = await signageRouter.request('/menu', { method: 'GET' }, env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  test('returns 200 without auth token (public endpoint)', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ categories: seedCategories, products: seedProducts });

    const res = await signageRouter.request('/menu', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('GET /api/signage/promos', () => {
  test('returns only active promotions', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({
      promotions: [...seedActivePromotions, ...seedInactivePromotions],
    });

    const res = await signageRouter.request('/promos', { method: 'GET' }, env);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // Only active promos returned (EXPIRED is is_active=0)
    const codes = body.data.map((p: any) => p.code);
    expect(codes).toContain('AURA20');
    expect(codes).toContain('WELCOME');
    expect(codes).not.toContain('EXPIRED');
  });

  test('includes discount info (percent, max_discount) and expiry dates', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ promotions: seedActivePromotions });

    const res = await signageRouter.request('/promos', { method: 'GET' }, env);
    const body: any = await res.json();

    const promo = body.data.find((p: any) => p.code === 'AURA20');
    expect(promo).toBeDefined();
    expect(promo).toHaveProperty('percent');
    expect(promo).toHaveProperty('max_discount');
    expect(promo).toHaveProperty('expires_at');
    expect(typeof promo.percent).toBe('number');
    expect(typeof promo.max_discount).toBe('number');
  });

  test('returns empty array when no active promotions', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ promotions: [] });

    const res = await signageRouter.request('/promos', { method: 'GET' }, env);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test('sets Cache-Control header to public, max-age=300', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ promotions: seedActivePromotions });

    const res = await signageRouter.request('/promos', { method: 'GET' }, env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  test('returns 200 without auth token (public endpoint)', async () => {
    const env = createMockEnv();
    env.AURA_DB = createMockD1({ promotions: seedActivePromotions });

    const res = await signageRouter.request('/promos', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
  });
});
