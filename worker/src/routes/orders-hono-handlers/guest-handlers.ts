import type { Hono } from 'hono';
import { guestCheckinSchema, zodErrorResponse } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import type { Env } from '../../types/env';
import { rateLimitMiddleware, ORDER_RATE_LIMIT } from '../../middleware/rate-limit';
import { makeOrderId } from './types';

export function registerGuestHandlers(app: Hono<{ Bindings: Env }>) {
  // POST /api/orders/guest-checkin — no auth, for QR guests
  // Creates a placeholder order and marks the table Occupied in a single atomic batch.
  // If the INSERT fails, the table stays Available — no orphaned Occupied state.
  app.post('/guest-checkin', rateLimitMiddleware(ORDER_RATE_LIMIT), async(c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = guestCheckinSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const data = parsed.data;

    const tableRow = await db.prepare(
      'SELECT id FROM cafe_tables WHERE table_number = ?'
    ).bind(data.table_id).first<{ id: string }>();
    if (!tableRow) {
      return c.json({ success: false, error: 'Bàn không tồn tại' }, 404);
    }

    const orderId = makeOrderId();
    const now = new Date().toISOString();

    // Atomic batch: seat the guest + create placeholder order together.
    // If either fails, neither state change is persisted.
    const batchResult = await db.batch([
      db.prepare(
        'UPDATE cafe_tables SET status = \'Occupied\', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'Available\''
      ).bind(tableRow.id),
      db.prepare(
        'INSERT INTO orders (id, customer_name, customer_phone, table_id, items, total, status, payment_method, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        orderId, data.customer_name, data.customer_phone, tableRow.id,
        JSON.stringify([]), 0, 'pending', 'cash',
        'Khách QR - cho don mon', now, now
      )
    ]);

    // Verify the UPDATE matched a row (table was Available, not already occupied)
    const updateInfo = batchResult[0] as { success: boolean; changes?: number };
    if (!updateInfo.success || (updateInfo.changes ?? 0) === 0) {
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
        id: orderId, table_id: tableRow.id, table_number: data.table_id,
        customer_name: data.customer_name, customer_phone: data.customer_phone,
        status: 'pending', total: 0, created_at: now
      }
    }, 201);
  });

  // POST /api/orders/guest-checkout — no login (dine-in / takeaway / delivery)
  app.post('/guest-checkout', async (c) => {
    const db = c.env.AURA_DB;
    try {
      const body = await c.req.json<{
        customer_name: string;
        customer_phone: string;
        table_id?: string;
        items: Array<{ name: string; qty: number; price: number; note?: string }>;
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

      await db.prepare(
        `INSERT INTO orders (id, customer_name, customer_phone, table_id, items, total, status, payment_method, fulfillment_type, delivery_address, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId, name, phone, tableId,
        JSON.stringify(body.items),
        total,
        payMethod, fulfillment, body.delivery_address || null,
        fulfillment === 'DINE_IN' ? 'QR guest' : 'Takeaway guest',
        now, now
      ).run();

      return c.json({ success: true, order_id: orderId, total, fulfillment_type: fulfillment }, 201);
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message }, 500);
    }
  });
}