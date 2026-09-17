/**
 * CRM — Place order (customer self-service / online).
 * Pure function: Hono-free, D1-only. Returns result struct for thin route.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { applyAccrual } from './accrual';
import { loadPolicy } from './loyalty-policy';
import { rewardReferralOnFirstOrder } from './referral';
import { resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } from './referral-policy';

export type FulfillmentChannel = 'pickup' | 'delivery';

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface PlaceOrderInput {
  customerId: string;
  customerPhone: string;
  customerName?: string;
  channel: FulfillmentChannel;
  items: OrderItemInput[];
  notes?: string;
}

export interface OrderItemResult {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  note: string | null;
}

export interface PlaceOrderSuccess {
  ok: true;
  orderId: string;
  status: 'pending';
  channel: FulfillmentChannel;
  items: OrderItemResult[];
  totalCents: number;
}

export interface PlaceOrderError {
  ok: false;
  code: 'empty_items' | 'invalid_item' | 'invalid_quantity' | 'invalid_channel' | 'd1_error';
  error: string;
}

export type PlaceOrderResult = PlaceOrderSuccess | PlaceOrderError;

export const VALID_CHANNELS: FulfillmentChannel[] = ['pickup', 'delivery'];

/**
 * Generate a short order id — prefix + 10 hex chars.
 * Matches the repo's id convention (prefix_randomhex).
 */
interface CryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

function generateOrderId(): string {
  const bytes = new Uint8Array(5);
  (globalThis as unknown as { crypto: CryptoLike }).crypto.getRandomValues(bytes);
  return 'ord_' + Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Place an online order. Each item's price is read from menu_items
 * so the customer can never inject a price. Internal fields (cost,
 * sku, supplier) are never echoed back.
 */
export async function placeOrder(
  db: D1Database,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  if (!VALID_CHANNELS.includes(input.channel)) {
    return { ok: false, code: 'invalid_channel', error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` };
  }
  if (!input.items || input.items.length === 0) {
    return { ok: false, code: 'empty_items', error: 'order must contain at least one item' };
  }

  const items: OrderItemResult[] = [];
  let totalCents = 0;

  for (const line of input.items) {
    if (!line.menuItemId) {
      return { ok: false, code: 'invalid_item', error: 'each item must have a menuItemId' };
    }
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return { ok: false, code: 'invalid_quantity', error: `invalid quantity for item ${line.menuItemId}` };
    }

    let row: { id: string; name: string; price: number; available: number | boolean } | null;
    try {
      row = await db
        .prepare('SELECT id, name, price, available FROM menu_items WHERE id = ?')
        .bind(line.menuItemId)
        .first<{ id: string; name: string; price: number; available: number | boolean }>();
    } catch (e) {
      return { ok: false, code: 'd1_error', error: `failed to read menu item: ${(e as Error).message}` };
    }

    if (!row) {
      return { ok: false, code: 'invalid_item', error: `menu item not found: ${line.menuItemId}` };
    }
    if (row.available === 0 || row.available === false) {
      return { ok: false, code: 'invalid_item', error: `menu item unavailable: ${line.menuItemId}` };
    }

    const unitPriceCents = Number(row.price) || 0;
    const subtotalCents = unitPriceCents * qty;
    totalCents += subtotalCents;

    items.push({
      menuItemId: row.id,
      name: row.name,
      quantity: qty,
      unitPriceCents,
      subtotalCents,
      note: line.note ?? null,
    });
  }

  const orderId = generateOrderId();
  const now = new Date().toISOString();
  const itemsJson = JSON.stringify(items.map((i) => ({
    menuItemId: i.menuItemId,
    name: i.name,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    subtotalCents: i.subtotalCents,
    note: i.note,
  })));

  try {
    await db.prepare(`
      INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        order_type, notes, customer_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      itemsJson,
      totalCents,
      'pending',
      input.customerName ?? null,
      input.customerPhone,
      input.channel,
      input.notes ?? null,
      input.customerId,
      now,
    ).run();
  } catch (e) {
    return { ok: false, code: 'd1_error', error: `failed to create order: ${(e as Error).message}` };
  }

  // ── Loyalty accrual (non-blocking) — failures swallowed ──
  if (input.customerId) {
    const policy = await loadPolicy(db).catch(() => null);
    if (policy) {
      await applyAccrual(db, policy, {
        orderId,
        customerId: input.customerId,
        orderTotalVnd: totalCents,
      }).catch(() => null);
    }

    // ── Referral reward (non-blocking) — failures swallowed ──
    const refPolicy = await resolveReferralPolicy(db as any).catch(() => DEFAULT_REFERRAL_POLICY);
    await rewardReferralOnFirstOrder(db, input.customerId, orderId, totalCents, refPolicy).catch(() => null);
  }

  return {
    ok: true,
    orderId,
    status: 'pending',
    channel: input.channel,
    items,
    totalCents,
  };
}
