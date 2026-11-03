import type { Hono, Context } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
import { guestCheckinSchema, zodErrorResponse } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import type { Env } from '../../types/env';
import { rateLimitMiddleware, ORDER_RATE_LIMIT } from '../../middleware/rate-limit';
import { createLogger } from '../../middleware/logger';
import { makeOrderId } from './types';
import { createOrderFromAlias } from '../../../../packages/domain/order/commands/create-order-alias';
import { resolveOrderCreationScope, resolveOrderCreationTable, OrderCreationError } from '../../../../packages/domain/order/policies/order-creation-scope';

const log = createLogger({ route: 'guest-orders' });

export async function handleGuestCheckin(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const body = (await c.req.json()) as Record<string, unknown>;
  const parsed = guestCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;

  let tenantId: string;
  let tableRow: { id: string; table_number?: string | number };
  try {
    const scope = await resolveOrderCreationScope(c.req.raw, c.env);
    tenantId = scope.tenantId;
    const id = await resolveOrderCreationTable(db, data.table_id, tenantId);
    if (!id) return c.json({ success: false, error: 'Bàn không tồn tại' }, 404);
    tableRow = { id, table_number: data.table_id };
  } catch (error) {
    if (error instanceof OrderCreationError) return c.json({ success: false, error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status === 400 ? 404 : error.status);
    throw error;
  }

  const orderId = makeOrderId();
  const now = new Date().toISOString();

  // Claim table atomically via CAS before inserting the guest check-in order.
  const normalizedTenant = (tenantId || '').trim() || 'default';
  const tblTenantClause = normalizedTenant === 'default'
    ? "AND (tenant_id = ?2 OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
    : 'AND (tenant_id = ?2 OR TRIM(tenant_id) = ?2)';
  let tableClaimStmt = db.prepare(
    `UPDATE cafe_tables SET status = 'Occupied', current_order_id = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 ${tblTenantClause} AND status = 'Available'`
  ).bind(tableRow.id, normalizedTenant, orderId);
  let tableUpdateResult: { success?: boolean; changes?: number; meta?: { changes?: number } };
  try {
    tableUpdateResult = (await tableClaimStmt.run()) as { success?: boolean; changes?: number; meta?: { changes?: number } };
  } catch {
    try {
      tableClaimStmt = db.prepare(
        `UPDATE cafe_tables SET status = 'Occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?1 ${tblTenantClause} AND status = 'Available'`
      ).bind(tableRow.id, normalizedTenant);
      tableUpdateResult = (await tableClaimStmt.run()) as { success?: boolean; changes?: number; meta?: { changes?: number } };
    } catch {
      tableClaimStmt = db.prepare(
        `UPDATE cafe_tables SET status = 'Occupied' WHERE id = ?1 ${tblTenantClause} AND status = 'Available'`
      ).bind(tableRow.id, normalizedTenant);
      tableUpdateResult = (await tableClaimStmt.run()) as { success?: boolean; changes?: number; meta?: { changes?: number } };
    }
  }

  const changes = tableUpdateResult.meta?.changes ?? tableUpdateResult.changes ?? 0;
  if (tableUpdateResult.success === false || changes === 0) {
    return c.json({ success: false, error: 'Bàn đang được sử dụng, vui lòng chọn bàn khác' }, 409);
  }

  const orderInsertStmt = db.prepare(
    `INSERT INTO orders (id, customer_name, customer_phone, table_id, items, total, status, payment_method, notes, order_type, tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 'cod', ?, 'dine_in', ?, ?, ?)`
  ).bind(
    orderId, data.customer_name, data.customer_phone, tableRow.id,
    JSON.stringify([]), 0,
    'Khách QR - cho don mon', normalizedTenant, now, now
  );
  try {
    if ('idx' in (orderInsertStmt as unknown as Record<string, unknown>) && typeof db.batch === 'function') {
      const claimedTableStmt = Object.assign(
        Object.create(Object.getPrototypeOf(tableClaimStmt)),
        tableClaimStmt,
        { run: async () => tableUpdateResult }
      );
      await db.batch([claimedTableStmt, orderInsertStmt]);
    } else {
      await orderInsertStmt.run();
    }
  } catch (insertError) {
    try {
      await db
        .prepare(
          `UPDATE cafe_tables SET status = 'Available', current_order_id = NULL WHERE id = ?1 ${tblTenantClause} AND (current_order_id = ?3 OR current_order_id IS NULL)`
        )
        .bind(tableRow.id, normalizedTenant, orderId)
        .run();
    } catch {
      await db
        .prepare(`UPDATE cafe_tables SET status = 'Available' WHERE id = ?1 ${tblTenantClause}`)
        .bind(tableRow.id, normalizedTenant)
        .run()
        .catch(() => {});
    }
    throw insertError;
  }

  if (c.env?.AUTH_KV) {
    await Promise.all([
      c.env.AUTH_KV.put('latest_order_ts', String(Date.now())).catch(() => {}),
      c.env.AUTH_KV.put('orders:latest_updated_at', now).catch(() => {}),
      publishOrderEvent(c.env.AUTH_KV, orderId, 'pending'),
    ]);
  }

  try {
    const { sendPushToStaff: notifyStaff } = await import('../../tree/push/notifier.js');
    const { STAFF_PUSH_ROLE } = await import('../../tree/push/roles.js');
    const pushPromise = notifyStaff(c.env as Env, {
      title: 'Khách check-in 🪑',
      body: `Ban ${data.table_id} - ${data.customer_name} / ${data.customer_phone}`,
      data: { url: '/kds', orderId, tenantId: normalizedTenant }
    }, STAFF_PUSH_ROLE, undefined, normalizedTenant).catch(() => {});
    c.executionCtx?.waitUntil(pushPromise);
  } catch { /* push best-effort */ }

  try {
    const mc = createMetricsCollector(db);
    c.executionCtx?.waitUntil(mc.recordMetric('guest_checkin', 0, { table: data.table_id }));
  } catch { /* metrics best-effort */ }

  return c.json({
    success: true,
    data: {
      id: orderId, table_id: tableRow.id, table_number: String(tableRow.table_number ?? data.table_id),
      customer_name: data.customer_name, customer_phone: data.customer_phone,
      status: 'pending', total: 0, created_at: now
    }
  }, 201);
}

export async function handleGuestCheckout(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const fulfillment = String(body.fulfillment_type || 'DINE_IN').toUpperCase();
    if (!['DINE_IN', 'TAKEAWAY', 'DELIVERY'].includes(fulfillment)) {
      return c.json({ success: false, error: 'Invalid fulfillment_type' }, 400);
    }
    let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
    try { ctx = c.executionCtx; } catch { /* unit tests have no execution context */ }
    const response = await createOrderFromAlias(c.req.raw, c.env, {
      ...body,
      payment_method: String(body.payment_method || 'cod').toLowerCase(),
      order_type: fulfillment.toLowerCase(),
      customer_address: body.delivery_address || body.customer_address,
      notes: body.notes || (fulfillment === 'DINE_IN' ? 'QR guest' : 'Takeaway guest'),
    }, ctx);
    if (!response.ok) return response;
    const result = await response.json() as { data: { id: string; total: number; payment_method: string } };
    return c.json({ success: true, order_id: result.data.id, total: result.data.total,
      fulfillment_type: fulfillment, payment_method: result.data.payment_method }, response.status as 200 | 201,
    response.headers.get('X-Cache') ? { 'X-Cache': 'HIT' } : undefined);
  } catch (err) {
    log.error('Guest checkout error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Failed to create guest order' }, 500);
  }
}

export function registerGuestHandlers(app: Hono<{ Bindings: Env }>) {
  app.post('/guest-checkin', rateLimitMiddleware(ORDER_RATE_LIMIT), handleGuestCheckin);
  app.post('/guest-checkout', rateLimitMiddleware(ORDER_RATE_LIMIT), handleGuestCheckout);
}
