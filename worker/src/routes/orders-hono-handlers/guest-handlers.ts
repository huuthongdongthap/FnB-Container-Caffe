import type { Hono, Context } from 'hono';
import { guestCheckinSchema, zodErrorResponse } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import type { Env } from '../../types/env';
import { rateLimitMiddleware, ORDER_RATE_LIMIT } from '../../middleware/rate-limit';
import { makeOrderId } from './types';

export async function handleGuestCheckin(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const body = (await c.req.json()) as Record<string, unknown>;
  const parsed = guestCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;

  let tableRow = await db.prepare(
    'SELECT id, table_number FROM cafe_tables WHERE table_number = ?'
  ).bind(data.table_id).first<{ id: string; table_number?: string | number }>();
  if (!tableRow) {
    tableRow = await db.prepare(
      'SELECT id, table_number FROM cafe_tables WHERE id = ?'
    ).bind(data.table_id).first<{ id: string; table_number?: string | number }>();
  }
  if (!tableRow) {
    return c.json({ success: false, error: 'Bàn không tồn tại' }, 404);
  }

  const orderId = makeOrderId();
  const now = new Date().toISOString();

  // Atomic batch: seat the guest + create placeholder order together.
  const batchResult = await db.batch([
    db.prepare(
      'UPDATE cafe_tables SET status = \'Occupied\', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'Available\''
    ).bind(tableRow.id),
    db.prepare(
      `INSERT INTO orders (id, customer_name, customer_phone, table_id, items, total, status, payment_method, notes, order_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'cash', ?, 'dine_in', ?, ?)`
    ).bind(
      orderId, data.customer_name, data.customer_phone, tableRow.id,
      JSON.stringify([]), 0,
      'Khách QR - cho don mon', now, now
    )
  ]);

  const updateInfo = batchResult[0] as { success: boolean; changes?: number; meta?: { changes?: number } };
  const changes = updateInfo.meta?.changes ?? updateInfo.changes ?? 0;
  if (!updateInfo.success || changes === 0) {
    return c.json({ success: false, error: 'Bàn đang được sử dụng, vui lòng chọn bàn khác' }, 409);
  }

  try {
    const { sendPushToStaff: notifyStaff } = await import('../../tree/push/notifier.js');
    const pushPromise = notifyStaff(c.env as Env, {
      title: 'Khách check-in 🪑',
      body: `Ban ${data.table_id} - ${data.customer_name} / ${data.customer_phone}`,
      data: { url: '/kds', orderId }
    }, 'staff-kitchen').catch(() => {});
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
  const db = c.env.AURA_DB;
  try {
    const body = await c.req.json<{
      customer_name: string;
      customer_phone: string;
      table_id?: string;
      items: Array<{ name: string; qty: number; price: number; note?: string; product_id?: string }>;
      fulfillment_type?: string;
      delivery_address?: string;
      payment_method?: string;
    }>();

    const name = (body.customer_name || '').trim();
    const phone = (body.customer_phone || '').trim();
    if (!name || !phone) {
      return c.json({ success: false, error: 'Name and phone required' }, 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return c.json({ success: false, error: 'Items required' }, 400);
    }

    const fulfillment = (body.fulfillment_type || 'DINE_IN').toUpperCase();
    if (!['DINE_IN', 'TAKEAWAY', 'DELIVERY'].includes(fulfillment)) {
      return c.json({ success: false, error: 'Invalid fulfillment_type' }, 400);
    }
    if (fulfillment === 'DELIVERY' && !(body.delivery_address || '').trim()) {
      return c.json({ success: false, error: 'Delivery address required' }, 400);
    }

    const tableId = body.table_id || null;
    const orderId = makeOrderId();
    const now = new Date().toISOString();
    const payMethod = (body.payment_method || 'cash').toLowerCase();

    // If dine-in with table_id, mark table Occupied
    if (tableId && fulfillment === 'DINE_IN') {
      await db.prepare(
        'UPDATE cafe_tables SET status = \'Occupied\', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'Available\''
      ).bind(tableId).run();
    }

    const total = body.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);

    // Canonical D1 orders persistence with exact schema columns
    await db.prepare(
      `INSERT INTO orders (id, customer_name, customer_phone, table_id, items, total, status, payment_method, order_type, customer_address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId, name, phone, tableId,
      JSON.stringify(body.items),
      total,
      payMethod, fulfillment.toLowerCase(), body.delivery_address || null,
      fulfillment === 'DINE_IN' ? 'QR guest' : 'Takeaway guest',
      now, now
    ).run();

    // Line item persistence to order_items
    for (const item of body.items) {
      const lineItemId = makeOrderId('ITEM');
      const prodId = item.product_id || item.name;
      const subtotal = (item.price || 0) * (item.qty || 1);
      await db.prepare(
        `INSERT INTO order_items (id, order_id, product_id, quantity, subtotal, modifiers, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(lineItemId, orderId, prodId, item.qty || 1, subtotal, '[]', now).run();
    }

    return c.json({ success: true, order_id: orderId, total, fulfillment_type: fulfillment }, 201);
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
}

export function registerGuestHandlers(app: Hono<{ Bindings: Env }>) {
  app.post('/guest-checkin', rateLimitMiddleware(ORDER_RATE_LIMIT), handleGuestCheckin);
  app.post('/guest-checkout', handleGuestCheckout);
}
