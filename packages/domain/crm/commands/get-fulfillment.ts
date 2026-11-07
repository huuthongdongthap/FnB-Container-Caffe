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
  tenant_id?: string | null;
}

/**
 * Fulfillment-view terminal set: orders that no longer occupy the kitchen queue.
 *
 * This is a *fulfillment* vocabulary, not the order lifecycle vocabulary — it
 * includes statuses that never block a backend transition (`picked_up`,
 * `rejected`) and is used only to suppress the queue-depth lookup below.
 * Do not read it as an order-lifecycle guard; for that use
 * `packages/domain/order/model/order-state-machine.ts`.
 */
const FULFILLMENT_SETTLED_STATUSES = new Set(['served', 'picked_up', 'delivered', 'completed', 'cancelled', 'rejected']);

/**
 * Compute the fulfillment view for one order.
 * Auth is enforced by the route — this function is pure data.
 */
export async function getFulfillment(
  db: D1Database,
  orderId: string,
  viewerCustomerId?: string,
  kv?: KVNamespace,
  tenantId?: string,
): Promise<GetFulfillmentResult> {
  const rawNormTenant = tenantId !== undefined ? (String(tenantId).trim() || 'default') : undefined;
  const normTenant =
    rawNormTenant && (rawNormTenant === '*' || rawNormTenant.toLowerCase() === 'hq')
      ? '*'
      : rawNormTenant;

  let row: OrderRow | null;
  try {
    row = await db
      .prepare('SELECT id, status, order_type AS channel, customer_id, created_at, tenant_id FROM orders WHERE id = ?')
      .bind(orderId)
      .first<OrderRow>()
      .catch(() =>
        !normTenant || normTenant === 'default'
          ? db
              .prepare('SELECT id, status, order_type AS channel, customer_id, created_at FROM orders WHERE id = ?')
              .bind(orderId)
              .first<OrderRow>()
          : null,
      );
  } catch (e) {
    return { ok: false, code: 'd1_error', error: `failed to read order: ${(e as Error).message}` };
  }

  if (!row) {
    return { ok: false, code: 'not_found', error: `order not found: ${orderId}` };
  }

  let resolvedOrderTenant: string | undefined;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    let rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || '';
    if (!rowTenant && row.customer_id) {
      const custRow = await db
        .prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1')
        .bind(row.customer_id)
        .first<{ tenant_id?: string | null }>()
        .catch(() => null);
      if (custRow?.tenant_id) {
        rowTenant = String(custRow.tenant_id).trim();
      }
    }
    resolvedOrderTenant = rowTenant || 'default';
    if (normTenant && normTenant !== '*' && resolvedOrderTenant !== normTenant) {
      return { ok: false, code: 'forbidden', error: 'order belongs to another store' };
    }
  }

  // Customer-scoped: a customer may only read their own fulfillment.
  if (viewerCustomerId && row.customer_id !== viewerCustomerId) {
    return { ok: false, code: 'forbidden', error: 'not your order' };
  }

  const channel = (row.channel === 'delivery' ? 'delivery' : 'pickup') as FulfillmentChannel;
  const isSettled = FULFILLMENT_SETTLED_STATUSES.has(row.status);
  const effectiveOrderTenant = (normTenant && normTenant !== '*'
    ? normTenant
    : resolvedOrderTenant) || 'default';
  const effectiveQueueTenant = effectiveOrderTenant;

  let queueDepth = 0;
  if (!isSettled) {
    try {
      const q = await (effectiveOrderTenant && effectiveOrderTenant !== '*'
        ? db
            .prepare("SELECT COUNT(*) AS c FROM orders WHERE status = ? AND created_at < ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)")
            .bind('pending', row.created_at, effectiveOrderTenant)
            .first<{ c: number }>()
            .catch(() =>
              effectiveOrderTenant === 'default'
                ? db
                    .prepare('SELECT COUNT(*) AS c FROM orders WHERE status = ? AND created_at < ?')
                    .bind('pending', row.created_at)
                    .first<{ c: number }>()
                : { c: 0 }
            )
        : db
            .prepare('SELECT COUNT(*) AS c FROM orders WHERE status = ? AND created_at < ?')
            .bind('pending', row.created_at)
            .first<{ c: number }>()
      );
      queueDepth = q?.c ?? 0;
    } catch {
      queueDepth = 0;
    }
  }

  const etaMinutes = isSettled ? 0 : BASELINE_PREP_MINUTES + queueDepth * MINUTES_PER_PENDING;
  const etaAt = isSettled
    ? null
    : new Date(Date.now() + etaMinutes * 60_000).toISOString();

  // Pickup point is only relevant for active pickup orders.
  const pickupPoint = !isSettled && channel === 'pickup' ? await resolvePickupPoint(kv, effectiveQueueTenant) : null;

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

async function resolvePickupPoint(kv?: KVNamespace, tenantId?: string): Promise<PickupPoint> {
  if (!kv) return DEFAULT_PICKUP_POINT;
  try {
    const trimmed = tenantId ? tenantId.trim() : '';
    const normTenant = trimmed && trimmed !== '*' && trimmed.toLowerCase() !== 'hq' ? trimmed : 'default';
    let raw = normTenant !== 'default' ? await kv.get(`fulfillment:pickup_point:${normTenant}`) : null;
    if (!raw) {
      raw = await kv.get('fulfillment:pickup_point');
    }
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
export async function listPickupPoints(kv?: KVNamespace, tenantId?: string): Promise<PickupPoint[]> {
  const main = await resolvePickupPoint(kv, tenantId);
  // Single location for now — multi-point is additive via KV array later.
  return [main];
}
