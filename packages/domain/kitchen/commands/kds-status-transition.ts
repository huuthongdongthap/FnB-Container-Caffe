/**
 * Canonical KDS Status Transition Coordinator
 * Single server-authoritative status transition executor for all KDS channels.
 */

import { transitionOrderStatus, type OrderStatusDb, type OrderStatusResult } from '../../order/policies/order-status-transition';

export type TransitionKdsResult = OrderStatusResult;
export type KdsTransitionDb = OrderStatusDb;

export interface KdsTransitionOptions {
  tenantId?: string;
  kv?: { put(key: string, val: string, opts?: { expirationTtl?: number }): Promise<void> } | null;
  waitUntil?: (promise: Promise<unknown>) => void;
  env?: Record<string, unknown>;
}

/**
 * Executes a canonical order state machine transition for KDS.
 * Enforces:
 * - Order existence
 * - Idempotency (same state returns success: true, idempotent: true)
 * - Terminal state immutability (completed, cancelled, failed, expired)
 * - Structural transition validity (canTransition)
 * - Actor role permissions (canActorTransition)
 */
export async function executeKdsStatusTransition(
  db: KdsTransitionDb,
  orderId: string,
  targetStatus: string,
  userRole?: string,
  options?: KdsTransitionOptions,
): Promise<TransitionKdsResult> {
  const result = await transitionOrderStatus(db, orderId, targetStatus, userRole, { tenantId: options?.tenantId });
  if (!result.success || result.idempotent) return result;
  const order = result.order!;
  const now = new Date().toISOString();

  if (options?.kv) {
    const eventPayload = JSON.stringify({
      orderId,
      status: targetStatus,
      previous_status: order.previous_status,
      timestamp: now,
    });
    const putPromise = Promise.all([
      options.kv.put(`order_event:${orderId}`, eventPayload, { expirationTtl: 60 }),
      options.kv.put('latest_order_ts', now),
      options.kv.put('orders:latest_updated_at', now),
    ]);
    if (options.waitUntil) {
      options.waitUntil(putPromise);
    } else {
      await putPromise.catch(() => {});
    }
  }

  if (options?.env) {
    const sideEffects = (async () => {
      try {
        const broadcaster = options.env?.ORDER_BROADCASTER as {
          idFromName?: (name: string) => unknown;
          get?: (id: unknown) => { fetch: (req: Request) => Promise<unknown> };
        } | undefined;
        if (broadcaster?.idFromName && broadcaster?.get) {
          const tenantId = options?.tenantId ?? 'default';
          const row = await db.prepare(`SELECT id, items, total, payment_status, customer_name, customer_phone, table_id, created_at
            FROM orders WHERE id = ?${tenantId === '*' ? '' : ' AND tenant_id = ?'}`)
            .bind(orderId, ...(tenantId === '*' ? [] : [tenantId])).first<{
              items: string | unknown[]; total: number; payment_status: string;
              customer_name: string; customer_phone: string; table_id?: string | null; created_at: string;
            }>();
          if (!row) return;
          const items = Array.isArray(row.items) ? row.items : JSON.parse(row.items);
          if (!Array.isArray(items)) return;
          const createdAt = Date.parse(row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`);
          const doId = broadcaster.idFromName(orderId);
          const stub = broadcaster.get(doId);
          await stub.fetch(
            new Request('https://do/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId,
                status: targetStatus,
                payment_status: row.payment_status,
                items, total: row.total, customer_name: row.customer_name, customer_phone: row.customer_phone,
                table_id: row.table_id, createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(), updatedAt: Date.now(),
              }),
            })
          );
        }
      } catch {
        // Non-blocking broadcaster notification
      }
    })();

    if (options.waitUntil) {
      options.waitUntil(sideEffects);
    } else {
      await sideEffects;
    }
  }

  return {
    success: true,
    order: { id: order.id, status: targetStatus, previous_status: order.previous_status },
  };
}
