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
  rejection?: ModifierValidationRejection | { code: 'item_unavailable' | 'item_not_found'; message: string };
}

export async function resolveServerProductPrice(
  db: D1Like | null | undefined,
  input: ResolveServerPriceInput,
): Promise<ResolvedServerPrice> {
  const { productId, channel = 'dine_in', modifiers = [], now = new Date(), channelDeltas, fallbackPrice, fallbackName } = input;
  const normChannel = normalizeChannel(channel);

  let dbItem: { id: string; name: string; price: number; available: number | boolean } | null = null;
  if (db && productId) {
    try {
      dbItem = await db
        .prepare('SELECT id, name, price, is_available as available FROM products WHERE id = ?')
        .bind(productId)
        .first<{ id: string; name: string; price: number; available: number | boolean }>();
      if (!dbItem) {
        dbItem = await db
          .prepare('SELECT id, name, price, available FROM menu_items WHERE id = ?')
          .bind(productId)
          .first<{ id: string; name: string; price: number; available: number | boolean }>();
      }
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

  const basePriceCents = dbItem
    ? Math.max(0, Math.floor(Number(dbItem.price) || 0))
    : Math.max(0, Math.floor(Number(fallbackPrice) || 0));
  const itemName = dbItem?.name || fallbackName || 'Item';

  // Validate modifier choices strictly against DB modifier_choices table and product mappings
  const candidateProductIds = [productId, dbItem?.id].filter(Boolean) as string[];
  const modResult = await validateProductModifiers(db, productId, modifiers, candidateProductIds);
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

  // Load active happy hour windows
  let happyHourWindows: HappyHourWindow[] = [];
  if (db) {
    try {
      const hhRes = await db
        .prepare('SELECT * FROM happy_hour_windows WHERE active = 1')
        .bind()
        .all<HappyHourWindow>();
      happyHourWindows = (Array.isArray(hhRes) ? hhRes : hhRes?.results || []) as HappyHourWindow[];
    } catch {
      happyHourWindows = [];
    }
  }

  const unitPriceCents = resolveItemPrice({
    basePriceCents,
    channel: normChannel,
    modifierChoices: modResult.validatedModifiers,
    happyHourWindows,
    now,
    channelDeltas,
  });

  const delta = channelDeltas?.[normChannel] ?? 0;

  return {
    id: dbItem?.id || productId,
    name: itemName,
    basePriceCents,
    channelDelta: delta,
    modifierDelta: modResult.modifierDelta,
    unitPriceCents,
    available: true,
    validatedModifiers: modResult.validatedModifiers,
  };
}
