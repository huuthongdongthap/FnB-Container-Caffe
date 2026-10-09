import type { Hono, Context } from 'hono';
import { updateOrderStatusSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { buildOrderTail, isTerminal, publishOrderEvent } from '@aura/domain-order';
import { executeKdsStatusTransition, buildIndexFromDbRows } from '@aura/domain-kitchen';
import { ALLOWED_KDS_STATUSES, type OrderRecord, type OrderItem, type KdsOrder } from './types';

export async function handleGetKdsOrders(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const raw = c.req.query('status') || 'pending';
  const status = ALLOWED_KDS_STATUSES.includes(raw as typeof ALLOWED_KDS_STATUSES[number]) ? raw : 'pending';
  const stationId = c.req.query('station_id') || c.req.query('station');

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

  const { results } = await db.prepare(
    `SELECT * FROM orders WHERE status IN (?, 'preparing')${buildOrderTail({ sort: 'created_at', order: 'ASC', limit: 50 })}`
  ).bind(status).all<OrderRecord>();

  const kdsOrders: KdsOrder[] = [];
  for (const order of results || []) {
    let items: OrderItem[] = [];
    try {
      items = JSON.parse(order.items);
    } catch { /* keep empty */ }

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

export async function handleUpdateOrderStatus(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
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
      kv: c.env.AUTH_KV,
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
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  if (!id) return c.json({ success: false, error: 'Missing order id' }, 400);

  const order = await db.prepare(
    'SELECT total, status, payment_status, is_cod FROM orders WHERE id = ?'
  ).bind(id).first<{ total: number; status: string; payment_status: string; is_cod: number }>();

  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
  if (order.status === 'cancelled') return c.json({ success: false, error: 'Cannot mark cancelled order as paid' }, 409);
  if (isTerminal(order.status) && order.status !== 'completed') {
    return c.json({ success: false, error: `Cannot mark ${order.status} order as paid` }, 409);
  }
  if ((order.is_cod ?? 0) !== 1 && order.payment_status !== 'cod_pending') {
    return c.json({ success: false, error: 'Not a COD order' }, 409);
  }
  if (order.payment_status === 'paid') {
    return c.json({ success: true, message: 'Already paid', order_id: id });
  }

  const now = new Date().toISOString();
  await db.prepare(
    'UPDATE orders SET status = \'completed\', payment_status = \'paid\', cod_paid_at = ?, updated_at = ? WHERE id = ?'
  ).bind(now, now, id).run();
  await db.prepare(
    'UPDATE payments SET status = \'completed\', updated_at = ? WHERE order_id = ? AND method = \'cod\''
  ).bind(now, id).run();

  if (c.env?.AUTH_KV) {
    let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
    try {
      if (c.executionCtx) waitUntilFn = (p) => c.executionCtx.waitUntil(p);
    } catch { /* executionCtx may be absent in testing */ }
    await publishOrderEvent(c.env.AUTH_KV, id, 'completed', {
      previousStatus: order.status,
      waitUntil: waitUntilFn,
    });
  }
  return c.json({ success: true, message: 'Marked as paid', order_id: id });
}

export function registerKdsHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/kds', requireAuth(['owner', 'staff']), handleGetKdsOrders);
  app.patch('/:id/status', requireAuth(['owner', 'staff']), audit('order_status_change'), handleUpdateOrderStatus);
  app.patch('/:id/mark-cod-paid', requireAuth(['owner']), audit('order_cod_paid'), handleMarkCodPaid);
}
