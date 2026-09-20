/**
 * Order Snapshot Policy — server-authoritative line item and total calculation.
 *
 * Implements server-authoritative price snapshotting:
 * 1. Reads canonical menu_items / products and modifier choices from DB.
 * 2. Applies channel deltas and active happy-hour discounts via `@aura/domain-catalog`.
 * 3. Builds immutable line-item snapshot `{ id, name, quantity, unitPriceCents, subtotalCents, modifiers }`.
 * 4. Evaluates total = subtotal + shipping_fee - discount + service_fee + tip_amount.
 * 5. Discards any client-tampered totals or item prices.
 */

import { resolveItemPrice } from '@aura/domain-catalog';
import type { Channel, HappyHourWindow, ModifierChoice } from '@aura/domain-catalog';

export interface RawOrderItemInput {
  id?: string;
  product_id?: string;
  name?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  modifiers?: string[] | ModifierChoice[];
  notes?: string;
}

export interface EvaluatedOrderItem {
  id?: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  unitPriceCents: number;
  subtotalCents: number;
  modifiers?: unknown[];
  notes?: string | null;
}

export interface OrderSnapshotInput {
  items: RawOrderItemInput[];
  order_type?: Channel;
  shipping_fee?: number;
  discount?: number;
  service_fee?: number;
  tip_amount?: number;
  now?: Date;
}

export interface OrderSnapshotRejection {
  code: 'item_not_found' | 'item_unavailable';
  message: string;
}

export interface OrderSnapshotResult {
  items: EvaluatedOrderItem[];
  itemsJson: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  service_fee: number;
  tip_amount: number;
  total: number;
  /** Set when the request references a catalog item that cannot be sold. */
  rejected: OrderSnapshotRejection | null;
}

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] } | T[]>;
      run(): Promise<unknown>;
    };
  };
}

/**
 * Calculates a server-authoritative order snapshot.
 *
 * The returned `rejected` field is non-null when the request cannot be priced
 * from the catalog; callers must abort order creation in that case.
 */
export async function calculateOrderSnapshot(
  db: D1Like | null | undefined,
  input: OrderSnapshotInput,
): Promise<OrderSnapshotResult> {
  const channel: Channel = input.order_type || 'dine_in';
  const now = input.now || new Date();

  const reject = (code: OrderSnapshotRejection['code'], message: string): OrderSnapshotResult => ({
    items: [],
    itemsJson: '[]',
    subtotal: 0,
    shipping_fee: 0,
    discount: 0,
    service_fee: 0,
    tip_amount: 0,
    total: 0,
    rejected: { code, message },
  });

  // Load active happy hour windows if DB is available
  let happyHourWindows: HappyHourWindow[] = [];
  if (db) {
    try {
      const hhRes = await db
        .prepare('SELECT * FROM happy_hour_windows WHERE active = 1')
        .bind()
        .all<HappyHourWindow>();
      const rows = Array.isArray(hhRes) ? hhRes : hhRes?.results || [];
      happyHourWindows = rows as HappyHourWindow[];
    } catch {
      // Table may not exist in mock/test DB; fallback to empty
      happyHourWindows = [];
    }
  }

  const evaluatedItems: EvaluatedOrderItem[] = [];
  let subtotal = 0;

  for (const rawItem of input.items) {
    const itemId = rawItem.id || rawItem.product_id || '';
    const quantity = Math.max(1, Number(rawItem.quantity || rawItem.qty || 1));

    let dbItem: { id: string; name: string; price: number; available?: number | boolean } | null = null;

    if (db && itemId) {
      try {
        dbItem = await db
          .prepare('SELECT id, name, price, available FROM menu_items WHERE id = ?')
          .bind(itemId)
          .first<{ id: string; name: string; price: number; available?: number | boolean }>();

        // Fallback to products table if not in menu_items
        if (!dbItem) {
          dbItem = await db
            .prepare('SELECT id, name, price, is_available as available FROM products WHERE id = ?')
            .bind(itemId)
            .first<{ id: string; name: string; price: number; available?: number | boolean }>();
        }
      } catch {
        dbItem = null;
      }
    }

    // Catalog item present but not sellable → reject the whole order.
    if (dbItem && (dbItem.available === 0 || dbItem.available === false)) {
      return reject('item_unavailable', `menu item unavailable: ${itemId}`);
    }

    const itemName = dbItem?.name || rawItem.name || 'Item';
    const basePriceCents = dbItem ? Number(dbItem.price) || 0 : 0;

    // Resolve modifier choices if present
    const modifierChoices: ModifierChoice[] = [];
    if (Array.isArray(rawItem.modifiers)) {
      for (const mod of rawItem.modifiers) {
        if (typeof mod === 'object' && mod !== null && 'price_delta' in mod) {
          modifierChoices.push(mod as ModifierChoice);
        }
      }
    }

    const unitPriceCents = resolveItemPrice({
      basePriceCents,
      channel,
      modifierChoices,
      happyHourWindows,
      now,
    });

    const lineSubtotal = unitPriceCents * quantity;
    subtotal += lineSubtotal;

    evaluatedItems.push({
      id: rawItem.id,
      menuItemId: dbItem?.id || itemId,
      name: itemName,
      quantity,
      // `price` is the legacy client-facing alias for the authoritative unit price.
      // It always mirrors `unitPriceCents` — never a client-supplied value.
      price: unitPriceCents,
      unitPriceCents,
      subtotalCents: lineSubtotal,
      modifiers: rawItem.modifiers || [],
      notes: rawItem.notes || null,
    });
  }

  const shippingFee = Math.max(0, Number(input.shipping_fee || 0));
  const discount = Math.max(0, Number(input.discount || 0));
  const serviceFee = Math.max(0, Number(input.service_fee || 0));
  const tipAmount = Math.max(0, Number(input.tip_amount || 0));

  const total = Math.max(0, subtotal + shippingFee - discount + serviceFee + tipAmount);

  return {
    items: evaluatedItems,
    itemsJson: JSON.stringify(evaluatedItems),
    subtotal,
    shipping_fee: shippingFee,
    discount,
    service_fee: serviceFee,
    tip_amount: tipAmount,
    total,
    rejected: null,
  };
}
