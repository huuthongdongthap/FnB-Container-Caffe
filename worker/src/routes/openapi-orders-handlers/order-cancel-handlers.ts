import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { executeKdsStatusTransition } from '@aura/domain-kitchen';
import { restoreInventoryForOrder } from '@aura/domain-inventory';
import { compensateVoidedOrder, releaseTableIfNoActiveOrders, verifyGuestOrderToken } from '@aura/domain-order';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { fetchOrderItemsAndPayments, formatCustomerOrder, formatOrder, resolveOpenApiOrdersTenant } from './helpers';
import { fetchOrderForRead } from './order-read-handlers';

const ISSUED_INVOICE_SYNC_STATUSES = ['synced', 'submitted', 'issued', 'completed'];

/**
 * An order that already carries an issued e-invoice must not be silently voided: the invoice is
 * a legal document and can only be corrected through an adjustment or replacement credit note.
 * Order ids are tenant-owned and the order was tenant-checked by the caller, so the mapping is
 * resolved by order id. Schemas without the mapping table have no invoices to protect.
 */
export async function hasIssuedEInvoice(db: D1Database, orderId: string): Promise<boolean> {
  const placeholders = ISSUED_INVOICE_SYNC_STATUSES.map(() => '?').join(', ');
  const queries = [
    `SELECT id FROM erpnext_mappings
      WHERE (aura_order_id = ? OR (local_type IN ('order', 'sales_invoice') AND local_id = ?))
        AND LOWER(COALESCE(sync_status, '')) IN (${placeholders})
        AND COALESCE(NULLIF(TRIM(erpnext_invoice_id), ''), NULLIF(TRIM(erpnext_id), '')) IS NOT NULL
      LIMIT 1`,
    `SELECT id FROM erpnext_mappings
      WHERE local_type IN ('order', 'sales_invoice') AND local_id = ?
        AND LOWER(COALESCE(sync_status, '')) IN (${placeholders})
        AND NULLIF(TRIM(erpnext_id), '') IS NOT NULL
      LIMIT 1`,
  ];
  const binds = [
    [orderId, orderId, ...ISSUED_INVOICE_SYNC_STATUSES],
    [orderId, ...ISSUED_INVOICE_SYNC_STATUSES],
  ];
  for (let i = 0; i < queries.length; i++) {
    try {
      const row = await db.prepare(queries[i]).bind(...binds[i]).first<{ id: string }>();
      return Boolean(row);
    } catch {
      // Column variant or table absent: try the narrower schema
    }
  }
  return false;
}

export async function runOrderCancellationRollback(params: {
  db: D1Database;
  env?: Env;
  id: string;
  existing: Record<string, unknown>;
  cancelTenant: string;
  now: string;
  reason?: string;
  /** Order status captured before it became 'cancelled'; decides restock vs waste. */
  preCancelStatus?: string;
  actorId?: string | null;
}): Promise<void> {
  const { db, env, id, existing, cancelTenant, now, reason, preCancelStatus, actorId } = params;
  const effectivePreStatus = preCancelStatus ?? (typeof existing.status === 'string' ? existing.status : undefined);

  await restoreInventoryForOrder(
    { AURA_DB: db as any, ...(env || {}) },
    id,
    cancelTenant,
    effectivePreStatus,
  ).catch(() => {});

  try {
    await db.prepare(
      "UPDATE order_items SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(now, id, cancelTenant).run().catch(() => {
      if (cancelTenant === 'default') {
        return db.prepare(
          "UPDATE order_items SET status = 'cancelled', updated_at = ? WHERE order_id = ?"
        ).bind(now, id).run();
      }
    });
  } catch {
    // Column status/updated_at absent in canonical order_items schema
  }

  // Delegates paid COD/cash refund, cashback_used, loyalty_points_redeemed, loyalty_vouchers,
  // promotion_redemptions, promotion_usages, and table_sessions rollback to compensateVoidedOrder.
  await compensateVoidedOrder({
    db,
    env: (env || {}) as unknown as Record<string, unknown>,
    kv: env?.AUTH_KV ?? null,
    orderId: id,
    tenantId: cancelTenant,
    now,
    reason: reason || 'order_cancelled',
    preCancelStatus: effectivePreStatus,
    actorId,
    skipInventoryRestore: true,
  });

  if (existing.table_id) {
    await releaseTableIfNoActiveOrders(db, String(existing.table_id), cancelTenant).catch(() => false);
  }
}

export async function resolveCustomerOwnerIdsForMutation(
  db: ReturnType<typeof getDatabase>,
  user: Record<string, any> | undefined,
  tenantId: string,
): Promise<string[]> {
  if (!user || user.role !== 'customer') return [];
  const ids = new Set<string>();
  for (const candidate of [user.id, user.sub, user.customerId, user.customer_id]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      ids.add(candidate.trim());
    }
  }
  const userId =
    typeof user.id === 'string' && user.id.trim()
      ? user.id.trim()
      : typeof user.sub === 'string' && user.sub.trim()
        ? user.sub.trim()
        : '';
  if (userId) {
    try {
      const res: { results?: Array<{ id?: string }> } =
        tenantId !== '*'
          ? await db
              .prepare(
                "SELECT id FROM customers WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(userId, tenantId)
              .all<{ id?: string }>()
              .catch(async (): Promise<{ results?: Array<{ id?: string }> }> =>
                tenantId === 'default'
                  ? await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all<{ id?: string }>()
                  : { results: [] }
              )
          : await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all<{ id?: string }>();
      for (const row of res?.results || []) {
        if (row?.id && String(row.id).trim()) {
          ids.add(String(row.id).trim());
        }
      }
      if (!res?.results?.length) {
        const single =
          tenantId !== '*'
            ? await db
                .prepare(
                  "SELECT id FROM customers WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
                )
                .bind(userId, tenantId)
                .first<{ id?: string }>()
                .catch(async () =>
                  tenantId === 'default'
                    ? await db.prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1').bind(userId).first<{ id?: string }>()
                    : null
                )
            : await db.prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1').bind(userId).first<{ id?: string }>();
        if (single?.id && String(single.id).trim()) {
          ids.add(String(single.id).trim());
        }
      }
    } catch {
      // Optional user_id column in minimal test schemas
    }
  }
  return Array.from(ids);
}

export async function handleCancelOrder(c: Context<{ Bindings: Env }>) {
  const tenantCheck = resolveOpenApiOrdersTenant(c, 'write');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json().catch(() => ({})));
  const user = c.get('user');
  const now = new Date().toISOString();

  const rawTenantId = (tenantCheck.tenantId || 'default').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const presentedOrderToken = (
    c.req.header('X-Order-Token') || c.req.header('x-order-token') || c.req.query('order_token') || ''
  ).trim();
  const isGuestTokenCancel = !user && Boolean(presentedOrderToken);
  if (!user && !isGuestTokenCancel) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const customer = user?.role === 'customer' || isGuestTokenCancel;
  const ownerIds = user?.role === 'customer'
    ? await resolveCustomerOwnerIdsForMutation(db, user as Record<string, any> | undefined, tenantId)
    : [];
  if (user?.role === 'customer' && ownerIds.length === 0) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  const customerClause = user?.role === 'customer'
    ? (ownerIds.length === 1 ? ' AND customer_id = ?' : ` AND customer_id IN (${ownerIds.map(() => '?').join(', ')})`)
    : '';
  const tenantParamIdx = user?.role === 'customer' ? ownerIds.length + 2 : 2;
  const tenantClause = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ` AND (tenant_id = ? OR TRIM(tenant_id) = ?${tenantParamIdx})`;
  const clause = `${customerClause}${tenantClause}`;
  const scope = user?.role === 'customer'
    ? (tenantId === '*' ? [...ownerIds] : [...ownerIds, tenantId])
    : (tenantId === '*' ? [] : [tenantId]);
  let existing = (await db.prepare(`SELECT * FROM orders WHERE id = ?${clause}`).bind(id, ...scope).first().catch(async () => {
    if (tenantId === 'default') {
      const fallbackScope = user?.role === 'customer' ? [...ownerIds] : [];
      return db.prepare(`SELECT * FROM orders WHERE id = ?${customerClause}`).bind(id, ...fallbackScope).first();
    }
    return null;
  })) as {
    id: string; status: string; payment_status?: string | null; customer_id?: string | null; tenant_id?: string; total?: number; guest_token_hash?: string | null;
  } | null;
  if (existing && user?.role === 'customer') {
    const ordCustId = existing.customer_id ? String(existing.customer_id).trim() : '';
    if (!ordCustId || !ownerIds.includes(ordCustId)) {
      existing = null;
    }
  }
  if (existing && isGuestTokenCancel) {
    const tokenOk = existing.guest_token_hash
      ? await verifyGuestOrderToken(existing.guest_token_hash, presentedOrderToken)
      : false;
    if (!tokenOk) {
      return c.json({ success: false, error: 'Invalid order token' }, 401);
    }
  }
  if (existing && tenantId !== '*' && 'tenant_id' in existing && existing.tenant_id !== undefined) {
    if (!matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) existing = null;
  }
  if (!existing) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const rawExistingTenant =
    existing.tenant_id &&
    String(existing.tenant_id).trim() &&
    String(existing.tenant_id).trim() !== '*' &&
    String(existing.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(existing.tenant_id).trim()
      : undefined;
  const cancelTenant = customer
    ? (rawExistingTenant || 'default')
    : (tenantId === '*' ? (rawExistingTenant || 'default') : (rawExistingTenant || tenantId || 'default'));

  // Idempotent cancellation
  if (existing.status === 'cancelled') {
    const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id, cancelTenant);
    return c.json({
      success: true,
      message: 'Already cancelled',
      data: customer ? formatCustomerOrder(existing, orderItems) : formatOrder(existing, orderItems, payments),
    });
  }

  const normalizedCancelRole = String(user?.role || '').trim().toLowerCase();
  const isShipperCancel = normalizedCancelRole === 'shipper' || normalizedCancelRole === 'rider';
  if (isShipperCancel) {
    const existingRec = existing as Record<string, unknown>;
    const existingType = typeof existingRec.order_type === 'string' ? existingRec.order_type.trim().toLowerCase() : '';
    const assignedShipper = String(existingRec.assigned_shipper_id ?? existingRec.shipper_id ?? '').trim();
    const callerId = String(user?.id || (user as unknown as Record<string, unknown> | undefined)?.sub || '').trim();
    if (existingType && existingType !== 'delivery') {
      return c.json({ success: false, error: 'Shippers may only cancel assigned delivery orders' }, 403);
    }
    if (!assignedShipper || !callerId || assignedShipper !== callerId) {
      return c.json({ success: false, error: 'Forbidden: order is not assigned to this shipper' }, 403);
    }
  }
  const canCompensatePaid = ['owner', 'admin', 'manager', 'supervisor'].includes(normalizedCancelRole);
  const isZeroTotalPending =
    Number(existing.total ?? -1) === 0 &&
    String(existing.status || '').trim().toLowerCase() === 'pending';
  if (!canCompensatePaid && !isZeroTotalPending && String(existing.payment_status || '').trim().toLowerCase() === 'paid') {
    return c.json({
      success: false,
      error: customer ? 'Paid orders cannot be cancelled by customer' : 'Paid order cannot be cancelled; initiate a refund instead',
    }, 409);
  }

  if (await hasIssuedEInvoice(db, id)) {
    return c.json({
      success: false,
      code: 'EINVOICE_ADJUSTMENT_REQUIRED',
      error: 'Order already has an issued e-invoice; issue an adjustment or replacement credit note instead of cancelling',
    }, 409);
  }

  const preCancelStatus = String(existing.status ?? '');

  // All aliases share tenant confinement, role/state validation and compare-and-set.
  const cancelReasonText = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : undefined;
  const transition = await executeKdsStatusTransition(db, id, 'cancelled', user?.role || (isGuestTokenCancel ? 'customer' : undefined), {
    tenantId: customer ? (rawExistingTenant || 'default') : (tenantId === '*' ? (rawExistingTenant || 'default') : tenantId),
    kv: c.env?.AUTH_KV,
    env: c.env as unknown as Record<string, unknown>,
    skipCancelSideEffects: true,
    allowPaidCompensation: canCompensatePaid || isZeroTotalPending,
    actorId: user?.id,
    ...(cancelReasonText ? { fields: { failure_reason: cancelReasonText } } : {}),
  });
  if (!transition.success) return c.json({ success: false, error: transition.error }, (transition.statusCode || 400) as any);

  await runOrderCancellationRollback({
    db,
    env: c.env,
    id,
    existing: existing as unknown as Record<string, unknown>,
    cancelTenant,
    now,
    reason: body.reason || 'order_cancelled',
    preCancelStatus,
    actorId: user?.id || null,
  });

  const actor = user?.id || 'system';
  const auditTenant = cancelTenant === '*' ? 'default' : (cancelTenant || 'default');
  const metaStr = JSON.stringify({ reason: body.reason || 'User cancelled', tenant_id: auditTenant });
  try {
    await db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(`audit_${crypto.randomUUID()}`, actor, 'order_cancel', 'order', id, metaStr, auditTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(actor, actor, actor, 'order_cancel', 'order', id, 'order', id, metaStr, metaStr, auditTenant, now).run();
    } catch {
      try {
        await db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(`audit_${crypto.randomUUID()}`, actor, 'order_cancel', 'order', id, metaStr, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(actor, actor, actor, 'order_cancel', 'order', id, 'order', id, metaStr, metaStr, now).run();
        } catch {
          await db.prepare(`INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .bind(actor, actor, 'order_cancel', 'order', id, metaStr, now).run().catch(() => {});
        }
      }
      await db.prepare(
        "UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = 'order_cancel' AND created_at = ?"
      ).bind(auditTenant, id, id, now).run().catch(() => {});
    }
  }

  let updated = await fetchOrderForRead(db, id, cancelTenant).catch(() => null);
  if (!updated && cancelTenant === 'default') {
    updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first().catch(() => null);
  }
  if (!updated) return c.json({ success: false, error: 'Order not found after cancellation' }, 404);

  const { items: orderItems, payments } = await fetchOrderItemsAndPayments(db, id, cancelTenant);
  return c.json({
    success: true,
    data: customer ? formatCustomerOrder(updated, orderItems) : formatOrder(updated, orderItems, payments),
  });
}