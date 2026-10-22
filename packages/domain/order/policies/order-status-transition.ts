import { canTransition, isTerminal } from '../model/order-state-machine';
import { canActorTransition, toActorRole } from './transition-authorization';

export interface OrderStatusDb {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export interface OrderStatusResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  idempotent?: boolean;
  order?: { id: string; status: string; previous_status: string };
}

/** D1 must confirm the write; an unknown result must never publish a success. */
export function changedRows(result: unknown): number {
  const value = result as { meta?: { changes?: number }; changes?: number } | null;
  return value?.meta?.changes ?? value?.changes ?? 0;
}

/** One authorization/state/CAS policy shared by every operational order writer. */
export async function transitionOrderStatus(
  db: OrderStatusDb,
  orderId: string,
  targetStatus: string,
  actorRole: string | undefined,
  options: {
    tenantId?: string;
    currentOrder?: { id: string; status: string };
    fields?: { notes?: unknown; delivery_time?: unknown };
  } = {},
): Promise<OrderStatusResult> {
  const tenantId = options.tenantId ?? 'default';
  const tenantClause = tenantId === '*' ? '' : ' AND tenant_id = ?';
  const tenantBinds = tenantId === '*' ? [] : [tenantId];
  const order = options.currentOrder ?? await db
    .prepare(`SELECT id, status FROM orders WHERE id = ?${tenantClause}`)
    .bind(orderId, ...tenantBinds).first<{ id: string; status: string }>();
  if (!order) return { success: false, error: 'Order not found', statusCode: 404 };

  const isNoOp = order.status === targetStatus;
  if (!isNoOp && isTerminal(order.status)) {
    return { success: false, error: `Cannot transition terminal order (${order.status})`, statusCode: 400 };
  }
  const directStart = order.status === 'pending' && targetStatus === 'preparing';
  const structural = canTransition(order.status, targetStatus);
  if (!structural.ok && !directStart) return { success: false, error: structural.error, statusCode: 400 };
  const role = toActorRole(actorRole);
  const allowed = canActorTransition(role, directStart ? 'confirmed' : order.status, targetStatus);
  if (!allowed.ok) return { success: false, error: allowed.error, statusCode: 403 };

  const fields = Object.entries(options.fields ?? {}).filter(([, value]) => value !== undefined);
  if (isNoOp && fields.length === 0) {
    return { success: true, idempotent: true, order: { id: orderId, status: targetStatus, previous_status: order.status } };
  }
  const additions = fields.map(([key]) => `, ${key} = ?`).join('');
  const result = await db.prepare(
    `UPDATE orders SET status = ?, updated_at = ?${additions} WHERE id = ? AND status = ?${tenantClause}`,
  ).bind(targetStatus, new Date().toISOString(), ...fields.map(([, value]) => value), orderId, order.status, ...tenantBinds).run();
  // D1 changes includes timestamp/audit trigger writes; this PK-scoped CAS still matches at most one order.
  if (changedRows(result) < 1) {
    return { success: false, error: 'Order changed concurrently; refresh and retry', statusCode: 409 };
  }
  return { success: true, order: { id: orderId, status: targetStatus, previous_status: order.status } };
}
