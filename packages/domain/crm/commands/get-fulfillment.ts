/**
 * CRM — Fulfillment view (Pickup / Delivery).
 * Pure function: reads order + computes ETA from prep baseline + queue depth.
 * Hono-free, D1-only. Pickup point resolved from KV config (fallback static).
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { KVNamespace } from '@cloudflare/workers-types';
import type { FulfillmentChannel } from './place-order';

export interface FulfillmentResult {
  orderId: string;
  status: string;
  channel: FulfillmentChannel;
  /** ISO timestamp — estimated ready time, or null when terminal. */
  etaAt: string | null;
  /** Minutes from now until estimated ready (0 when terminal). */
  etaMinutes: number;
  pickupPoint: PickupPoint | null;
  /** Current queue depth — orders ahead in pending state. */
  queueDepth: number;
}

export interface FulfillmentError {
  ok: false;
  code: 'not_found' | 'forbidden' | 'd1_error';
  error: string;
}

export interface GetFulfillmentSuccess {
  ok: true;
  fulfillment: FulfillmentResult;
}

export type GetFulfillmentResult = GetFulfillmentSuccess | FulfillmentError;

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  /** Display hint — which entrance / counter to go to. */
  hint: string | null;
}

export const DEFAULT_PICKUP_POINT: PickupPoint = {
  id: 'main_counter',
  name: 'AURA Café — Main Counter',
  address: '123 Nguyễn Huệ, Q.1, TP.HCM',
  hint: 'Order tại quầy, xuất trình mã đơn',
};

/** Baseline prep minutes — could live in KV policy later. */
const BASELINE_PREP_MINUTES = 8;
/** Each pending order ahead adds this many minutes. */
const MINUTES_PER_PENDING = 3;

interface OrderRow {
  id: string;
  status: string;
  channel: string;
  customer_id: string | null;
  created_at: string;
}

const TERMINAL_STATUSES = new Set(['served', 'picked_up', 'cancelled', 'rejected']);

/**
 * Compute the fulfillment view for one order.
 * Auth is enforced by the route — this function is pure data.
 */
export async function getFulfillment(
  db: D1Database,
  orderId: string,
  viewerCustomerId?: string,
  kv?: KVNamespace,
): Promise<GetFulfillmentResult> {
  let row: OrderRow | null;
  try {
    row = await db
      .prepare('SELECT id, status, order_type AS channel, customer_id, created_at FROM orders WHERE id = ?')
      .bind(orderId)
      .first<OrderRow>();
  } catch (e) {
    return { ok: false, code: 'd1_error', error: `failed to read order: ${(e as Error).message}` };
  }

  if (!row) {
    return { ok: false, code: 'not_found', error: `order not found: ${orderId}` };
  }

  // Customer-scoped: a customer may only read their own fulfillment.
  if (viewerCustomerId && row.customer_id !== viewerCustomerId) {
    return { ok: false, code: 'forbidden', error: 'not your order' };
  }

  const channel = (row.channel === 'delivery' ? 'delivery' : 'pickup') as FulfillmentChannel;
  const isTerminal = TERMINAL_STATUSES.has(row.status);

  let queueDepth = 0;
  if (!isTerminal) {
    try {
      const q = await db
        .prepare('SELECT COUNT(*) AS c FROM orders WHERE status = ? AND created_at < ?')
        .bind('pending', row.created_at)
        .first<{ c: number }>();
      queueDepth = q?.c ?? 0;
    } catch {
      queueDepth = 0;
    }
  }

  const etaMinutes = isTerminal ? 0 : BASELINE_PREP_MINUTES + queueDepth * MINUTES_PER_PENDING;
  const etaAt = isTerminal
    ? null
    : new Date(Date.now() + etaMinutes * 60_000).toISOString();

  // Pickup point is only relevant for active pickup orders.
  const pickupPoint = !isTerminal && channel === 'pickup' ? await resolvePickupPoint(kv) : null;

  return {
    ok: true,
    fulfillment: {
      orderId: row.id,
      status: row.status,
      channel,
      etaAt,
      etaMinutes,
      pickupPoint,
      queueDepth,
    },
  };
}

async function resolvePickupPoint(kv?: KVNamespace): Promise<PickupPoint> {
  if (!kv) return DEFAULT_PICKUP_POINT;
  try {
    const raw = await kv.get('fulfillment:pickup_point');
    if (!raw) return DEFAULT_PICKUP_POINT;
    const parsed = JSON.parse(raw) as Partial<PickupPoint>;
    return {
      id: parsed.id ?? DEFAULT_PICKUP_POINT.id,
      name: parsed.name ?? DEFAULT_PICKUP_POINT.name,
      address: parsed.address ?? DEFAULT_PICKUP_POINT.address,
      hint: parsed.hint ?? null,
    };
  } catch {
    return DEFAULT_PICKUP_POINT;
  }
}

/**
 * Public pickup-point list — used by the ordering surface so the customer
 * can confirm where to collect before placing the order.
 */
export async function listPickupPoints(kv?: KVNamespace): Promise<PickupPoint[]> {
  const main = await resolvePickupPoint(kv);
  // Single location for now — multi-point is additive via KV array later.
  return [main];
}
