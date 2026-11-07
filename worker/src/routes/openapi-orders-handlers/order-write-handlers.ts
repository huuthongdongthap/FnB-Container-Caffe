import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { OrderRoutes } from '../../schemas/orders';
import { formatCustomerOrder, formatOrder, fetchOrderItemsAndPayments, resolveOpenApiOrdersTenant } from './helpers';
import { canTransition, isTerminal, canActorTransition, toActorRole, publishOrderEvent } from '@aura/domain-order';
import { executeKdsStatusTransition } from '@aura/domain-kitchen';
import { canAccessOrder } from '@aura/domain-customer';
import { createOrderFromAlias } from '../../../../packages/domain/order/commands/create-order-alias';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { handleCancelOrder, runOrderCancellationRollback, resolveCustomerOwnerIdsForMutation } from './order-cancel-handlers';
import { fetchOrderForRead } from './order-read-handlers';

export { handleCancelOrder };

const ORDER_STAFF_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'cashier', 'waiter', 'staff'];

function matchesOrderTenant(row: Record<string, unknown>, tenantId: string): boolean {
  return matchesTenantRow(row, tenantId);
}

export async function handleOpenApiCreateOrder(c: Context<{ Bindings: Env }>) {
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json());
  let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
  try { ctx = c.executionCtx; } catch { /* Unit callers may omit execution context. */ }
  const response = await createOrderFromAlias(c.req.raw, c.env, {
    items: body.items,
    total: body.total ?? body.totalAmount ?? 1000,
    customer_name: body.customer?.name || 'Khách tại quán',
    customer_phone: body.customer?.phone || '0000000000',
    customer_email: body.customer?.email || '',
    customer_address: body.customer?.address || '',
    customer_id: body.customer?.id,
    payment_method: body.paymentMethod || 'cod',
    table_id: body.tableId,
    order_type: body.channel || (body.tableId ? 'dine_in' : 'takeaway'),
    notes: body.notes,
  }, ctx, c.get('user'));
  if (!response.ok) return response;
  const accepted = await response.json() as { data: Record<string, any> & { id: string } };
  const db = getDatabase(c);
  let created: any = accepted.data;
  let details: { items: any[]; payments: any[] } = { items: [], payments: [] };
  try {
    created = await db.prepare(`SELECT o.*, COALESCE(t.table_number, t.id) as table_name
      FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') WHERE o.id = ?`)
      .bind(accepted.data.id).first().catch(() =>
        db.prepare(`SELECT o.*, COALESCE(t.table_number, t.id) as table_name
          FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE o.id = ?`)
          .bind(accepted.data.id).first()
      ) || accepted.data;
    const rawCreatedTenant =
      typeof created?.tenant_id === 'string' && created.tenant_id.trim() && created.tenant_id.trim() !== '*' && created.tenant_id.trim().toLowerCase() !== 'hq'
        ? created.tenant_id.trim()
        : (typeof accepted.data?.tenant_id === 'string' && accepted.data.tenant_id.trim() && accepted.data.tenant_id.trim() !== '*' && accepted.data.tenant_id.trim().toLowerCase() !== 'hq'
            ? accepted.data.tenant_id.trim()
            : undefined);
    details = await fetchOrderItemsAndPayments(db, accepted.data.id, rawCreatedTenant);
  } catch { /* An optional read projection must not turn a committed order into a retryable failure. */ }
  return c.json({ success: true, data: formatOrder(created, details.items, details.payments) }, response.status as 200 | 201,
    response.headers.get('X-Cache') ? { 'X-Cache': 'HIT' } : undefined);
}

export async function handleOpenApiUpdateOrder(c: Context<{ Bindings: Env }>) {
  const tenantCheck = resolveOpenApiOrdersTenant(c, 'write');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const body = ((c.req as any).valid ? (c.req as any).valid('json') : null) || (await c.req.json());
  const user = c.get('user');
  const now = new Date().toISOString();

  const rawTenantId = (tenantCheck.tenantId || 'default').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const existing = (await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()) as {
    id: string; status: string; payment_status?: string | null; customer_id?: string | null; tenant_id?: string | null;
  } | null;
  if (!existing || !matchesOrderTenant(existing as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  const rawExistingTenant =
    existing.tenant_id &&
    String(existing.tenant_id).trim() &&
    String(existing.tenant_id).trim() !== '*' &&
    String(existing.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(existing.tenant_id).trim()
      : undefined;
  const effectiveOrderTenant = tenantId === '*' ? (rawExistingTenant || 'default') : (rawExistingTenant || tenantId || 'default');
  let effectiveUser = user as Record<string, any> | undefined;
  let customerOwnerIds: string[] = [];
  if (effectiveUser?.role === 'customer') {
    customerOwnerIds = await resolveCustomerOwnerIdsForMutation(db, effectiveUser, effectiveOrderTenant);
    const ordCustId = existing.customer_id ? String(existing.customer_id).trim() : '';
    if (ordCustId && customerOwnerIds.includes(ordCustId)) {
      effectiveUser = { ...effectiveUser, id: ordCustId };
    }
  }
  const access = canAccessOrder(effectiveUser as any, existing);
  if (!access.allowed) {
    return c.json({ success: false, error: access.reason || 'Forbidden' }, 403);
  }
  if (user?.role === 'customer') {
    const ordCustId = existing.customer_id ? String(existing.customer_id).trim() : '';
    if (!ordCustId || !customerOwnerIds.includes(ordCustId)) {
      return c.json({ success: false, error: 'Unauthorized to mutate unclaimed or foreign customer order' }, 403);
    }
  }
  if (isTerminal(existing.status)) {
    return c.json({ success: false, error: `Cannot transition terminal order (${existing.status})` }, 400);
  }
  if (user?.role === 'customer') {
    const forbiddenCustomerFields = [
      'confirmed_at', 'confirmedAt', 'preparing_at', 'preparingAt',
      'ready_at', 'readyAt', 'completed_at', 'completedAt',
      'served_at', 'servedAt', 'cancelled_at', 'cancelledAt',
      'payment_status', 'paymentStatus', 'payment_method', 'paymentMethod',
      'assigned_staff_id', 'assignedStaffId', 'notes', 'customer',
      'customer_name', 'customerName', 'customer_phone', 'customerPhone',
      'customer_email', 'customerEmail',
    ];
    const hasNonStatusField = Object.keys(body || {}).some((k) => k !== 'status' && body[k] !== undefined);
    if (
      body.status !== 'cancelled' ||
      !['pending', 'confirmed'].includes(existing.status) ||
      forbiddenCustomerFields.some((k) => body[k] !== undefined) ||
      hasNonStatusField
    ) {
      return c.json({ success: false, error: 'Customers may only cancel pending or confirmed orders' }, 403);
    }
    if (body.status === 'cancelled' && String(existing.payment_status || '').trim().toLowerCase() === 'paid') {
      return c.json({ success: false, error: 'Paid orders cannot be cancelled by customer' }, 409);
    }
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  const canonicalUpdates: string[] = [];
  const canonicalParams: (string | number | null)[] = [];
  let statusHandledByKds = false;

  const notes = body.notes;
  const delivery_time = body.delivery_time ?? body.deliveryTime;
  const customer_name = body.customer_name ?? body.customerName ?? body.customer?.name;
  const customer_phone = body.customer_phone ?? body.customerPhone ?? body.customer?.phone;
  const customer_email = body.customer_email ?? body.customerEmail ?? body.customer?.email;
  const hasFieldMutation =
    notes !== undefined ||
    delivery_time !== undefined ||
    customer_name !== undefined ||
    customer_phone !== undefined ||
    customer_email !== undefined ||
    body.customer !== undefined;

  if (hasFieldMutation) {
    if (isTerminal(existing.status)) {
      return c.json({ success: false, error: `Cannot transition terminal order (${existing.status})` }, 400);
    }
    if (!Boolean(user?.role && ORDER_STAFF_ROLES.includes(user.role))) {
      return c.json({ success: false, error: 'Insufficient permissions to update order fields' }, 403);
    }
  }

  if (body.status !== undefined) {
    if (existing.status !== body.status) {
      const structural = canTransition(existing.status, body.status);
      if (!structural.ok) return c.json({ success: false, error: structural.error }, 400);
      const authCheck = canActorTransition(toActorRole(user?.role), existing.status, body.status);
      if (!authCheck.ok) return c.json({ success: false, error: authCheck.error }, 403);

      if (body.status === 'cancelled') {
        const transition = await executeKdsStatusTransition(db, id, 'cancelled', user?.role, {
          tenantId: user?.role === 'customer' ? (rawExistingTenant || 'default') : (tenantId === '*' ? (rawExistingTenant || 'default') : tenantId),
          kv: c.env?.AUTH_KV,
          env: c.env as unknown as Record<string, unknown>,
          skipCancelSideEffects: true,
        });
        if (!transition.success) {
          return c.json({ success: false, error: transition.error }, (transition.statusCode || 400) as any);
        }
        statusHandledByKds = true;
        await runOrderCancellationRollback({
          db,
          env: c.env,
          id,
          existing: existing as unknown as Record<string, unknown>,
          cancelTenant: effectiveOrderTenant,
          now,
          reason: body.reason || body.notes || 'order_cancelled',
        });
      } else {
        const transition = await executeKdsStatusTransition(db, id, body.status, user?.role, {
          tenantId: effectiveOrderTenant,
          kv: c.env?.AUTH_KV,
          env: c.env as unknown as Record<string, unknown>,
        });
        if (!transition.success) {
          return c.json({ success: false, error: transition.error }, (transition.statusCode || 400) as any);
        }
        statusHandledByKds = true;
      }
      if (body.status === 'cancelled') {
        try {
          await db
            .prepare("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(id, effectiveOrderTenant)
            .run()
            .catch(() => {
              if (effectiveOrderTenant === 'default') {
                return db
                  .prepare("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'")
                  .bind(id)
                  .run();
              }
            });
        } catch {
          // Optional payments table in minimal test schemas
        }
      }
      if (body.status === 'completed' && !statusHandledByKds) {
        try {
          const { creditLoyaltyIfEligible } = await import('../../../../packages/domain/order/policies/loyalty-trigger');
          await creditLoyaltyIfEligible(db, c.env as unknown as Record<string, unknown>, id).catch(() => {});
          const { rewardReferralOnFirstOrder, resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('@aura/domain-crm');
          const custPhone = (existing as Record<string, unknown>).customer_phone as string | undefined;
          let resolvedCustId = existing.customer_id || null;
          if (!resolvedCustId && custPhone) {
            const custRow = await db.prepare(
              "SELECT id FROM customers WHERE phone = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
            ).bind(custPhone, effectiveOrderTenant).first<{ id?: string }>().catch(() => null);
            resolvedCustId = custRow?.id || null;
          }
          if (resolvedCustId) {
            const totalVnd = Number((existing as Record<string, unknown>).total ?? (existing as Record<string, unknown>).total_amount ?? 0);
            const refPolicy = await resolveReferralPolicy(c.env?.AUTH_KV, effectiveOrderTenant).catch(() => DEFAULT_REFERRAL_POLICY);
            await rewardReferralOnFirstOrder(db, resolvedCustId, id, totalVnd, refPolicy, effectiveOrderTenant).catch(() => {});
          }
        } catch { /* Non-blocking loyalty/referral trigger on completion */ }
      }
    }

    if (!statusHandledByKds) {
      updates.push('status = ?'); params.push(body.status);
      canonicalUpdates.push('status = ?'); canonicalParams.push(body.status);
    }
    if (body.status === 'served') { updates.push('served_at = ?'); params.push(now); }
    else if (body.status === 'completed') { updates.push('completed_at = ?'); params.push(now); }
    else if (body.status === 'cancelled') { updates.push('cancelled_at = ?'); params.push(now); }
  }
  if (Boolean(user?.role && ORDER_STAFF_ROLES.includes(user.role))) {
    if (notes !== undefined) {
      updates.push('notes = ?'); params.push(notes);
      canonicalUpdates.push('notes = ?'); canonicalParams.push(notes);
    }
    if (delivery_time !== undefined) {
      updates.push('delivery_time = ?'); params.push(delivery_time);
    }
    if (customer_name !== undefined) {
      updates.push('customer_name = ?'); params.push(customer_name);
      canonicalUpdates.push('customer_name = ?'); canonicalParams.push(customer_name);
    }
    if (customer_phone !== undefined) {
      updates.push('customer_phone = ?'); params.push(customer_phone);
      canonicalUpdates.push('customer_phone = ?'); canonicalParams.push(customer_phone);
    }
    if (customer_email !== undefined) {
      updates.push('customer_email = ?'); params.push(customer_email);
    }
  }

  updates.push('updated_at = ?'); params.push(now, id);
  canonicalUpdates.push('updated_at = ?'); canonicalParams.push(now, id);

  if (updates.length > 1) {
    try {
      await db
        .prepare(
          `UPDATE orders SET ${updates.join(', ')} WHERE id = ? AND (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR TRIM(tenant_id) = '')))`
        )
        .bind(...params, effectiveOrderTenant, effectiveOrderTenant)
        .run();
    } catch (err) {
      const isMissingTenantCol = /no such column:\s*tenant_id/i.test(String(err));
      if (!isMissingTenantCol) {
        if (canonicalUpdates.length > 1) {
          try {
            await db
              .prepare(
                `UPDATE orders SET ${canonicalUpdates.join(', ')} WHERE id = ? AND (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR TRIM(tenant_id) = '')))`
              )
              .bind(...canonicalParams, effectiveOrderTenant, effectiveOrderTenant)
              .run();
          } catch (innerErr) {
            if (/no such column:\s*tenant_id/i.test(String(innerErr)) && effectiveOrderTenant === 'default') {
              await db.prepare(`UPDATE orders SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run();
            } else {
              throw innerErr;
            }
          }
        }
      } else if (effectiveOrderTenant === 'default') {
        try {
          await db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        } catch {
          if (canonicalUpdates.length > 1) {
            await db.prepare(`UPDATE orders SET ${canonicalUpdates.join(', ')} WHERE id = ?`).bind(...canonicalParams).run();
          }
        }
      } else {
        throw err;
      }
    }
  }
  if ((statusHandledByKds || updates.length > 1) && c.env?.AUTH_KV) {
    let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
    try { if (c.executionCtx) waitUntilFn = (p) => c.executionCtx.waitUntil(p); } catch { /* absent in tests */ }
    await publishOrderEvent(c.env.AUTH_KV, id, body.status ?? existing.status, {
      previousStatus: existing.status,
      waitUntil: waitUntilFn,
      tenantId: effectiveOrderTenant,
    } as any);
  }

  const actorId = user?.id || 'system';
  const auditTenant = effectiveOrderTenant === '*' ? 'default' : (effectiveOrderTenant || 'default');
  const metaStr = JSON.stringify({ ...body, tenant_id: auditTenant });
  try {
    await db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(`audit_${crypto.randomUUID()}`, actorId, 'order_update', 'order', id, metaStr, auditTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(actorId, actorId, actorId, 'order_update', 'order', id, 'order', id, metaStr, metaStr, auditTenant, now).run();
    } catch {
      try {
        await db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(`audit_${crypto.randomUUID()}`, actorId, 'order_update', 'order', id, metaStr, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(actorId, actorId, actorId, 'order_update', 'order', id, 'order', id, metaStr, metaStr, now).run();
        } catch {
          await db.prepare(`INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .bind(actorId, actorId, 'order_update', 'order', id, metaStr, now).run().catch(() => {});
        }
      }
      await db.prepare(
        "UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = 'order_update' AND created_at = ?"
      ).bind(auditTenant, id, id, now).run().catch(() => {});
    }
  }

  let updated: Record<string, any> | null = await fetchOrderForRead(db, id, effectiveOrderTenant).catch(() => null);
  if (!updated && effectiveOrderTenant === 'default') {
    updated = (await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first().catch(() => null)) || existing;
  }
  if (!updated) {
    updated = existing;
  }

  const { items, payments } = await fetchOrderItemsAndPayments(db, id, effectiveOrderTenant);
  const isStaffActor = Boolean(user?.role && [...ORDER_STAFF_ROLES, 'kitchen'].includes(user.role));
  const projected = isStaffActor
    ? formatOrder(updated!, items, payments)
    : formatCustomerOrder(updated!, items);
  return c.json({ success: true, data: projected });
}

export function registerOrderWriteHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(OrderRoutes.create as any, handleOpenApiCreateOrder as any);
  app.openapi(OrderRoutes.update as any, handleOpenApiUpdateOrder as any);
  app.openapi(OrderRoutes.cancel as any, handleCancelOrder as any);
}
