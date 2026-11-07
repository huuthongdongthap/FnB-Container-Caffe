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
  const rawTenantId = (options.tenantId ?? '').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const tenantClause = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')"
      : ' AND tenant_id = ?';
  const tenantBinds = tenantId === '*' ? [] : [tenantId];
  let order: { id: string; status: string; tenant_id?: string | null } | null = options.currentOrder ?? null;
  if (!order) {
    if (tenantId === '*') {
      order = await db
        .prepare('SELECT id, status, tenant_id FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ id: string; status: string; tenant_id?: string | null }>()
        .catch(() => null);
      if (!order) {
        order = await db
          .prepare('SELECT id, status FROM orders WHERE id = ?')
          .bind(orderId)
          .first<{ id: string; status: string }>()
          .catch(() => null);
      }
    } else {
      order = await db
        .prepare(`SELECT id, status FROM orders WHERE id = ?${tenantClause}`)
        .bind(orderId, ...tenantBinds)
        .first<{ id: string; status: string }>();
    }
  }
  if (!order) return { success: false, error: 'Order not found', statusCode: 404 };
  const resolvedOrderTenant =
    tenantId === '*' && 'tenant_id' in order && order.tenant_id !== undefined
      ? (typeof order.tenant_id === 'string' &&
        order.tenant_id.trim() &&
        order.tenant_id.trim() !== '*' &&
        order.tenant_id.trim().toLowerCase() !== 'hq'
          ? order.tenant_id.trim()
          : 'default')
      : null;
  const effectiveWriteTenant = resolvedOrderTenant ?? tenantId;
  const writeTenantClause = effectiveWriteTenant === '*'
    ? ''
    : effectiveWriteTenant === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')"
      : ' AND tenant_id = ?';
  const writeTenantBinds = effectiveWriteTenant === '*' ? [] : [effectiveWriteTenant];

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

  if (targetStatus === 'preparing') {
    try {
      const paymentRow = await db
        .prepare(`SELECT order_type, payment_status FROM orders WHERE id = ?${writeTenantClause}`)
        .bind(orderId, ...writeTenantBinds)
        .first<{ order_type?: string | null; payment_status?: string | null }>();
      if (paymentRow?.order_type === 'delivery' && paymentRow?.payment_status !== 'paid') {
        return {
          success: false,
          error: 'Đơn giao tận nơi phải hoàn tất thanh toán trước khi chế biến',
          statusCode: 409,
        };
      }
    } catch {
      // Allow fallback when minimal schema omits order_type or payment_status
    }
  }

  const fields = Object.entries(options.fields ?? {}).filter(([, value]) => value !== undefined);
  if (isNoOp && fields.length === 0) {
    return { success: true, idempotent: true, order: { id: orderId, status: targetStatus, previous_status: order.status } };
  }
  const additions = fields.map(([key]) => `, ${key} = ?`).join('');
  const result = await db.prepare(
    `UPDATE orders SET status = ?, updated_at = ?${additions} WHERE id = ? AND status = ?${writeTenantClause}`,
  ).bind(targetStatus, new Date().toISOString(), ...fields.map(([, value]) => value), orderId, order.status, ...writeTenantBinds).run();
  // D1 changes includes timestamp/audit trigger writes; this PK-scoped CAS still matches at most one order.
  if (changedRows(result) < 1) {
    return { success: false, error: 'Order changed concurrently; refresh and retry', statusCode: 409 };
  }
  return { success: true, order: { id: orderId, status: targetStatus, previous_status: order.status } };
}
