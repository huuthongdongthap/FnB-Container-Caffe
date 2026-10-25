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

export interface CustomerMenuItemModifier {
  id: string;
  group_id: string;
  option_name: string;
  price_delta: number;
}

export interface CustomerMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string;
  imageUrl: string | null;
  tags: string[];
  available: boolean;
  modifierChoices: CustomerMenuItemModifier[];
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

/**
 * Fill `modifierChoices` for a set of items from the menu_modifiers projection.
 *
 * Single batched query bucketed by product — a per-item query would turn a
 * 49-item menu into 49 round trips. Only available options are returned, so a
 * retired choice disappears from the customer view without a second read.
 */
async function attachProductModifiers(
  db: D1Database,
  items: CustomerMenuItem[],
): Promise<void> {
  const productIds = items.map((item) => item.id);
  if (productIds.length === 0) return;

  const placeholders = productIds.map(() => '?').join(',');
  try {
    const modRes = await db.prepare(
      `SELECT pm.product_id, mm.id, mm.group_id, mm.option_name, mm.price_delta
         FROM product_modifier_groups pm
         JOIN menu_modifiers mm ON mm.group_id = pm.group_id
        WHERE pm.product_id IN (${placeholders}) AND mm.available = 1
        ORDER BY mm.option_name`
    ).bind(...productIds).all<{ product_id: string } & CustomerMenuItemModifier>();

    const byProduct = new Map<string, CustomerMenuItemModifier[]>();
    for (const row of (modRes.results ?? modRes ?? []) as Array<{ product_id: string } & CustomerMenuItemModifier>) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push({
        id: row.id,
        group_id: row.group_id,
        option_name: row.option_name,
        price_delta: row.price_delta,
      });
      byProduct.set(row.product_id, list);
    }
    for (const item of items) {
      item.modifierChoices = byProduct.get(item.id) ?? [];
    }
  } catch {
    // Pre-migration database: no menu_modifiers table, so no modifiers to show.
    for (const item of items) item.modifierChoices = [];
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
        modifierChoices: [],
      };
    });

    await attachProductModifiers(db, items);

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

    const item: CustomerMenuItem = {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      priceCents,
      category: raw.category,
      imageUrl: raw.image_url,
      tags: parseTags(raw.tags),
      available: toAvailabilityFlag(raw.available),
      modifierChoices: [],
    };
    await attachProductModifiers(db, [item]);
    return item;
  } catch (err) {
    log.error('customer_menu_item_read_failed', { id, error: String(err) });
    return null;
  }
}
