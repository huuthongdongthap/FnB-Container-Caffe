/**
 * M4 Online — Public Digital Menu for customer-facing ordering surface.
 * Tests GET /menu — category aggregation, price shape, availability filter.
 *
 * Pattern: crmRouter.fetch(req, env, executionContext).
 */
import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────
// Mock D1 — menu_items table.
// ─────────────────────────────────────────────────────────────────────

interface MockRow {
  id: string;
  [key: string]: any;
}

function createMockD1(seed: MockRow[] = []) {
  const items = [...seed];
  return {
    prepare: (sql: string) => {
      const sqlLower = sql.toLowerCase();
      const hasAvailableFilter = sqlLower.includes('available = 1');
      const hasCategoryFilter = sqlLower.includes('category = ?');

      return {
        bind: (...args: any[]) => ({
          all: async <T = any>(): Promise<{ results: T[] }> => {
            let filtered = items;
            if (hasAvailableFilter) {
              filtered = filtered.filter((i) => i.available === 1 || i.available === true);
            }
            if (hasCategoryFilter) {
              const catIdx = args.findIndex((a) => typeof a === 'string' && !a.includes('%'));
              const catValue = args[catIdx];
              filtered = filtered.filter((i) => i.category === catValue);
            }
            return { results: filtered as T[] };
          },
          first: async <T = any>(): Promise<T | null> => {
            return (items[0] ?? null) as T | null;
          },
        }),
      };
    },
  } as any;
}

function createMockEnv(seed: MockRow[] = []) {
  return {
    AURA_DB: createMockD1(seed),
    JWT_SECRET: 'test_secret_at_least_16_chars',
    AUTH_KV: { get: async () => null },
  } as any;
}

const SAMPLE_MENU = [
  {
    id: 'mi_1',
    name: 'Espresso',
    description: 'Strong and dark',
    price: 45000,
    category: 'coffee',
    image_url: 'https://cdn.example.com/espresso.jpg',
    tags: '["hot","caffeinated"]',
    available: 1,
  },
  {
    id: 'mi_2',
    name: 'Latte',
    description: 'Milky coffee',
    price: 55000,
    category: 'coffee',
    image_url: null,
    tags: null,
    available: 1,
  },
  {
    id: 'mi_3',
    name: 'Croissant',
    description: null,
    price: 35000,
    category: 'pastry',
    image_url: null,
    tags: '[]',
    available: 1,
  },
  {
    id: 'mi_4',
    name: 'Unavailable Item',
    description: null,
    price: 10000,
    category: 'coffee',
    image_url: null,
    tags: null,
    available: 0,
  },
];

describe('M4 — Public Digital Menu', () => {
  it('returns menu grouped by category with internal fields stripped', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(SAMPLE_MENU);

    const req = new Request('http://localhost/menu');
    const res = await crmRouter.fetch(req, env, {} as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.categories).toHaveLength(2); // coffee (1 item, unavailable filtered) + pastry
    expect(body.data.totalItems).toBe(3);

    const coffee = body.data.categories.find((c: any) => c.name === 'coffee');
    expect(coffee.items).toHaveLength(2); // espresso + latte (unavailable filtered)
  });

  it('excludes unavailable items by default', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(SAMPLE_MENU);

    const req = new Request('http://localhost/menu');
    const res = await crmRouter.fetch(req, env, {} as any);

    const body = await res.json();
    const allItems = body.data.categories.flatMap((c: any) => c.items);
    const unavailable = allItems.find((i: any) => i.id === 'mi_4');
    expect(unavailable).toBeUndefined();
  });

  it('includes unavailable items when include_unavailable=true', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(SAMPLE_MENU);

    const req = new Request('http://localhost/menu?include_unavailable=true');
    const res = await crmRouter.fetch(req, env, {} as any);

    const body = await res.json();
    expect(body.data.totalItems).toBe(4);
  });

  it('filters by category', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(SAMPLE_MENU);

    const req = new Request('http://localhost/menu?category=pastry');
    const res = await crmRouter.fetch(req, env, {} as any);

    const body = await res.json();
    expect(body.data.categories).toHaveLength(1);
    expect(body.data.categories[0].name).toBe('pastry');
    expect(body.data.totalItems).toBe(1);
  });

  it('strips cost/sku/supplier fields from response', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv([
      {
        id: 'mi_x',
        name: 'Test Item',
        description: null,
        price: 99000,
        category: 'test',
        image_url: null,
        tags: null,
        available: 1,
        cost: 50000,       // internal
        sku: 'SKU-123',    // internal
        supplier: 'ACME',  // internal
      },
    ]);

    const req = new Request('http://localhost/menu?include_unavailable=true');
    const res = await crmRouter.fetch(req, env, {} as any);

    const body = await res.json();
    const item = body.data.categories[0].items[0];
    expect(item.cost).toBeUndefined();
    expect(item.sku).toBeUndefined();
    expect(item.supplier).toBeUndefined();
    expect(item.priceCents).toBe(99000);
  });

  it('returns empty menu on D1 failure', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = {
      AURA_DB: {
        prepare: () => { throw new Error('D1 unavailable'); },
      },
      JWT_SECRET: 'test_secret_at_least_16_chars',
    } as any;

    const req = new Request('http://localhost/menu');
    const res = await crmRouter.fetch(req, env, {} as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.categories).toHaveLength(0);
    expect(body.data.totalItems).toBe(0);
  });

  it('public endpoint — no auth required', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const env = createMockEnv(SAMPLE_MENU);

    const req = new Request('http://localhost/menu'); // no Authorization header
    const res = await crmRouter.fetch(req, env, {} as any);

    expect(res.status).toBe(200);
  });
});
