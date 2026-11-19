/**
 * CRM — Place order (customer self-service / online).
 * Pure function: Hono-free, D1-only. Returns result struct for thin route.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { generateOrderToken, hashOrderToken } from '../../customer/policies/order-ownership-policy';

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
  tenantId?: string;
  kv?: import('@cloudflare/workers-types').KVNamespace;
  /** Client retry key; the same key + payload returns the first order instead of creating another. */
  idempotencyKey?: string;
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
  orderToken?: string;
  replayed?: boolean;
}

export interface PlaceOrderError {
  ok: false;
  status?: number;
  code: 'empty_items' | 'invalid_item' | 'invalid_items' | 'invalid_quantity' | 'invalid_channel' | 'd1_error' | 'idempotency_conflict';
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

const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchMenuPriceCents(
  db: D1Database,
  menuItemId: string,
  targetTenant: string,
): Promise<{ ok: true; id: string; name: string; unitPriceCents: number; itemTenant?: string } | PlaceOrderError> {
  let row: { id: string; name: string; price: number; available: number | boolean; tenant_id?: string | null } | null;
  try {
    row = await db
      .prepare('SELECT id, name, price, available, tenant_id FROM menu_items WHERE id = ?')
      .bind(menuItemId)
      .first<{ id: string; name: string; price: number; available: number | boolean; tenant_id?: string | null }>()
      .catch(() =>
        targetTenant === 'default'
          ? db
              .prepare('SELECT id, name, price, available FROM menu_items WHERE id = ?')
              .bind(menuItemId)
              .first<{ id: string; name: string; price: number; available: number | boolean }>()
              .catch(() => null)
          : null
      );
    if (!row) {
      row = await db
        .prepare('SELECT id, name, price, is_available as available, tenant_id FROM products WHERE id = ?')
        .bind(menuItemId)
        .first<{ id: string; name: string; price: number; available: number | boolean; tenant_id?: string | null }>()
        .catch(() =>
          targetTenant === 'default'
            ? db
                .prepare('SELECT id, name, price, is_available as available FROM products WHERE id = ?')
                .bind(menuItemId)
                .first<{ id: string; name: string; price: number; available: number | boolean }>()
                .catch(() => null)
            : null
        );
    }
  } catch (e) {
    return { ok: false, code: 'd1_error', error: `failed to read menu item: ${(e as Error).message}` };
  }

  if (!row) {
    return { ok: false, code: 'invalid_item', error: `menu item not found: ${menuItemId}` };
  }
  const rowTenant =
    'tenant_id' in row && row.tenant_id !== undefined
      ? ((row.tenant_id && String(row.tenant_id).trim()) || 'default')
      : undefined;
  if (targetTenant !== '*' && rowTenant !== undefined) {
    if (rowTenant !== targetTenant) {
      return { ok: false, code: 'invalid_item', error: `menu item not found: ${menuItemId}` };
    }
  }
  if (row.available === 0 || row.available === false) {
    return { ok: false, code: 'invalid_item', error: `menu item unavailable: ${menuItemId}` };
  }

  return {
    ok: true,
    id: row.id,
    name: row.name,
    unitPriceCents: Number(row.price) || 0,
    itemTenant: rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq' ? rowTenant : undefined,
  };
}

/**
 * Place an online order. Each item's price is read from menu_items
 * so the customer can never inject a price. Internal fields (cost,
 * sku, supplier) are never echoed back.
 */
export async function placeOrder(
  db: D1Database,
  input: PlaceOrderInput,
  kv?: import('@cloudflare/workers-types').KVNamespace,
): Promise<PlaceOrderResult> {
  if (!VALID_CHANNELS.includes(input.channel)) {
    return { ok: false, code: 'invalid_channel', error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` };
  }
  if (!input.items || input.items.length === 0) {
    return { ok: false, code: 'empty_items', error: 'order must contain at least one item' };
  }
  if (input.items.length > 50) {
    return { ok: false, status: 400, code: 'invalid_items', error: 'Invalid item count or quantity' };
  }

  const rawTargetTenant = (input.tenantId && input.tenantId.trim()) ? input.tenantId.trim() : 'default';
  const targetTenant =
    rawTargetTenant === '*' || rawTargetTenant.toLowerCase() === 'hq' ? '*' : rawTargetTenant;

  const idemKey = (input.idempotencyKey ?? '').trim();
  if (idemKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return { ok: false, status: 400, code: 'invalid_items', error: 'Idempotency-Key is too long' };
  }
  let idem: { scopeKey: string; fingerprint: string } | null = null;
  if (idemKey) {
    const fingerprint = await sha256Hex(JSON.stringify({
      channel: input.channel,
      notes: input.notes ?? null,
      items: input.items.map((i) => [i.menuItemId, Number(i.quantity), i.note ?? null]),
    }));
    idem = { scopeKey: `place:${targetTenant}:${input.customerId}:${idemKey}`, fingerprint };
  }
  const findSaved = async (): Promise<PlaceOrderResult | null> => {
    if (!idem) return null;
    const saved = await db
      .prepare('SELECT fingerprint, response_body FROM order_creation_requests WHERE scope_key = ?')
      .bind(idem.scopeKey)
      .first<{ fingerprint: string; response_body: string }>()
      .catch(() => null);
    if (!saved) return null;
    if (saved.fingerprint !== idem.fingerprint) {
      return { ok: false, status: 409, code: 'idempotency_conflict', error: 'Idempotency-Key reused with different order data' };
    }
    try {
      return { ...(JSON.parse(saved.response_body) as PlaceOrderSuccess), replayed: true };
    } catch {
      return null;
    }
  };
  const replay = await findSaved();
  if (replay) return replay;
  let inferredStoreTenant: string | undefined;
  const items: OrderItemResult[] = [];
  let totalCents = 0;

  for (const line of input.items) {
    if (!line.menuItemId) {
      return { ok: false, code: 'invalid_item', error: 'each item must have a menuItemId' };
    }
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty > 100) {
      return { ok: false, status: 400, code: 'invalid_items', error: 'Invalid item count or quantity' };
    }
    if (qty < 1) {
      return { ok: false, status: 400, code: 'invalid_quantity', error: `invalid quantity for item ${line.menuItemId}` };
    }

    const fetched = await fetchMenuPriceCents(db, line.menuItemId, targetTenant);
    if (!fetched.ok) {
      return fetched;
    }
    if (!inferredStoreTenant && fetched.itemTenant) {
      inferredStoreTenant = fetched.itemTenant;
    }

    const unitPriceCents = fetched.unitPriceCents;
    const subtotalCents = unitPriceCents * qty;
    totalCents += subtotalCents;

    items.push({
      menuItemId: fetched.id,
      name: fetched.name,
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

  const effectiveTenant = (targetTenant !== '*' ? targetTenant : inferredStoreTenant) || 'default';
  const isGuestOrder = !input.customerId || input.customerId.trim() === '' || input.customerId.trim().toLowerCase() === 'guest';
  const guestOrderToken = isGuestOrder ? generateOrderToken() : undefined;
  const guestTokenHash = guestOrderToken ? await hashOrderToken(guestOrderToken) : null;
  const successResult: PlaceOrderSuccess = {
    ok: true,
    orderId,
    status: 'pending',
    channel: input.channel,
    items,
    totalCents,
    ...(guestOrderToken ? { orderToken: guestOrderToken } : {}),
  };
  // The request record commits in the same D1 batch as the order, so a retry sees both or neither.
  const exec = (stmt: ReturnType<D1Database['prepare']>) =>
    idem
      ? db.batch([
          stmt,
          db.prepare(
            'INSERT INTO order_creation_requests (scope_key, fingerprint, order_id, response_body, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(idem.scopeKey, idem.fingerprint, orderId, JSON.stringify(successResult), now),
        ])
      : stmt.run();
  // A concurrent same-key request that committed first wins; its result is returned verbatim.
  const failed = async (err: unknown): Promise<PlaceOrderResult> =>
    (await findSaved()) ?? { ok: false, code: 'd1_error', error: `failed to create order: ${(err as Error).message}` };
  let insertedWithGuestHash = false;
  if (guestTokenHash) {
    try {
      await exec(db.prepare(`
        INSERT INTO orders (
          id, items, total, status, customer_name, customer_phone,
          order_type, notes, customer_id, guest_token_hash, tenant_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        itemsJson,
        totalCents,
        'pending',
        input.customerName ?? null,
        input.customerPhone,
        input.channel,
        input.notes ?? null,
        input.customerId || null,
        guestTokenHash,
        effectiveTenant,
        now,
      ));
      insertedWithGuestHash = true;
    } catch {
      insertedWithGuestHash = false;
    }
  }
  if (!insertedWithGuestHash) try {
    await exec(db.prepare(`
      INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        order_type, notes, customer_id, tenant_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      effectiveTenant,
      now,
    ));
  } catch (firstErr) {
    try {
      const orderNumber = `ORD-${orderId.replace(/^ord_/i, '').toUpperCase()}`;
      await exec(db.prepare(`
        INSERT INTO orders (
          id, order_number, items, total, status, customer_name, customer_phone,
          order_type, notes, customer_id, tenant_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        orderNumber,
        itemsJson,
        totalCents,
        'pending',
        input.customerName ?? null,
        input.customerPhone,
        input.channel,
        input.notes ?? null,
        input.customerId,
        effectiveTenant,
        now,
        now,
      ));
    } catch (scopedErr) {
      if (effectiveTenant !== 'default') {
        const err = scopedErr ?? firstErr;
        return failed(err);
      }
      try {
        await exec(db.prepare(`
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
        ));
      } catch {
        try {
          const orderNumber = `ORD-${orderId.replace(/^ord_/i, '').toUpperCase()}`;
          await exec(db.prepare(`
            INSERT INTO orders (
              id, order_number, items, total, status, customer_name, customer_phone,
              order_type, notes, customer_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            orderId,
            orderNumber,
            itemsJson,
            totalCents,
            'pending',
            input.customerName ?? null,
            input.customerPhone,
            input.channel,
            input.notes ?? null,
            input.customerId,
            now,
            now,
          ));
        } catch (e) {
          return failed(e);
        }
      }
    }
  }

  // Loyalty accrual and first-order referral rewards are deferred until payment
  // settles (payment_status = 'paid') or the order completes, preventing unpaid
  // pending orders from minting spendable cashback or referral payouts.
  void kv;

  return successResult;
}
