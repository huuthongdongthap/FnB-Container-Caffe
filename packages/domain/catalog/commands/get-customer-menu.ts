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
import { matchesTenantRow } from 'worker/src/middleware/tenant';
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
  tenantId?: string;
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
  tenant_id?: string | null;
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
  effectiveTenant = 'default',
  productTenantMap?: Map<string, string>,
): Promise<void> {
  const productIds = items.map((item) => item.id);
  if (productIds.length === 0) return;

  const resolveRowTargetTenant = (productId: string): string => {
    if (effectiveTenant === '*' && productTenantMap?.has(productId)) {
      return productTenantMap.get(productId) || 'default';
    }
    return effectiveTenant;
  };

  const placeholders = productIds.map(() => '?').join(',');
  try {
    let modRes: { results?: Array<{ product_id: string; tenant_id?: string | null } & CustomerMenuItemModifier> };
    try {
      modRes = await db.prepare(
        `SELECT pm.product_id, mm.id, mm.group_id, mm.option_name, mm.price_delta, mm.tenant_id
           FROM product_modifier_groups pm
           JOIN menu_modifiers mm ON mm.group_id = pm.group_id
          WHERE pm.product_id IN (${placeholders}) AND mm.available = 1
          ORDER BY mm.option_name`
      ).bind(...productIds).all<{ product_id: string; tenant_id?: string | null } & CustomerMenuItemModifier>();
    } catch {
      try {
        modRes = await db.prepare(
          `SELECT pm.product_id, mm.id, mm.group_id, mm.option_name, mm.price_delta
             FROM product_modifier_groups pm
             JOIN menu_modifiers mm ON mm.group_id = pm.group_id
            WHERE pm.product_id IN (${placeholders}) AND mm.available = 1
            ORDER BY mm.option_name`
        ).bind(...productIds).all<{ product_id: string; tenant_id?: string | null } & CustomerMenuItemModifier>();
      } catch {
        modRes = await db.prepare(
          `SELECT pm.product_id, mm.id, mm.group_id, mm.name AS option_name, mm.price_adjustment AS price_delta
             FROM product_modifier_groups pm
             JOIN menu_modifiers mm ON mm.group_id = pm.group_id
            WHERE pm.product_id IN (${placeholders}) AND mm.available = 1
            ORDER BY mm.name`
        ).bind(...productIds).all<{ product_id: string; tenant_id?: string | null } & CustomerMenuItemModifier>();
      }
    }

    const rawRows = (modRes.results ?? modRes ?? []) as Array<{ product_id: string; tenant_id?: string | null } & CustomerMenuItemModifier>;
    let filteredRows = rawRows.filter((row) =>
      matchesTenantRow(row as unknown as Record<string, unknown>, resolveRowTargetTenant(row.product_id))
    );
    const groupIds = Array.from(new Set(rawRows.map((r) => r.group_id).filter(Boolean)));
    if (groupIds.length > 0) {
      try {
        const groupPlaceholders = groupIds.map(() => '?').join(',');
        const groupRes = await db
          .prepare(`SELECT * FROM modifier_groups WHERE id IN (${groupPlaceholders})`)
          .bind(...groupIds)
          .all<Record<string, unknown>>();
        const groupRows = (groupRes?.results ?? groupRes ?? []) as Array<Record<string, unknown>>;
        if (groupRows.length > 0) {
          const groupById = new Map<string, Record<string, unknown>>();
          for (const g of groupRows) {
            if (g && typeof g.id === 'string') {
              groupById.set(g.id, g);
            }
          }
          filteredRows = rawRows.filter((row) => {
            const rowTargetTenant = resolveRowTargetTenant(row.product_id);
            if (!matchesTenantRow(row as unknown as Record<string, unknown>, rowTargetTenant)) {
              return false;
            }
            const g = groupById.get(row.group_id);
            if (!g) {
              return rowTargetTenant === 'default' || rowTargetTenant === '*';
            }
            const isActive = g.is_active ?? g.active;
            if (isActive === 0 || isActive === false) {
              return false;
            }
            return matchesTenantRow(g, rowTargetTenant);
          });
        }
      } catch {
        // Fallback when modifier_groups table is absent in minimal mocks
      }
    }

    const byProduct = new Map<string, CustomerMenuItemModifier[]>();
    for (const row of filteredRows) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push({
        id: row.id,
        group_id: row.group_id,
        option_name: row.option_name,
        price_delta: Math.max(0, Math.round(Number(row.price_delta) || 0)),
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
  const rawTenant = (opts.tenantId && opts.tenantId.trim()) || 'default';
  const effectiveTenant = rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;

  try {
    let query = `SELECT *, id, name, description, price, category, image_url, tags, available
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
      results = (res.results ?? []).filter((row) =>
        matchesTenantRow(row as unknown as Record<string, unknown>, effectiveTenant)
      );
    } catch (err) {
      primaryErr = err;
    }

    if (results.length === 0) {
      try {
        let prodQuery = `SELECT *, id, name, name_en, description, description_en, price, category_id AS category, image_url, is_available AS available, is_featured AS featured, tags, sort_order FROM products WHERE 1 = 1`;
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
        results = (prodRes.results ?? []).filter((row) =>
          matchesTenantRow(row as unknown as Record<string, unknown>, effectiveTenant)
        );
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
        happyHourWindows = ((hhRes.results || hhRes || []) as HappyHourWindow[]).filter((w) =>
          matchesTenantRow(w as unknown as Record<string, unknown>, effectiveTenant)
        );
      } catch {
        happyHourWindows = [];
      }
    }

    const productTenantMap = new Map<string, string>();
    const items: CustomerMenuItem[] = (results ?? [])
      .filter((item) => matchesTenantRow(item as unknown as Record<string, unknown>, effectiveTenant))
      .map((item: RawMenuRow) => {
      const rawItemTenant = typeof item.tenant_id === 'string' ? item.tenant_id.trim() : '';
      const itemConcreteTenant =
        rawItemTenant && rawItemTenant !== '*' && rawItemTenant.toLowerCase() !== 'hq'
          ? rawItemTenant
          : (effectiveTenant === '*' ? 'default' : effectiveTenant);
      productTenantMap.set(item.id, itemConcreteTenant);

      const basePrice = typeof item.price === 'string' ? parseInt(item.price, 10) : item.price;
      const itemHappyHourWindows =
        effectiveTenant === '*'
          ? happyHourWindows.filter((w) => matchesTenantRow(w as unknown as Record<string, unknown>, itemConcreteTenant))
          : happyHourWindows;
      const priceCents = hasPricingOverrides
        ? resolveItemPrice({
            basePriceCents: basePrice,
            channel: opts.channel || 'dine_in',
            modifierChoices: [],
            happyHourWindows: itemHappyHourWindows,
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

    await attachProductModifiers(db, items, effectiveTenant, productTenantMap);

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
  opts: CustomerMenuOptions | string = {},
): Promise<CustomerMenuItem | null> {
  const resolvedOpts: CustomerMenuOptions = typeof opts === 'string' ? { tenantId: opts } : opts;
  const rawTenant = (resolvedOpts.tenantId && resolvedOpts.tenantId.trim()) || 'default';
  const effectiveTenant = rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  try {
    let results: RawMenuRow[] | undefined;
    let primaryErr: unknown = null;
    try {
      const res = await db
        .prepare('SELECT *, id, name, description, price, category, image_url, tags, available FROM menu_items WHERE id = ?')
        .bind(id)
        .all<RawMenuRow>();
      results = (res.results ?? []).filter((r) =>
        matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
      );
    } catch (err) {
      primaryErr = err;
    }

    if (!results || results.length === 0 || !results[0]) {
      try {
        const prodRes = await db
          .prepare('SELECT *, id, name, description, price, category_id AS category, image_url, tags, is_available AS available FROM products WHERE id = ?')
          .bind(id)
          .all<RawMenuRow>();
        results = (prodRes.results ?? []).filter((r) =>
          matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
        );
        primaryErr = null;
      } catch {
        if (primaryErr) throw primaryErr;
      }
    }

    const matchedResults = (results ?? []).filter((r) =>
      matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
    );
    if (matchedResults.length === 0 || !matchedResults[0]) {
      return null;
    }
    const raw = matchedResults[0];
    const rawRec = raw as unknown as Record<string, unknown>;
    const isUnavailable =
      raw.available === 0 ||
      raw.available === false ||
      (raw.available === undefined && (rawRec.is_available === 0 || rawRec.is_available === false));
    if (!resolvedOpts.includeUnavailable && isUnavailable) {
      return null;
    }
    const basePrice = typeof raw.price === 'string' ? parseInt(raw.price, 10) : raw.price;

    const hasPricingOverrides = Boolean(resolvedOpts.channel || resolvedOpts.now || resolvedOpts.channelDeltas);
    let happyHourWindows: HappyHourWindow[] = [];
    if (hasPricingOverrides) {
      try {
        const hhRes = await db.prepare('SELECT * FROM happy_hour_windows WHERE active = 1').all<HappyHourWindow>();
        happyHourWindows = ((hhRes.results || hhRes || []) as HappyHourWindow[]).filter((w) =>
          matchesTenantRow(w as unknown as Record<string, unknown>, effectiveTenant)
        );
      } catch {
        happyHourWindows = [];
      }
    }

    const priceCents = hasPricingOverrides
      ? resolveItemPrice({
          basePriceCents: basePrice,
          channel: resolvedOpts.channel || 'dine_in',
          modifierChoices: [],
          happyHourWindows,
          now: resolvedOpts.now || new Date(),
          channelDeltas: resolvedOpts.channelDeltas,
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
    const rawItemTenant = typeof raw.tenant_id === 'string' ? raw.tenant_id.trim() : '';
    const itemConcreteTenant =
      rawItemTenant && rawItemTenant !== '*' && rawItemTenant.toLowerCase() !== 'hq'
        ? rawItemTenant
        : (effectiveTenant === '*' ? 'default' : effectiveTenant);
    const singleMap = new Map<string, string>([[item.id, itemConcreteTenant]]);
    await attachProductModifiers(db, [item], effectiveTenant, singleMap);
    return item;
  } catch (err) {
    log.error('customer_menu_item_read_failed', { id, error: String(err) });
    return null;
  }
}
