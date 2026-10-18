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
import { resolveItemPrice, type Channel, type ChannelDeltaConfig } from '../policies/pricing';
import type { HappyHourWindow } from '../model/catalog-types';

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
  locale?: string;
  channel?: Channel | string;
  now?: Date;
  channelDeltas?: ChannelDeltaConfig;
}

interface RawMenuRow {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  category: string;
  image_url: string | null;
  tags: string | string[] | null;
  available: number | boolean;
}

function parseTags(tags: string | string[] | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
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
    query += ' ORDER BY category ASC, name ASC';

    let results: RawMenuRow[] = [];
    let primaryErr: unknown = null;
    try {
      const res = await db.prepare(query).bind(...params).all<RawMenuRow>();
      results = res.results ?? [];
    } catch (err) {
      primaryErr = err;
    }

    if (results.length === 0) {
      try {
        let prodQuery = `SELECT id, name, name_en, description, description_en, price, category_id AS category, image_url, is_available AS available, is_featured AS featured, tags, sort_order FROM products WHERE 1 = 1`;
        const prodParams: unknown[] = [];
        if (!includeUnavailable) {
          prodQuery += ' AND is_available = 1';
        }
        if (opts.category) {
          prodQuery += ' AND category_id = ?';
          prodParams.push(opts.category);
        }
        prodQuery += ' ORDER BY category_id ASC, name ASC';
        const prodRes = await db.prepare(prodQuery).bind(...prodParams).all<RawMenuRow>();
        results = prodRes.results ?? [];
        primaryErr = null;
      } catch {
        if (primaryErr) throw primaryErr;
      }
    }

    const hasPricingOverrides = Boolean(opts.channel || opts.now || opts.channelDeltas);
    let happyHourWindows: HappyHourWindow[] = [];
    if (hasPricingOverrides) {
      try {
        const hhRes = await db.prepare('SELECT * FROM happy_hour_windows WHERE active = 1').all<HappyHourWindow>();
        happyHourWindows = (hhRes.results || hhRes || []) as HappyHourWindow[];
      } catch {
        happyHourWindows = [];
      }
    }

    const items: CustomerMenuItem[] = (results ?? []).map((item: RawMenuRow) => {
      const basePrice = typeof item.price === 'string' ? parseInt(item.price, 10) : item.price;
      const priceCents = hasPricingOverrides
        ? resolveItemPrice({
            basePriceCents: basePrice,
            channel: opts.channel || 'dine_in',
            modifierChoices: [],
            happyHourWindows,
            now: opts.now || new Date(),
            channelDeltas: opts.channelDeltas,
            productId: item.id,
            categoryId: item.category,
          })
        : basePrice;

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents,
        category: item.category,
        imageUrl: item.image_url,
        tags: parseTags(item.tags),
        available: toAvailabilityFlag(item.available),
      };
    });

    const categoryMap = new Map<string, CustomerMenuItem[]>();
    for (const item of items) {
      const list = categoryMap.get(item.category) || [];
      list.push(item);
      categoryMap.set(item.category, list);
    }

    const categories: CustomerMenuCategory[] = Array.from(categoryMap.entries())
      .map(([name, catItems]) => ({ name, items: catItems }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    return { categories, totalItems: items.length };
  } catch (err) {
    log.error('customer_menu_read_failed', { error: String(err) });
    return { categories: [], totalItems: 0 };
  }
}

export async function getCustomerMenuItem(
  db: D1Database,
  id: string,
  opts: CustomerMenuOptions = {},
): Promise<CustomerMenuItem | null> {
  try {
    let results: RawMenuRow[] | undefined;
    let primaryErr: unknown = null;
    try {
      const res = await db
        .prepare('SELECT id, name, description, price, category, image_url, tags, available FROM menu_items WHERE id = ?')
        .bind(id)
        .all<RawMenuRow>();
      results = res.results;
    } catch (err) {
      primaryErr = err;
    }

    if (!results || results.length === 0 || !results[0]) {
      try {
        const prodRes = await db
          .prepare('SELECT id, name, description, price, category_id AS category, image_url, tags, is_available AS available FROM products WHERE id = ?')
          .bind(id)
          .all<RawMenuRow>();
        results = prodRes.results;
        primaryErr = null;
      } catch {
        if (primaryErr) throw primaryErr;
      }
    }

    if (!results || results.length === 0 || !results[0]) {
      return null;
    }
    const raw = results[0];
    const basePrice = typeof raw.price === 'string' ? parseInt(raw.price, 10) : raw.price;

    const hasPricingOverrides = Boolean(opts.channel || opts.now || opts.channelDeltas);
    let happyHourWindows: HappyHourWindow[] = [];
    if (hasPricingOverrides) {
      try {
        const hhRes = await db.prepare('SELECT * FROM happy_hour_windows WHERE active = 1').all<HappyHourWindow>();
        happyHourWindows = (hhRes.results || hhRes || []) as HappyHourWindow[];
      } catch {
        happyHourWindows = [];
      }
    }

    const priceCents = hasPricingOverrides
      ? resolveItemPrice({
          basePriceCents: basePrice,
          channel: opts.channel || 'dine_in',
          modifierChoices: [],
          happyHourWindows,
          now: opts.now || new Date(),
          channelDeltas: opts.channelDeltas,
          productId: raw.id,
          categoryId: raw.category,
        })
      : basePrice;

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      priceCents,
      category: raw.category,
      imageUrl: raw.image_url,
      tags: parseTags(raw.tags),
      available: toAvailabilityFlag(raw.available),
    };
  } catch (err) {
    log.error('customer_menu_item_read_failed', { id, error: String(err) });
    return null;
  }
}
