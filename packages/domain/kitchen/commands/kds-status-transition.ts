/**
 * Canonical KDS Status Transition Coordinator
 * Single server-authoritative status transition executor for all KDS channels.
 */

import { canTransition, isTerminal, canActorTransition, toActorRole } from '@aura/domain-order';

export interface TransitionKdsResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  idempotent?: boolean;
  order?: {
    id: string;
    status: string;
    previous_status: string;
  };
}

export interface KdsTransitionDb {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export interface KdsTransitionOptions {
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
  const order = await db
    .prepare('SELECT id, status FROM orders WHERE id = ?')
    .bind(orderId)
    .first<{ id: string; status: string }>();

  if (!order) {
    return { success: false, error: 'Order not found', statusCode: 404 };
  }

  // Idempotent duplicate event
  if (order.status === targetStatus) {
    return {
      success: true,
      idempotent: true,
      order: { id: order.id, status: targetStatus, previous_status: order.status },
    };
  }

  // Terminal state immutability
  if (isTerminal(order.status)) {
    return {
      success: false,
      error: `Cannot transition terminal order (${order.status})`,
      statusCode: 400,
    };
  }

  // Structural transition validation
  const structural = canTransition(order.status, targetStatus);
  const isKdsDirectStart = order.status === 'pending' && targetStatus === 'preparing';
  if (!structural.ok && !isKdsDirectStart) {
    return { success: false, error: structural.error, statusCode: 400 };
  }

  // Role authorization validation
  const role = toActorRole(userRole || 'staff');
  const authCheck = isKdsDirectStart
    ? canActorTransition(role, 'confirmed', 'preparing')
    : canActorTransition(role, order.status, targetStatus);
  if (!authCheck.ok) {
    return { success: false, error: authCheck.error, statusCode: 403 };
  }

  const now = new Date().toISOString();
  await db
    .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
    .bind(targetStatus, now, orderId)
    .run();

  if (options?.kv) {
    const eventPayload = JSON.stringify({
      orderId,
      status: targetStatus,
      previous_status: order.status,
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
          const doId = broadcaster.idFromName('global');
          const stub = broadcaster.get(doId);
          await stub.fetch(
            new Request('https://do/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'order_status_updated',
                order_id: orderId,
                status: targetStatus,
                previous_status: order.status,
                updated_at: now,
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
    order: { id: order.id, status: targetStatus, previous_status: order.status },
  };
}
