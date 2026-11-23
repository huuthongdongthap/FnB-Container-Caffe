import { describe, it, expect, vi } from 'vitest';
import { getCustomerMenu } from '../get-customer-menu';
import type { D1Database } from '@cloudflare/workers-types';

describe('getCustomerMenu category_name join (#131)', () => {
  it('joins categories.name for products and filters by either category_id or category_name', async () => {
    const capturedSql: string[] = [];
    const db = {
      prepare: vi.fn((sql: string) => {
        capturedSql.push(sql);
        return {
          bind: vi.fn(() => ({
            all: vi.fn(async () => {
              if (sql.includes('FROM menu_items')) {
                return { results: [] };
              }
              if (sql.includes('LEFT JOIN categories')) {
                return {
                  results: [
                    {
                      id: 'prod-1',
                      name: 'Cà phê sữa đá',
                      description: 'Đậm đà',
                      price: 35000,
                      category_id: 'cat_coffee',
                      category_name: 'Cà phê',
                      category: 'coffee',
                      image_url: null,
                      tags: '[]',
                      available: 1,
                    },
                  ],
                };
              }
              return { results: [] };
            }),
          })),
          all: vi.fn(async () => ({ results: [] })),
        };
      }),
    } as unknown as D1Database;

    const menu = await getCustomerMenu(db, { category: 'cat_coffee' });

    expect(menu.totalItems).toBe(1);
    expect(menu.categories[0]?.name).toBe('coffee');
    expect(menu.categories[0]?.items[0]?.category).toBe('coffee');
    expect(menu.categories[0]?.items[0]?.categoryName).toBe('Cà phê');
    expect(menu.categories[0]?.items[0]?.categoryId).toBe('cat_coffee');
    expect(
      capturedSql.some(
        (s) =>
          s.includes('LEFT JOIN categories') &&
          s.includes("COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')") &&
          s.includes('(p.category_id = ? OR c.slug = ? OR c.name = ?)'),
      ),
    ).toBe(true);
  });
});
