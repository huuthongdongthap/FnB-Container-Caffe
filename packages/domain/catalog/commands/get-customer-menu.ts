/**
 * get-customer-menu — public customer-facing menu view for M4 AURA Online.
 *
 * Returns active menu items with category aggregation. Strips internal
 * fields (cost, supplier, sku) that the staff catalog exposes. Respects
 * availability policy — unavailable items can be included with an
 * `available: false` flag (default: available-only).
 *
 * Pure D1 reads, non-blocking. Returns empty categories list on failure
 * so the customer-facing menu degrades gracefully.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { toAvailabilityFlag } from '../policies/availability';

const log = createLogger({ route: 'customer.menu' });

export interface CustomerMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string;
  imageUrl: string | null;
  tags: string[];
  available: boolean;
}

export interface CustomerMenuCategory {
  name: string;
  items: CustomerMenuItem[];
}

export interface CustomerMenu {
  categories: CustomerMenuCategory[];
  totalItems: number;
}

export interface CustomerMenuOptions {
  includeUnavailable?: boolean;
  category?: string;
}

export async function getCustomerMenu(
  db: D1Database,
  opts: CustomerMenuOptions = {},
): Promise<CustomerMenu> {
  const includeUnavailable = opts.includeUnavailable ?? false;

  try {
    let query = `SELECT id, name, description, price, category, image_url, tags, available
      FROM menu_items WHERE 1 = 1`;
    const params: unknown[] = [];

    if (!includeUnavailable) {
      query += ' AND available = 1';
    }

    if (opts.category) {
      query += ' AND category = ?';
      params.push(opts.category);
    }

    query += ' ORDER BY category, name';

    const { results } = await db
      .prepare(query)
      .bind(...params)
      .all<{
        id: string;
        name: string;
        description: string | null;
        price: number | string;
        category: string;
        image_url: string | null;
        tags: string | null;
        available: number | boolean;
      }>();

    const items: CustomerMenuItem[] = results.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceCents: typeof item.price === 'string' ? parseInt(item.price, 10) : item.price,
      category: item.category,
      imageUrl: item.image_url,
      tags: item.tags ? JSON.parse(item.tags) : [],
      available: toAvailabilityFlag(item.available),
    }));

    const categoryMap = new Map<string, CustomerMenuItem[]>();
    for (const item of items) {
      const list = categoryMap.get(item.category) || [];
      list.push(item);
      categoryMap.set(item.category, list);
    }

    const categories: CustomerMenuCategory[] = Array.from(categoryMap.entries()).map(
      ([name, catItems]) => ({ name, items: catItems }),
    );

    return { categories, totalItems: items.length };
  } catch (err) {
    log.error('customer_menu_read_failed', { error: String(err) });
    return { categories: [], totalItems: 0 };
  }
}
