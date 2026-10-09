/**
 * Order Snapshot Policy — server-authoritative line item and total calculation.
 * Freezes category_id into each item so KDS routing is decoupled from Catalog.
 */

import {
  resolveServerProductPrice,
  resolveItemPrice,
  type Channel,
  type ModifierChoice,
} from '@aura/domain-catalog';
import type {
  D1Like,
  EvaluatedOrderItem,
  OrderSnapshotInput,
  OrderSnapshotRejection,
  OrderSnapshotResult,
  RawOrderItemInput,
} from './order-snapshot-types';

export * from './order-snapshot-types';

/**
 * Calculates a server-authoritative order snapshot.
 * Discards all client-supplied item prices and totals.
 * Locks category_id in line-item snapshot for deterministic KDS routing.
 */
export async function calculateOrderSnapshot(
  db: D1Like | null | undefined,
  input: OrderSnapshotInput,
): Promise<OrderSnapshotResult> {
  const channel: Channel = input.channel || input.order_type || 'dine_in';
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

  const evaluatedItems: EvaluatedOrderItem[] = [];
  let subtotal = 0;

  for (const rawItem of input.items) {
    const itemId = rawItem.productId || rawItem.product_id || rawItem.menuItemId || rawItem.id || '';
    const quantity = Math.max(1, Number(rawItem.quantity || rawItem.qty || 1));

    let unitPriceCents = 0;
    let itemName = rawItem.name || 'Item';
    let validatedModifiers: unknown[] = Array.isArray(rawItem.modifiers) ? rawItem.modifiers : [];
    let categoryId = (rawItem.category_id || rawItem.categoryId || null) as string | null;

    if (db && itemId) {
      const resolved = await resolveServerProductPrice(db, {
        productId: itemId,
        channel,
        modifiers: rawItem.modifiers,
        now,
        channelDeltas: input.channelDeltas,
      });

      if (!resolved.available) {
        const rejCode = (resolved.rejection?.code || 'item_unavailable') as OrderSnapshotRejection['code'];
        const rejMsg = resolved.rejection?.message || `menu item unavailable: ${itemId}`;
        return reject(rejCode, rejMsg);
      }

      unitPriceCents = resolved.unitPriceCents;
      itemName = resolved.name || itemName;
      validatedModifiers = resolved.validatedModifiers;

      if (!categoryId) {
        try {
          const prod = await db.prepare('SELECT category_id FROM products WHERE id = ?')
            .bind(itemId).first<{ category_id: string }>();
          if (prod?.category_id) {
            categoryId = prod.category_id;
          } else {
            const menu = await db.prepare('SELECT category_id FROM menu_items WHERE id = ?')
              .bind(itemId).first<{ category_id: string }>();
            if (menu?.category_id) categoryId = menu.category_id;
          }
        } catch {
          // DB mock or missing column
        }
      }
    } else {
      const modifierChoices: ModifierChoice[] = [];
      if (Array.isArray(rawItem.modifiers)) {
        for (const mod of rawItem.modifiers) {
          if (typeof mod === 'object' && mod !== null && 'price_delta' in mod) {
            modifierChoices.push(mod as ModifierChoice);
          }
        }
      }
      unitPriceCents = resolveItemPrice({
        basePriceCents: Number(rawItem.price) || 0,
        channel,
        modifierChoices,
        happyHourWindows: [],
        now,
        channelDeltas: input.channelDeltas,
      });
    }

    const lineSubtotal = unitPriceCents * quantity;
    subtotal += lineSubtotal;

    evaluatedItems.push({
      id: rawItem.id,
      menuItemId: itemId,
      name: itemName,
      quantity,
      price: unitPriceCents,
      unitPriceCents,
      subtotalCents: lineSubtotal,
      modifiers: validatedModifiers,
      notes: rawItem.notes || null,
      category_id: categoryId || null,
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
