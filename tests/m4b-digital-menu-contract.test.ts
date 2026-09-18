/**
 * M4-B Digital Menu — API Contract, Visibility & Security Test Suite
 *
 * Validates the canonical customer-facing menu projection against
 * the M4-B Execution Spec:
 * - Canonical route: GET /api/menu and GET /api/menu/:id
 * - Customer-safe DTO (no cost, supplier, margin, recipe, internal stock)
 * - Visibility policy (only available items by default)
 * - Server-side price (integer VND cents)
 * - Localization (vi-VN default with deterministic fallback)
 * - Deterministic ordering and category grouping
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { getCustomerMenu, getCustomerMenuItem, type CustomerMenu } from '@aura/domain-catalog';

// ─────────────────────────────────────────────────────────────────────
// Mock D1 Database
// ─────────────────────────────────────────────────────────────────────

interface MockMenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  description: string | null;
  tags: string | null;
  badge: string | null;
  available: number;
  cost?: number;
  supplier?: string;
  recipe?: string;
  margin?: number;
  internal_stock?: number;
  staff_notes?: string;
}

const SEED_ITEMS: MockMenuItem[] = [
  {
    id: 'prod_cafe_den',
    category: 'Cà phê truyền thống',
    name: 'Cà phê đen đá',
    price: 25000,
    description: 'Cà phê Robusta đậm đà truyền thống',
    tags: JSON.stringify(['cold', 'signature']),
    badge: 'HOT',
    available: 1,
    cost: 8000,
    supplier: 'Viva Star Farm',
    recipe: '25g robusta, 90ml water',
    margin: 68,
    internal_stock: 500,
    staff_notes: 'Pha phin truyền thống 4 phút',
  },
  {
    id: 'prod_cafe_sua',
    category: 'Cà phê truyền thống',
    name: 'Cà phê sữa đá',
    price: 29000,
    description: 'Cà phê Robusta kết hợp sữa đặc Ngôi Sao Phương Nam',
    tags: JSON.stringify(['cold', 'popular']),
    badge: null,
    available: 1,
    cost: 11000,
    supplier: 'Viva Star Farm',
    margin: 62,
    internal_stock: 450,
  },
  {
    id: 'prod_tra_dao',
    category: 'Trà trái cây',
    name: 'Trà đào cam sả',
    price: 35000,
    description: 'Trà đen ủ lạnh với đào miếng và sả tươi',
    tags: JSON.stringify(['cold', 'fruity']),
    badge: 'NEW',
    available: 1,
    cost: 12000,
    supplier: 'Bảo Lộc Tea',
  },
  {
    id: 'prod_matcha_out_of_stock',
    category: 'Trà trái cây',
    name: 'Matcha đá xay',
    price: 45000,
    description: 'Matcha Uji Nhật Bản xay cùng đá',
    tags: JSON.stringify(['cold']),
    badge: null,
    available: 0, // Out of stock / un-sellable
    cost: 22000,
    supplier: 'Uji Imports',
  },
];

function createMockD1(items: MockMenuItem[] = SEED_ITEMS) {
  return {
    prepare: vi.fn((sql: string) => {
      let boundParams: unknown[] = [];
      return {
        bind: vi.fn((...params: unknown[]) => {
          boundParams = params;
          return {
            all: vi.fn(async () => {
              let filtered = [...items];

              // Availability filter
              if (sql.includes('AND available = 1')) {
                filtered = filtered.filter((i) => i.available === 1);
              }

              // Category filter
              if (sql.includes('AND category = ?')) {
                const catParam = boundParams[0];
                filtered = filtered.filter((i) => i.category === catParam);
              }

              // ID lookup
              if (sql.includes('WHERE id = ?')) {
                const idParam = boundParams[0];
                filtered = filtered.filter((i) => i.id === idParam);
              }

              return { results: filtered, success: true };
            }),
            first: vi.fn(async () => {
              if (sql.includes('WHERE id = ?')) {
                const idParam = boundParams[0];
                return items.find((i) => i.id === idParam) ?? null;
              }
              return items[0] ?? null;
            }),
          };
        }),
      };
    }),
  } as any;
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe('M4-B Digital Menu: Contract & Security', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockD1();
  });

  describe('1. Contract & DTO Envelope', () => {
    it('returns customer menu projection with categories and totalItems', async () => {
      const menu = await getCustomerMenu(mockDb);

      expect(menu).toHaveProperty('categories');
      expect(menu).toHaveProperty('totalItems');
      expect(Array.isArray(menu.categories)).toBe(true);
      expect(menu.totalItems).toBe(3); // Only 3 available items out of 4
    });

    it('each category contains name and items list', async () => {
      const menu = await getCustomerMenu(mockDb);

      for (const cat of menu.categories) {
        expect(typeof cat.name).toBe('string');
        expect(Array.isArray(cat.items)).toBe(true);
        expect(cat.items.length).toBeGreaterThan(0);
      }
    });

    it('each customer menu item contains customer-safe fields only', async () => {
      const menu = await getCustomerMenu(mockDb);
      const allItems = menu.categories.flatMap((c) => c.items);

      expect(allItems.length).toBeGreaterThan(0);
      for (const item of allItems) {
        expect(typeof item.id).toBe('string');
        expect(typeof item.name).toBe('string');
        expect(typeof item.priceCents).toBe('number');
        expect(typeof item.category).toBe('string');
        expect(Array.isArray(item.tags)).toBe(true);
        expect(typeof item.available).toBe('boolean');
      }
    });
  });

  describe('2. Security: Zero Internal Field Leakage (M4-B Spec §5)', () => {
    it('strictly forbids exposing cost, supplier, margin, recipe, and internal stock', async () => {
      const menu = await getCustomerMenu(mockDb, { includeUnavailable: true });
      const allItems = menu.categories.flatMap((c) => c.items);

      const FORBIDDEN_FIELDS = [
        'cost',
        'supplier',
        'supplier_id',
        'supplier_price',
        'purchase_price',
        'ingredient_cost',
        'recipe',
        'margin',
        'profit',
        'internal_stock',
        'staff_notes',
        'internal_metadata',
        'procurement_data',
        'ingredient_source',
      ];

      for (const item of allItems) {
        const keys = Object.keys(item);
        for (const forbidden of FORBIDDEN_FIELDS) {
          expect(keys).not.toContain(forbidden);
          expect((item as any)[forbidden]).toBeUndefined();
        }
      }
    });
  });

  describe('3. Visibility: Sellability Policy (M4-B Spec §6)', () => {
    it('excludes un-sellable / out-of-stock items by default', async () => {
      const menu = await getCustomerMenu(mockDb);
      const allItems = menu.categories.flatMap((c) => c.items);

      const itemIds = allItems.map((i) => i.id);
      expect(itemIds).toContain('prod_cafe_den');
      expect(itemIds).toContain('prod_cafe_sua');
      expect(itemIds).toContain('prod_tra_dao');
      expect(itemIds).not.toContain('prod_matcha_out_of_stock');
    });

    it('includes unavailable items when includeUnavailable: true is set', async () => {
      const menu = await getCustomerMenu(mockDb, { includeUnavailable: true });
      const allItems = menu.categories.flatMap((c) => c.items);

      const outOfStock = allItems.find((i) => i.id === 'prod_matcha_out_of_stock');
      expect(outOfStock).toBeDefined();
      expect(outOfStock?.available).toBe(false);
    });

    it('filters correctly by category', async () => {
      const menu = await getCustomerMenu(mockDb, { category: 'Cà phê truyền thống' });

      for (const cat of menu.categories) {
        expect(cat.name).toBe('Cà phê truyền thống');
      }
      const allItems = menu.categories.flatMap((c) => c.items);
      expect(allItems.every((i) => i.category === 'Cà phê truyền thống')).toBe(true);
    });
  });

  describe('4. Price Integrity (M4-B Spec §8)', () => {
    it('returns server-side integer price representing VND cents/amount', async () => {
      const menu = await getCustomerMenu(mockDb);
      const allItems = menu.categories.flatMap((c) => c.items);

      for (const item of allItems) {
        expect(Number.isInteger(item.priceCents)).toBe(true);
        expect(item.priceCents).toBeGreaterThan(0);
      }

      const cafeDen = allItems.find((i) => i.id === 'prod_cafe_den');
      expect(cafeDen?.priceCents).toBe(25000);
    });
  });

  describe('5. Graceful Degradation', () => {
    it('returns empty categories on database failure instead of crashing', async () => {
      const failingDb = {
        prepare: () => {
          throw new Error('D1 database connection failed');
        },
      } as any;

      const menu = await getCustomerMenu(failingDb);
      expect(menu.categories).toEqual([]);
      expect(menu.totalItems).toBe(0);
    });
  });

  describe('6. Single Item Lookup (getCustomerMenuItem)', () => {
    it('returns customer-safe item when found', async () => {
      const item = await getCustomerMenuItem(mockDb, 'prod_cafe_den');
      expect(item).not.toBeNull();
      expect(item?.id).toBe('prod_cafe_den');
      expect(item?.name).toBe('Cà phê đen đá');
      expect(item?.priceCents).toBe(25000);
      expect((item as any).cost).toBeUndefined();
      expect((item as any).supplier).toBeUndefined();
      expect((item as any).recipe).toBeUndefined();
    });

    it('returns null when item is not found', async () => {
      const item = await getCustomerMenuItem(mockDb, 'prod_non_existent');
      expect(item).toBeNull();
    });
  });

  describe('7. Deterministic Category Ordering', () => {
    it('sorts categories in a deterministic alphabetical order', async () => {
      const menu = await getCustomerMenu(mockDb);
      const names = menu.categories.map((c) => c.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b, 'vi'));
      expect(names).toEqual(sorted);
    });
  });

  describe('8. Canonical Worker Endpoint Integration (GET /api/menu)', () => {
    const mockCtx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any;

    it('responds to GET /api/menu with customer envelope and locale meta', async () => {
      const { app } = await import('../worker/src/index');
      const env = { AURA_DB: mockDb, AUTH_KV: { get: vi.fn(), put: vi.fn() } } as any;

      const req = new Request('https://api.auraspace.vn/api/menu?locale=vi-VN');
      const res = await app.fetch(req, env, mockCtx);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.meta?.locale).toBe('vi-VN');
      expect(body.data?.categories).toBeDefined();
      expect(Array.isArray(body.data.categories)).toBe(true);
      expect(body.data.totalItems).toBe(3);
    });

    it('responds to GET /api/menu/:id with single item', async () => {
      const { app } = await import('../worker/src/index');
      const env = { AURA_DB: mockDb, AUTH_KV: { get: vi.fn(), put: vi.fn() } } as any;

      const req = new Request('https://api.auraspace.vn/api/menu/prod_cafe_den');
      const res = await app.fetch(req, env, mockCtx);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data?.id).toBe('prod_cafe_den');
      expect(body.data?.name).toBe('Cà phê đen đá');
    });

    it('returns 404 on GET /api/menu/:id for non-existent item', async () => {
      const { app } = await import('../worker/src/index');
      const env = { AURA_DB: mockDb, AUTH_KV: { get: vi.fn(), put: vi.fn() } } as any;

      const req = new Request('https://api.auraspace.vn/api/menu/prod_unknown');
      const res = await app.fetch(req, env, mockCtx);

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/not found/i);
    });
  });
});
