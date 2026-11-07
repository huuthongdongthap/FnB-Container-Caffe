/**
 * Server-Side Pricing Resolver — Single Authoritative Pricing Engine.
 * Reused identically across Menu view and Order snapshot pipelines.
 *
 * Enforces:
 * - products.price = canonical base price
 * - Pricing resolved server-side; zero trust in client-supplied price
 * - Modifier choices validated against DB modifier_choices table
 * - Integer money values throughout
 * - Deterministic fallback for unsupported channels/rules
 */

import type { HappyHourWindow, ModifierChoice } from '../model/catalog-types';
import { resolveItemPrice, normalizeChannel, type Channel, type ChannelDeltaConfig } from './pricing';
import {
  validateProductModifiers,
  type ModifierValidationRejection,
} from './modifier-validation';

export interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] } | T[]>;
      run(): Promise<unknown>;
    };
  };
}

export interface ResolveServerPriceInput {
  productId: string;
  fallbackPrice?: number;
  fallbackName?: string;
  channel?: Channel | string;
  modifiers?: unknown[];
  now?: Date;
  channelDeltas?: ChannelDeltaConfig;
  tenantId?: string;
}

export interface ResolvedServerPrice {
  id: string;
  name: string;
  basePriceCents: number;
  channelDelta: number;
  modifierDelta: number;
  unitPriceCents: number;
  available: boolean;
  validatedModifiers: ModifierChoice[];
  categoryId?: string | null;
  rejection?: ModifierValidationRejection | { code: 'item_unavailable' | 'item_not_found'; message: string };
}

export async function resolveServerProductPrice(
  db: D1Like | null | undefined,
  input: ResolveServerPriceInput,
): Promise<ResolvedServerPrice> {
  const { productId, channel = 'dine_in', modifiers = [], now = new Date(), channelDeltas, fallbackPrice, fallbackName } = input;
  const normChannel = normalizeChannel(channel);

  type DbCatalogRow = {
    id: string;
    name: string;
    price: number;
    available: number | boolean;
    category_id?: string | null;
    category?: string | null;
    tenant_id?: string | null;
  };

  let dbItem: DbCatalogRow | null = null;
  if (db && productId) {
    const attachTenantId = async (table: 'products' | 'menu_items', id: string, row: DbCatalogRow): Promise<DbCatalogRow> => {
      if (row.tenant_id === undefined) {
        const tenantRow = await db
          .prepare(`SELECT tenant_id FROM ${table} WHERE id = ?`)
          .bind(id)
          .first<{ tenant_id?: string | null }>()
          .catch(() => null);
        if (tenantRow && 'tenant_id' in tenantRow && tenantRow.tenant_id !== undefined) {
          row.tenant_id = tenantRow.tenant_id;
        }
      }
      return row;
    };

    const matchesRequestedTenant = (candidate: DbCatalogRow | null): boolean => {
      if (!candidate) return false;
      const reqRaw = input.tenantId ? input.tenantId.trim() : '';
      const isWildcard = !reqRaw || reqRaw === '*' || reqRaw.toLowerCase() === 'hq';
      if (!isWildcard && 'tenant_id' in candidate && candidate.tenant_id !== undefined) {
        const reqTenant = reqRaw || 'default';
        const itemTenant = (candidate.tenant_id && String(candidate.tenant_id).trim()) || 'default';
        return itemTenant === reqTenant;
      }
      return true;
    };

    const findById = async (id: string): Promise<DbCatalogRow | null> => {
      let probedProducts = false;
      try {
        const row = await db
          .prepare('SELECT id, name, price, is_available as available, category_id FROM products WHERE id = ?')
          .bind(id)
          .first<DbCatalogRow>();
        probedProducts = true;
        if (row) {
          const withTenant = await attachTenantId('products', id, row);
          if (matchesRequestedTenant(withTenant)) return withTenant;
        }
      } catch {
        // fallback to legacy column list
      }
      if (!probedProducts) {
        try {
          const row = await db
            .prepare('SELECT id, name, price, is_available as available FROM products WHERE id = ?')
            .bind(id)
            .first<DbCatalogRow>();
          if (row) {
            const withTenant = await attachTenantId('products', id, row);
            if (matchesRequestedTenant(withTenant)) return withTenant;
          }
        } catch {
          // fallback to menu_items
        }
      }
      let probedMenuItems = false;
      try {
        const row = await db
          .prepare('SELECT id, name, price, available, category FROM menu_items WHERE id = ?')
          .bind(id)
          .first<DbCatalogRow>();
        probedMenuItems = true;
        if (row) {
          const withTenant = await attachTenantId('menu_items', id, row);
          if (matchesRequestedTenant(withTenant)) return withTenant;
        }
      } catch {
        // fallback to legacy column list
      }
      if (!probedMenuItems) {
        try {
          const row = await db
            .prepare('SELECT id, name, price, available FROM menu_items WHERE id = ?')
            .bind(id)
            .first<DbCatalogRow>();
          if (row) {
            const withTenant = await attachTenantId('menu_items', id, row);
            if (matchesRequestedTenant(withTenant)) return withTenant;
          }
        } catch {
          // ignore
        }
      }
      return null;
    };

    try {
      dbItem = await findById(productId);
    } catch {
      dbItem = null;
    }
  }

  // Missing catalog item when DB provided -> deterministic rejection
  if (db && !dbItem) {
    return {
      id: productId,
      name: fallbackName || 'Item',
      basePriceCents: 0,
      channelDelta: 0,
      modifierDelta: 0,
      unitPriceCents: 0,
      available: false,
      validatedModifiers: [],
      rejection: { code: 'item_not_found', message: `Product not found: ${productId}` },
    };
  }

  // Unavailable catalog item -> explicit rejection
  if (dbItem && (dbItem.available === 0 || dbItem.available === false)) {
    return {
      id: dbItem.id,
      name: dbItem.name,
      basePriceCents: 0,
      channelDelta: 0,
      modifierDelta: 0,
      unitPriceCents: 0,
      available: false,
      validatedModifiers: [],
      rejection: { code: 'item_unavailable', message: `menu item unavailable: ${dbItem.id}` },
    };
  }

  const rawBasePrice = dbItem ? Number(dbItem.price) : Number(fallbackPrice);
  const basePriceCents = Number.isFinite(rawBasePrice) ? Math.max(0, Math.floor(rawBasePrice)) : 0;
  const itemName = dbItem?.name || fallbackName || 'Item';

  // Validate modifier choices strictly against DB modifier_choices table and product mappings
  const candidateProductIds = [productId, dbItem?.id].filter(Boolean) as string[];
  const normInputTenant =
    input.tenantId && input.tenantId.trim() && input.tenantId.trim() !== '*' && input.tenantId.trim().toLowerCase() !== 'hq'
      ? input.tenantId.trim()
      : undefined;
  const effectiveTenantId =
    normInputTenant
      ? normInputTenant
      : dbItem && typeof dbItem.tenant_id === 'string' && dbItem.tenant_id.trim() !== '' && dbItem.tenant_id.trim() !== '*' && dbItem.tenant_id.trim().toLowerCase() !== 'hq'
        ? dbItem.tenant_id.trim()
        : dbItem && 'tenant_id' in dbItem && dbItem.tenant_id === null
          ? 'default'
          : undefined;
  const modResult = await validateProductModifiers(db, productId, modifiers, candidateProductIds, effectiveTenantId);
  if (!modResult.valid) {
    return {
      id: dbItem?.id || productId,
      name: itemName,
      basePriceCents,
      channelDelta: 0,
      modifierDelta: 0,
      unitPriceCents: 0,
      available: false,
      validatedModifiers: [],
      rejection: modResult.rejection,
    };
  }

  // Load active happy hour windows scoped to tenant
  const effectiveTenant =
    effectiveTenantId ||
    (input.tenantId && input.tenantId.trim()
      ? (input.tenantId.trim() === '*' || input.tenantId.trim().toLowerCase() === 'hq' ? '*' : input.tenantId.trim())
      : 'default');
  let happyHourWindows: HappyHourWindow[] = [];
  if (db) {
    try {
      const hhRes = await db
        .prepare('SELECT * FROM happy_hour_windows WHERE active = 1')
        .bind()
        .all<HappyHourWindow>();
      const rawWindows = (Array.isArray(hhRes) ? hhRes : hhRes?.results || []) as HappyHourWindow[];
      happyHourWindows = effectiveTenant === '*'
        ? rawWindows
        : rawWindows.filter((w) => {
            const row = w as unknown as Record<string, unknown>;
            if ('tenant_id' in row && row.tenant_id !== undefined) {
              const rowTenant = row.tenant_id && String(row.tenant_id).trim() ? String(row.tenant_id).trim() : 'default';
              return rowTenant === effectiveTenant;
            }
            return effectiveTenant === 'default';
          });
      if (
        dbItem &&
        !dbItem.category &&
        happyHourWindows.some((w) => ['category_id', 'category', 'categories'].includes((w.apply_to || '').toLowerCase()))
      ) {
        const catRow = await db
          .prepare('SELECT category FROM products WHERE id = ?')
          .bind(dbItem.id || productId)
          .first<{ category?: string | null }>()
          .catch(() => null);
        if (catRow && typeof catRow.category === 'string' && catRow.category.trim()) {
          dbItem.category = catRow.category.trim();
        }
      }
    } catch {
      happyHourWindows = [];
    }
  }

  const categoryId = dbItem?.category_id ?? dbItem?.category ?? null;
  const categorySlug = dbItem?.category ?? null;
  const rawDelta =
    channelDeltas?.[normChannel] ??
    (normChannel === 'online' ? channelDeltas?.delivery : (normChannel === 'delivery' ? channelDeltas?.online : 0)) ??
    0;
  const parsedDelta = Number(rawDelta);
  const delta = Number.isFinite(parsedDelta) ? Math.round(parsedDelta) : 0;
  const safeChannelDeltas: ChannelDeltaConfig | undefined = channelDeltas
    ? {
        dine_in: Number.isFinite(Number(channelDeltas.dine_in)) ? Math.round(Number(channelDeltas.dine_in)) : 0,
        takeaway: Number.isFinite(Number(channelDeltas.takeaway)) ? Math.round(Number(channelDeltas.takeaway)) : 0,
        delivery: Number.isFinite(Number(channelDeltas.delivery)) ? Math.round(Number(channelDeltas.delivery)) : 0,
        online: Number.isFinite(Number(channelDeltas.online)) ? Math.round(Number(channelDeltas.online)) : 0,
      }
    : undefined;

  const rawUnitPriceCents = resolveItemPrice({
    basePriceCents,
    channel: normChannel,
    modifierChoices: modResult.validatedModifiers,
    happyHourWindows,
    now,
    channelDeltas: safeChannelDeltas,
    productId: dbItem?.id || productId,
    categoryId,
    categorySlug,
    tenantId: effectiveTenant,
  });
  const unitPriceCents = Number.isFinite(rawUnitPriceCents)
    ? Math.max(0, Math.round(rawUnitPriceCents))
    : 0;

  return {
    id: dbItem?.id || productId,
    name: itemName,
    basePriceCents,
    channelDelta: delta,
    modifierDelta: modResult.modifierDelta,
    unitPriceCents,
    available: true,
    validatedModifiers: modResult.validatedModifiers,
    categoryId,
  };
}
