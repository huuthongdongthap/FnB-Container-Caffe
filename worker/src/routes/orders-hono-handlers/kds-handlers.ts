import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import type { Hono, Context } from 'hono';
import { updateOrderStatusSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { audit } from '../../middleware/audit-log';
import { buildOrderTail, publishOrderEvent } from '@aura/domain-order';
import { executeKdsStatusTransition, buildIndexFromDbRows } from '@aura/domain-kitchen';
import { type OrderRecord, type OrderItem, type KdsOrder } from './types';

export async function handleGetKdsOrders(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const stationId = c.req.query('station_id') || c.req.query('station');
  const tenantId = getTenantId(c);

  let categoryIndex: Map<string, { station_id: string; station_name: string | null }> | null = null;
  if (stationId) {
    try {
      const { results: mappings } = await db.prepare(
        'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
      ).all<Record<string, unknown>>();
      categoryIndex = buildIndexFromDbRows(mappings || []);
    } catch {
      // Table unseeded or mock DB
    }
  }

  const tenantClause = tenantId === '*' ? '' : ' AND tenant_id = ?';
  const statement = db.prepare(
    `SELECT * FROM orders WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')${tenantClause}${buildOrderTail({ sort: 'created_at', order: 'ASC', limit: 50 })}`
  );
  const { results } = await (tenantId === '*' ? statement : statement.bind(tenantId)).all<OrderRecord>();

  const kdsOrders: KdsOrder[] = [];
  for (const order of results || []) {
    let items: OrderItem[] = [];
    if (Array.isArray(order.items)) {
      items = order.items;
    } else {
      try {
        const parsed = JSON.parse(order.items);
        if (Array.isArray(parsed)) items = parsed;
      } catch { /* keep empty */ }
    }

    if (stationId && categoryIndex) {
      items = items.filter(item => {
        const catId = (item.category_id || (item as any).categoryId || '') as string;
        const mapping = categoryIndex.get(catId);
        return mapping?.station_id === stationId;
      });
      if (items.length === 0) continue;
    }

    const elapsed = Math.round(
      (Date.now() - new Date(order.created_at).getTime()) / 60000
    );

    kdsOrders.push({
      id: order.id,
      customer_name: order.customer_name,
      table_id: order.table_id,
      items,
      status: order.status,
      elapsed_minutes: elapsed,
      created_at: order.created_at,
    });
  }

  return c.json({ success: true, data: kdsOrders });
}

export async function handleUpdateOrderStatus(c: Context<{ Bindings: Env }>, forcedStatus?: unknown) {
  const db = c.env.AURA_DB;
  const id = c.req.param('id')!;
  const body = typeof forcedStatus === 'string' ? { status: forcedStatus } : await c.req.json().catch(() => null);
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { status } = parsed.data;

  const user = c.get('user' as any) as { role?: string } | undefined;

  let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
  try {
    const ctx = c.executionCtx;
    if (ctx) waitUntilFn = (p) => ctx.waitUntil(p);
  } catch {
    // Context without Cloudflare executionCtx (e.g. test harness)
  }

  const result = await executeKdsStatusTransition(
    db,
    id,
    status,
    user?.role,
    {
      tenantId: getTenantId(c),
      kv: c.env.AUTH_KV,
      env: c.env as unknown as Record<string, unknown>,
      waitUntil: waitUntilFn,
    }
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, (result.statusCode || 400) as any);
  }

  if (result.idempotent) {
    return c.json({ success: true, message: `Order ${id} is already ${status}`, idempotent: true });
  }

  return c.json({ success: true, message: `Order ${id} → ${status}` });
}

export async function handleMarkCodPaid(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ success: false, error: 'Missing order id' }, 400);
  const result = await collectCodPayment(c.env.AURA_DB, id, getTenantId(c));
  if (result.success === false) return c.json({ success: false, error: result.error }, result.statusCode);
  if (!result.idempotent && c.env.AUTH_KV) {
    await publishOrderEvent(c.env.AUTH_KV, id, result.status, { previousStatus: result.status }).catch(() => {});
  }
  if (!result.idempotent) {
    try {
      const orderRow = await c.env.AURA_DB.prepare(
        'SELECT id, total, total_amount, customer_id, customer_phone, customer_email FROM orders WHERE id = ?'
      ).bind(id).first<{
        id: string;
        total?: number | null;
        total_amount?: number | null;
        customer_id?: string | null;
        customer_phone?: string | null;
        customer_email?: string | null;
      }>().catch(() => null);
      if (orderRow && (orderRow.customer_id || orderRow.customer_phone || orderRow.customer_email)) {
        const { creditLoyaltyIfEligible } = await import('@aura/domain-order');
        await creditLoyaltyIfEligible(c.env.AURA_DB, c.env as unknown as Record<string, unknown>, id).catch(() => {});
        let refCustomerId = orderRow.customer_id || null;
        if (!refCustomerId && (orderRow.customer_phone || orderRow.customer_email)) {
          const normalizedPhone = String(orderRow.customer_phone || '').replace(/\D/g, '');
          const cust = await c.env.AURA_DB.prepare(
            'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
          ).bind(orderRow.customer_email ?? null, normalizedPhone || null).first<{ id: string }>().catch(() => null);
          refCustomerId = cust?.id ?? null;
        }
        const orderTotal = Number(orderRow.total ?? orderRow.total_amount ?? 0);
        if (refCustomerId && orderTotal >= 20000) {
          const { rewardReferralOnFirstOrder, resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('@aura/domain-crm');
          const refPolicy = await resolveReferralPolicy(c.env.AUTH_KV).catch(() => DEFAULT_REFERRAL_POLICY);
          await rewardReferralOnFirstOrder(c.env.AURA_DB, refCustomerId, id, orderTotal, refPolicy).catch(() => {});
        }
      }
    } catch {
      // Non-blocking post-payment loyalty/referral trigger
    }
  }
  return c.json({ success: true, message: result.idempotent ? 'Already paid' : 'Marked as paid', order_id: id });
}

/**
 * Every role that may read the kitchen queue or advance an order's status.
 * Single source of truth — the mounts in index.ts and orders-unified.ts, the
 * KDS queue router, and this file all guard with the same set.
 */
export const KDS_ROLES = ['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef'];

export function registerKdsHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/kds', requireAuth(KDS_ROLES), handleGetKdsOrders);
  app.patch('/:id/status', requireAuth(KDS_ROLES), audit('order_status_change'), (c) => handleUpdateOrderStatus(c));
  app.patch('/:id/mark-cod-paid', requireAuth(['owner', 'manager', 'cashier', 'admin']), audit('order_cod_paid'), handleMarkCodPaid);
}
