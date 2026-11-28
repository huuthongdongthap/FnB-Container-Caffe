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

/** Terminal void statuses share the same money/invoice/rollback obligations. */
export const VOID_STATUSES = ['cancelled', 'failed', 'expired'] as const;
export function isVoidStatus(status: unknown): boolean {
  return (VOID_STATUSES as readonly string[]).includes(String(status ?? '').trim().toLowerCase());
}

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
    currentOrder?: {
      id: string;
      status: string;
      payment_status?: string | null;
      order_type?: string | null;
      assigned_shipper_id?: string | null;
      total?: number | string | null;
      total_amount?: number | string | null;
    };
    paymentStatus?: string | null;
    allowPaidCompensation?: boolean;
    allowZeroTotalCancel?: boolean;
    actorId?: string;
    validateAssignedShipper?: boolean;
    fields?: Record<string, unknown>;
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

  const mutableFields: Record<string, unknown> = { ...(options.fields ?? {}) };
  const normalizedActor = (actorRole ?? '').trim().toLowerCase();
  const isShipperActor =
    normalizedActor === 'shipper' ||
    normalizedActor === 'rider' ||
    normalizedActor === 'driver' ||
    normalizedActor === 'delivery';
  const cleanActorId = typeof options.actorId === 'string' ? options.actorId.trim() : '';

  let metaRow: {
    order_type?: string | null;
    payment_status?: string | null;
    payment_method?: string | null;
    is_cod?: number | string | null;
    assigned_shipper_id?: string | null;
  } | null = null;

  if (
    !isNoOp ||
    isShipperActor ||
    options.validateAssignedShipper ||
    mutableFields.assigned_shipper_id !== undefined
  ) {
    try {
      metaRow = await db
        .prepare(
          `SELECT order_type, payment_status, payment_method, is_cod, assigned_shipper_id FROM orders WHERE id = ?${writeTenantClause}`,
        )
        .bind(orderId, ...writeTenantBinds)
        .first();
    } catch {
      try {
        metaRow = await db
          .prepare(
            `SELECT order_type, payment_status, payment_method, assigned_shipper_id FROM orders WHERE id = ?${writeTenantClause}`,
          )
          .bind(orderId, ...writeTenantBinds)
          .first();
      } catch {
        try {
          metaRow = await db
            .prepare(`SELECT order_type, payment_status, payment_method, is_cod FROM orders WHERE id = ?${writeTenantClause}`)
            .bind(orderId, ...writeTenantBinds)
            .first();
        } catch {
          try {
            metaRow = await db
              .prepare(`SELECT order_type, payment_status, payment_method FROM orders WHERE id = ?${writeTenantClause}`)
              .bind(orderId, ...writeTenantBinds)
              .first();
          } catch {
            try {
              metaRow = await db
                .prepare(`SELECT order_type, payment_status FROM orders WHERE id = ?${writeTenantClause}`)
                .bind(orderId, ...writeTenantBinds)
                .first();
            } catch {
              metaRow = null;
            }
          }
        }
      }
    }
  }

  const persistedOrderType = String(
    metaRow?.order_type ?? options.currentOrder?.order_type ?? '',
  )
    .trim()
    .toLowerCase();

  if (!isNoOp && persistedOrderType) {
    if (
      (persistedOrderType === 'dine_in' || persistedOrderType === 'takeaway') &&
      (targetStatus === 'delivering' || targetStatus === 'delivered')
    ) {
      return {
        success: false,
        error: `Order type '${persistedOrderType}' cannot transition to '${targetStatus}'`,
        statusCode: 400,
      };
    }
    if (persistedOrderType === 'delivery' && targetStatus === 'served') {
      return {
        success: false,
        error: "Order type 'delivery' cannot transition to 'served'",
        statusCode: 400,
      };
    }
  }

  if (isShipperActor) {
    if (persistedOrderType && persistedOrderType !== 'delivery') {
      return {
        success: false,
        error: 'Shippers may only update delivery orders',
        statusCode: 403,
      };
    }
    const persistedShipperId = String(
      metaRow?.assigned_shipper_id ?? options.currentOrder?.assigned_shipper_id ?? '',
    ).trim();
    if (persistedShipperId && (!cleanActorId || persistedShipperId !== cleanActorId)) {
      return {
        success: false,
        error: 'Forbidden: order is assigned to another shipper',
        statusCode: 403,
      };
    }
    const incomingShipperId =
      typeof mutableFields.assigned_shipper_id === 'string'
        ? mutableFields.assigned_shipper_id.trim()
        : '';
    if (incomingShipperId && (!cleanActorId || incomingShipperId !== cleanActorId)) {
      return {
        success: false,
        error: 'Shippers cannot assign an order to another shipper',
        statusCode: 403,
      };
    }
    if (!persistedShipperId) {
      const isSelfClaim =
        order.status === 'ready' &&
        targetStatus === 'delivering' &&
        Boolean(cleanActorId);
      if (isSelfClaim) {
        if (!incomingShipperId) {
          mutableFields.assigned_shipper_id = cleanActorId;
        }
      } else {
        // Preserve 400 validation error when delivery failure is missing a required reason
        const missingFailureReason =
          targetStatus === 'failed' &&
          !(typeof mutableFields.failure_reason === 'string' && mutableFields.failure_reason.trim().length > 0);
        if (!missingFailureReason) {
          return {
            success: false,
            error: 'Forbidden: order must be assigned to this shipper',
            statusCode: 403,
          };
        }
      }
    }
  }

  const requestedShipperId =
    typeof mutableFields.assigned_shipper_id === 'string'
      ? mutableFields.assigned_shipper_id.trim()
      : '';
  if (requestedShipperId && (options.validateAssignedShipper || Boolean(cleanActorId))) {
    type ShipperUserRow = {
      id?: string;
      name?: string | null;
      role?: string | null;
      tenant_id?: string | null;
      is_active?: number | null;
    };
    let hasUsersTable = true;
    let shipperUser: ShipperUserRow | null = null;
    try {
      shipperUser = await db
        .prepare('SELECT id, name, role, tenant_id, is_active FROM users WHERE id = ? LIMIT 1')
        .bind(requestedShipperId)
        .first<ShipperUserRow>();
    } catch (userErr) {
      const errMsg = String(userErr);
      if (/no such table:.*\busers\b/i.test(errMsg)) {
        hasUsersTable = false;
      } else if (/no such column:.*tenant_id/i.test(errMsg)) {
        shipperUser = await db
          .prepare('SELECT id, name, role, is_active FROM users WHERE id = ? LIMIT 1')
          .bind(requestedShipperId)
          .first<ShipperUserRow>()
          .catch(() => null);
      } else {
        throw userErr;
      }
    }
    if (hasUsersTable) {
      if (!shipperUser || Number(shipperUser.is_active ?? 1) !== 1) {
        return {
          success: false,
          error: 'Assigned shipper account not found or inactive',
          statusCode: 400,
        };
      }
      const uRole = String(shipperUser.role ?? '').trim().toLowerCase();
      if (uRole === 'customer' || !uRole) {
        return {
          success: false,
          error: 'Assigned shipper must be an active staff or shipper account',
          statusCode: 400,
        };
      }
      if (effectiveWriteTenant !== '*' && 'tenant_id' in shipperUser && shipperUser.tenant_id !== undefined) {
        const uTenant = (typeof shipperUser.tenant_id === 'string' && shipperUser.tenant_id.trim()) || 'default';
        const isHqUser =
          (uRole === 'owner' || uRole === 'admin') &&
          (uTenant === '*' || uTenant.toLowerCase() === 'hq');
        if (!isHqUser && uTenant !== effectiveWriteTenant) {
          return {
            success: false,
            error: 'Assigned shipper does not belong to this store',
            statusCode: 400,
          };
        }
      }
      if (!mutableFields.shipper_name && typeof shipperUser.name === 'string' && shipperUser.name.trim()) {
        mutableFields.shipper_name = shipperUser.name.trim();
      }
    }
  }

  if (targetStatus === 'preparing' || targetStatus === 'delivering' || targetStatus === 'delivered') {
    const incomingPaymentMethod =
      typeof mutableFields.payment_method === 'string'
        ? mutableFields.payment_method.trim().toLowerCase()
        : '';
    const persistedMethod = String(metaRow?.payment_method ?? '').trim().toLowerCase();
    const method = incomingPaymentMethod || persistedMethod;
    const rawPaymentStatus = String(
      metaRow?.payment_status ?? options.paymentStatus ?? options.currentOrder?.payment_status ?? '',
    ).trim().toLowerCase();
    const isPaid =
      rawPaymentStatus === 'paid' ||
      rawPaymentStatus === 'completed' ||
      rawPaymentStatus === 'partially_refunded';
    const isCodDelivery = incomingPaymentMethod
      ? method === 'cod' || method === 'cash'
      : persistedMethod === 'cod' || persistedMethod === 'cash' || Number(metaRow?.is_cod ?? 0) === 1;
    const isPrepaidOnline =
      method === 'payos' || method === 'bank_transfer' || method === 'qr' || method === 'vietqr';
    if (isPrepaidOnline && !isPaid) {
      return {
        success: false,
        error:
          targetStatus === 'preparing'
            ? 'Đơn thanh toán trực tuyến phải hoàn tất thanh toán trước khi chế biến'
            : 'Đơn thanh toán trực tuyến phải hoàn tất thanh toán trước khi giao hàng',
        statusCode: 409,
      };
    }
    if (targetStatus === 'preparing' && persistedOrderType === 'delivery' && !isPaid && !isCodDelivery) {
      return {
        success: false,
        error: 'Đơn giao tận nơi phải hoàn tất thanh toán trước khi chế biến',
        statusCode: 409,
      };
    }
    if (targetStatus === 'delivered' && isCodDelivery && !isPaid) {
      return {
        success: false,
        error: 'Đơn giao hàng COD phải thu tiền trước khi đánh dấu đã giao',
        statusCode: 409,
      };
    }
  }

  if (isVoidStatus(targetStatus) && !isNoOp) {
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
    // rollback paths (or authorized delivery-failure reporting with an explicit reason) may compensate a paid order.
    const hasFailureReason =
      typeof mutableFields.failure_reason === 'string' && mutableFields.failure_reason.trim().length > 0;
    if (targetStatus === 'failed' && !hasFailureReason) {
      return {
        success: false,
        error: 'Lý do giao thất bại là bắt buộc',
        statusCode: 400,
      };
    }
    const isManagerActor =
      normalizedActor === 'owner' ||
      normalizedActor === 'admin' ||
      normalizedActor === 'manager' ||
      normalizedActor === 'supervisor';
    const isDispatchFailureActor =
      targetStatus === 'failed' &&
      order.status === 'delivering' &&
      hasFailureReason &&
      (normalizedActor === 'staff' ||
        normalizedActor === 'cashier' ||
        normalizedActor === 'waiter' ||
        normalizedActor === 'shipper' ||
        normalizedActor === 'rider');
    let isZeroTotalPendingCancel = false;
    if (
      targetStatus === 'cancelled' &&
      String(order.status ?? '').trim().toLowerCase() === 'pending' &&
      (options.allowZeroTotalCancel || options.allowPaidCompensation)
    ) {
      if (options.allowZeroTotalCancel) {
        isZeroTotalPendingCancel = true;
      } else {
        let rawKnownTotal: unknown =
          options.currentOrder?.total ?? options.currentOrder?.total_amount;
        if (rawKnownTotal === undefined) {
          try {
            const totalRow = await db
              .prepare(`SELECT total, total_amount FROM orders WHERE id = ?${writeTenantClause}`)
              .bind(orderId, ...writeTenantBinds)
              .first<{ total?: number | string | null; total_amount?: number | string | null }>()
              .catch(() =>
                db
                  .prepare(`SELECT total FROM orders WHERE id = ?${writeTenantClause}`)
                  .bind(orderId, ...writeTenantBinds)
                  .first<{ total?: number | string | null }>()
                  .catch(() => null)
              );
            rawKnownTotal = totalRow?.total ?? (totalRow as { total_amount?: unknown } | null)?.total_amount;
          } catch {
            // ignore schema without total column
          }
        }
        isZeroTotalPendingCancel =
          rawKnownTotal !== null &&
          rawKnownTotal !== undefined &&
          rawKnownTotal !== '' &&
          Number(rawKnownTotal) === 0;
      }
    }
    const canCompensatePaid = Boolean(
      (options.allowPaidCompensation && isManagerActor) ||
        isDispatchFailureActor ||
        isZeroTotalPendingCancel,
    );
    let knownPaymentStatus: string | null | undefined =
      options.paymentStatus ??
      metaRow?.payment_status ??
      (options.currentOrder as { payment_status?: string | null } | undefined)?.payment_status;
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
    const normalizedKnownPay = String(knownPaymentStatus ?? '').trim().toLowerCase();
    if (
      !canCompensatePaid &&
      (normalizedKnownPay === 'paid' ||
        normalizedKnownPay === 'completed' ||
        normalizedKnownPay === 'partially_refunded')
    ) {
      return { success: false, error: PAID_ORDER_CANCEL_ERROR, statusCode: 409 };
    }
  }

  const allowedFieldKeys = new Set([
    'notes',
    'delivery_time',
    'payment_method',
    'payment_status',
    'assigned_shipper_id',
    'shipper_name',
    'failure_reason',
  ]);
  const optionalDeliveryKeys = new Set(['assigned_shipper_id', 'shipper_name', 'failure_reason']);
  const fields = Object.entries(mutableFields).filter(
    ([key, value]) => allowedFieldKeys.has(key) && value !== undefined,
  );
  if (isNoOp && fields.length === 0) {
    return { success: true, idempotent: true, order: { id: orderId, status: targetStatus, previous_status: order.status } };
  }
  const hasPaymentMethodField = fields.some(([key]) => key === 'payment_method');
  const paymentMethodGuard = hasPaymentMethodField
    ? " AND LOWER(TRIM(COALESCE(payment_status, ''))) NOT IN ('paid', 'completed', 'refunded', 'partially_refunded')"
    : '';
  const nowIso = new Date().toISOString();
  const fieldKeys = new Set(fields.map(([key]) => key));
  const priorLower = String(order.status ?? '').trim().toLowerCase();
  const cancelAlertFlag =
    priorLower === 'confirmed' ||
    priorLower === 'preparing' ||
    priorLower === 'ready' ||
    priorLower === 'delivering'
      ? 1
      : 0;
  const safePriorStatus = /^[a-z_]{1,24}$/.test(priorLower) ? priorLower : null;
  type LifecycleColumnClause = {
    col: string;
    sql: string;
  };
  const initialLifecycleClauses: LifecycleColumnClause[] = [];
  if (!isNoOp) {
    if (targetStatus === 'preparing' && !fieldKeys.has('started_at')) {
      initialLifecycleClauses.push({
        col: 'started_at',
        sql: ', started_at = COALESCE(started_at, ?2)',
      });
    } else if (targetStatus === 'ready' && !fieldKeys.has('ready_at')) {
      initialLifecycleClauses.push({
        col: 'ready_at',
        sql: ', ready_at = COALESCE(ready_at, ?2)',
      });
    } else if (targetStatus === 'served' && !fieldKeys.has('served_at')) {
      initialLifecycleClauses.push({
        col: 'served_at',
        sql: ', served_at = COALESCE(served_at, ?2)',
      });
    } else if (targetStatus === 'cancelled' || targetStatus === 'failed') {
      if (targetStatus === 'cancelled' && !fieldKeys.has('cancelled_at')) {
        initialLifecycleClauses.push({
          col: 'cancelled_at',
          sql: ', cancelled_at = COALESCE(cancelled_at, ?2)',
        });
      }
      if (!fieldKeys.has('previous_status') && safePriorStatus) {
        initialLifecycleClauses.push({
          col: 'previous_status',
          sql: `, previous_status = '${safePriorStatus}'`,
        });
      }
      if (!fieldKeys.has('cancel_alert')) {
        initialLifecycleClauses.push({
          col: 'cancel_alert',
          sql: `, cancel_alert = ${cancelAlertFlag}`,
        });
      }
    }
  }
  const updateStatus = (
    guard = '',
    lifecycleClauses: LifecycleColumnClause[] = initialLifecycleClauses,
    activeFields = fields,
  ) => {
    const lifecycleSql = lifecycleClauses.map((c) => c.sql).join('');
    const additions = activeFields.map(([key]) => `, ${key} = ?`).join('');
    return db
      .prepare(
        `UPDATE orders SET status = ?, updated_at = ?${lifecycleSql}${additions} WHERE id = ? AND status = ?${writeTenantClause}${guard}`,
      )
      .bind(
        targetStatus,
        nowIso,
        ...activeFields.map(([, value]) => value),
        orderId,
        order.status,
        ...writeTenantBinds,
      )
      .run();
  };
  const runUpdateWithCompatFallback = async (initialGuard: string): Promise<unknown> => {
    let guard = initialGuard;
    let lifecycleClauses = [...initialLifecycleClauses];
    let activeFields = fields;
    for (;;) {
      try {
        return await updateStatus(guard, lifecycleClauses, activeFields);
      } catch (error) {
        const msg = String(error);
        const missingLifecycleMatch = msg.match(
          /no such column:\s*(started_at|ready_at|served_at|cancelled_at|previous_status|cancel_alert)\b/i,
        );
        if (missingLifecycleMatch && lifecycleClauses.length > 0) {
          const missingCol = missingLifecycleMatch[1]!.toLowerCase();
          const filtered = lifecycleClauses.filter((c) => c.col !== missingCol);
          if (filtered.length < lifecycleClauses.length) {
            lifecycleClauses = filtered;
            continue;
          }
        }
        if (
          activeFields.some(([key]) => optionalDeliveryKeys.has(key)) &&
          /no such column:\s*(assigned_shipper_id|shipper_name|failure_reason)\b/i.test(msg)
        ) {
          activeFields = activeFields.filter(([key]) => !optionalDeliveryKeys.has(key));
          continue;
        }
        if (guard && /no such column:\s*payment_status\b/i.test(msg)) {
          guard = '';
          continue;
        }
        throw error;
      }
    }
  };
  const closingOrder = targetStatus === 'completed' && !isNoOp;
  const atomicMarkingPaid =
    String((options.fields as Record<string, unknown> | undefined)?.payment_status ?? '')
      .trim()
      .toLowerCase() === 'paid';
  let result: unknown;
  if (closingOrder && !atomicMarkingPaid) {
    // Require persisted payment settlement before completing an order.
    const paid = "LOWER(TRIM(COALESCE(payment_status, ''))) IN ('paid', 'completed', 'partially_refunded')";
    result = await runUpdateWithCompatFallback(` AND ${paid}${paymentMethodGuard}`);
  } else if (forwardStatuses.has(targetStatus)) {
    result = await runUpdateWithCompatFallback(
      ` AND LOWER(TRIM(COALESCE(payment_status, ''))) <> 'refunded'${paymentMethodGuard}`,
    );
  } else {
    result = await runUpdateWithCompatFallback(paymentMethodGuard);
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
