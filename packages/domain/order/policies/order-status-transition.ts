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

export const PAID_ORDER_CANCEL_ERROR = 'Paid order cannot be cancelled; initiate a refund instead';
export const ISSUED_EINVOICE_CANCEL_ERROR = 'Cannot cancel an order with an issued e-invoice; issue a credit note or adjustment instead';

const ISSUED_INVOICE_SYNC_STATUSES = ['synced', 'submitted', 'issued', 'completed'] as const;

export async function hasIssuedEInvoiceForOrder(db: OrderStatusDb, orderId: string): Promise<boolean> {
  const placeholders = ISSUED_INVOICE_SYNC_STATUSES.map(() => '?').join(', ');
  const queries: Array<{ sql: string; binds: unknown[] }> = [
    {
      sql: `SELECT id, sync_status, erpnext_id, erpnext_invoice_id FROM erpnext_mappings
             WHERE (aura_order_id = ? OR (local_type IN ('order', 'sales_invoice') AND local_id = ?))
               AND LOWER(COALESCE(sync_status, '')) IN (${placeholders})
               AND COALESCE(NULLIF(TRIM(erpnext_invoice_id), ''), NULLIF(TRIM(CAST(erpnext_id AS TEXT)), '')) IS NOT NULL
             LIMIT 1`,
      binds: [orderId, orderId, ...ISSUED_INVOICE_SYNC_STATUSES],
    },
    {
      sql: `SELECT id, sync_status, erpnext_id FROM erpnext_mappings
             WHERE local_type IN ('order', 'sales_invoice') AND local_id = ?
               AND LOWER(COALESCE(sync_status, '')) IN (${placeholders})
               AND NULLIF(TRIM(CAST(erpnext_id AS TEXT)), '') IS NOT NULL
             LIMIT 1`,
      binds: [orderId, ...ISSUED_INVOICE_SYNC_STATUSES],
    },
  ];
  for (const q of queries) {
    try {
      const stmt = db.prepare(q.sql);
      if (typeof stmt?.bind !== 'function') return false;
      const bound = stmt.bind(...q.binds);
      if (typeof bound?.first !== 'function') return false;
      const row = await bound.first<{
        id?: unknown;
        sync_status?: unknown;
        erpnext_id?: unknown;
        erpnext_invoice_id?: unknown;
      }>();
      if (!row || typeof row !== 'object') return false;
      const syncStatus = typeof row.sync_status === 'string' ? row.sync_status.trim().toLowerCase() : '';
      const hasInvoiceRef =
        (row.erpnext_invoice_id !== undefined && row.erpnext_invoice_id !== null && String(row.erpnext_invoice_id).trim() !== '') ||
        (row.erpnext_id !== undefined && row.erpnext_id !== null && String(row.erpnext_id).trim() !== '');
      return (ISSUED_INVOICE_SYNC_STATUSES as readonly string[]).includes(syncStatus) && hasInvoiceRef;
    } catch {
      // Column variant or table absent in minimal schema: try narrower variant
    }
  }
  return false;
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
    currentOrder?: { id: string; status: string; payment_status?: string | null };
    paymentStatus?: string | null;
    allowPaidCompensation?: boolean;
    fields?: { notes?: unknown; delivery_time?: unknown; payment_method?: unknown; payment_status?: unknown };
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

  const forwardStatuses = new Set(['confirmed', 'preparing', 'ready', 'delivering', 'served', 'delivered', 'completed']);
  if (forwardStatuses.has(targetStatus)) {
    const knownPaymentStatus = String(
      options.paymentStatus ?? options.currentOrder?.payment_status ?? ''
    ).trim().toLowerCase();
    if (knownPaymentStatus === 'refunded') {
      return {
        success: false,
        error: 'Đơn hàng đã hoàn tiền — không thể tiếp tục chế biến hoặc phục vụ',
        statusCode: 409,
      };
    }
    if (!knownPaymentStatus) {
      try {
        const payRow = await db
          .prepare(`SELECT payment_status FROM orders WHERE id = ?${writeTenantClause}`)
          .bind(orderId, ...writeTenantBinds)
          .first<{ payment_status?: string | null }>();
        if (String(payRow?.payment_status ?? '').trim().toLowerCase() === 'refunded') {
          return {
            success: false,
            error: 'Đơn hàng đã hoàn tiền — không thể tiếp tục chế biến hoặc phục vụ',
            statusCode: 409,
          };
        }
      } catch (err) {
        if (!/no such column:\s*payment_status\b/i.test(String(err))) {
          throw err;
        }
      }
    }
  }

  if (targetStatus === 'preparing') {
    try {
      let paymentRow: {
        order_type?: string | null;
        payment_status?: string | null;
        payment_method?: string | null;
        is_cod?: number | string | null;
      } | null = null;
      try {
        paymentRow = await db
          .prepare(`SELECT order_type, payment_status, payment_method, is_cod FROM orders WHERE id = ?${writeTenantClause}`)
          .bind(orderId, ...writeTenantBinds)
          .first();
      } catch {
        try {
          paymentRow = await db
            .prepare(`SELECT order_type, payment_status, payment_method FROM orders WHERE id = ?${writeTenantClause}`)
            .bind(orderId, ...writeTenantBinds)
            .first();
        } catch {
          paymentRow = await db
            .prepare(`SELECT order_type, payment_status FROM orders WHERE id = ?${writeTenantClause}`)
            .bind(orderId, ...writeTenantBinds)
            .first();
        }
      }
      const incomingPaymentMethod =
        typeof options.fields?.payment_method === 'string'
          ? options.fields.payment_method.trim().toLowerCase()
          : '';
      const persistedMethod = String(paymentRow?.payment_method ?? '').trim().toLowerCase();
      const method = incomingPaymentMethod || persistedMethod;
      const rawPaymentStatus = String(
        paymentRow?.payment_status ?? options.paymentStatus ?? options.currentOrder?.payment_status ?? '',
      ).trim().toLowerCase();
      const isCodDelivery = incomingPaymentMethod
        ? method === 'cod'
        : (persistedMethod === 'cod' || Number(paymentRow?.is_cod ?? 0) === 1);
      const isPrepaidOnline =
        method === 'payos' || method === 'bank_transfer' || method === 'qr' || method === 'vietqr';
      if (isPrepaidOnline && rawPaymentStatus && rawPaymentStatus !== 'paid') {
        return {
          success: false,
          error: 'Đơn thanh toán trực tuyến phải hoàn tất thanh toán trước khi chế biến',
          statusCode: 409,
        };
      }
      if (paymentRow?.order_type === 'delivery' && rawPaymentStatus !== 'paid' && !isCodDelivery) {
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

  if (targetStatus === 'cancelled' && !isNoOp) {
    const canProbeIssuedInvoice =
      !options.currentOrder ||
      'payment_status' in options.currentOrder ||
      'total' in options.currentOrder;
    if (canProbeIssuedInvoice && (await hasIssuedEInvoiceForOrder(db, orderId))) {
      return {
        success: false,
        error: ISSUED_EINVOICE_CANCEL_ERROR,
        statusCode: 409,
      };
    }
    // A settled payment must never be dropped by a raw status transition; only management-authorized
    // rollback paths that unwind loyalty, inventory, and wallet state may compensate a paid order.
    const normalizedActor = (actorRole ?? '').trim().toLowerCase();
    const canCompensatePaid = Boolean(
      options.allowPaidCompensation &&
        (normalizedActor === 'owner' ||
          normalizedActor === 'admin' ||
          normalizedActor === 'manager' ||
          normalizedActor === 'supervisor'),
    );
    let knownPaymentStatus: string | null | undefined =
      options.paymentStatus ?? (options.currentOrder as { payment_status?: string | null } | undefined)?.payment_status;
    if (!canCompensatePaid && (knownPaymentStatus === undefined || knownPaymentStatus === null)) {
      try {
        const row = await db
          .prepare(`SELECT payment_status FROM orders WHERE id = ?${writeTenantClause}`)
          .bind(orderId, ...writeTenantBinds)
          .first<{ payment_status?: string | null }>();
        knownPaymentStatus = row?.payment_status;
      } catch {
        // Minimal schemas without payment_status cannot hold a paid order.
      }
    }
    if (!canCompensatePaid && String(knownPaymentStatus ?? '').trim().toLowerCase() === 'paid') {
      return { success: false, error: PAID_ORDER_CANCEL_ERROR, statusCode: 409 };
    }
  }

  const allowedFieldKeys = new Set(['notes', 'delivery_time', 'payment_method', 'payment_status']);
  const fields = Object.entries(options.fields ?? {}).filter(
    ([key, value]) => allowedFieldKeys.has(key) && value !== undefined,
  );
  if (isNoOp && fields.length === 0) {
    return { success: true, idempotent: true, order: { id: orderId, status: targetStatus, previous_status: order.status } };
  }
  const hasPaymentMethodField = fields.some(([key]) => key === 'payment_method');
  const paymentMethodGuard = hasPaymentMethodField
    ? " AND LOWER(TRIM(COALESCE(payment_status, ''))) NOT IN ('paid', 'completed', 'refunded', 'partially_refunded')"
    : '';
  const additions = fields.map(([key]) => `, ${key} = ?`).join('');
  const updateStatus = (guard = '') => db.prepare(
    `UPDATE orders SET status = ?, updated_at = ?${additions} WHERE id = ? AND status = ?${writeTenantClause}${guard}`,
  ).bind(targetStatus, new Date().toISOString(), ...fields.map(([, value]) => value), orderId, order.status, ...writeTenantBinds).run();
  const closingOrder = targetStatus === 'completed' && !isNoOp;
  const atomicMarkingPaid =
    String((options.fields as Record<string, unknown> | undefined)?.payment_status ?? '')
      .trim()
      .toLowerCase() === 'paid';
  let result: unknown;
  if (closingOrder && !atomicMarkingPaid) {
    // Require persisted payment settlement before completing an order.
    const paid = "LOWER(TRIM(COALESCE(payment_status, ''))) IN ('paid', 'partially_refunded')";
    try {
      result = await updateStatus(` AND ${paid}${paymentMethodGuard}`);
    } catch (error) {
      if (!/no such column:\s*payment_status\b/i.test(String(error))) throw error;
      result = await updateStatus();
    }
  } else if (forwardStatuses.has(targetStatus)) {
    try {
      result = await updateStatus(` AND LOWER(TRIM(COALESCE(payment_status, ''))) <> 'refunded'${paymentMethodGuard}`);
    } catch (error) {
      if (!/no such column:\s*payment_status\b/i.test(String(error))) throw error;
      result = await updateStatus();
    }
  } else {
    try {
      result = await updateStatus(paymentMethodGuard);
    } catch (error) {
      if (!/no such column:\s*payment_status\b/i.test(String(error))) throw error;
      result = await updateStatus();
    }
  }
  // D1 changes includes timestamp/audit trigger writes; this PK-scoped CAS still matches at most one order.
  if (changedRows(result) < 1) {
    return {
      success: false,
      error: closingOrder
        ? 'Cannot complete order: payment must be settled before completion'
        : 'Order changed concurrently; refresh and retry',
      statusCode: 409,
    };
  }
  return { success: true, order: { id: orderId, status: targetStatus, previous_status: order.status } };
}
