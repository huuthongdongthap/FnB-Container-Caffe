import type { Hono, Context } from 'hono';
import { createOrderInputSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { deductInventoryForOrder } from '@aura/domain-inventory';
import { calculateOrderSnapshot } from '@aura/domain-order';
import { notifyStaffOnNewOrder } from '../../tree/push/triggers';
import { syncOrderToERPNext } from '../../tree/erpnext/sync';
import { makeOrderId, type OrderRecord } from './types';

export async function handlePosCheckout(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const body = (await c.req.json()) as Record<string, unknown>;
  const parsed = createOrderInputSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;

  const id = makeOrderId();
  const now = new Date().toISOString();

  let tableId: string | null = (body.table_id as string) || null;
  if (tableId) {
    const tableRow = await db.prepare(
      'SELECT id FROM cafe_tables WHERE id = ? OR table_number = ?'
    ).bind(tableId, tableId).first<{ id: string }>();
    if (tableRow) {
      tableId = tableRow.id;
    }
  }

  // Canonical server snapshot calculation
  const snapshot = await calculateOrderSnapshot(db as any, {
    items: (data.items || []).map((i: any) => ({
      productId: i.product_id || i.productId || i.id,
      name: i.name,
      quantity: i.quantity || i.qty || 1,
      price: i.price,
      modifiers: i.modifiers,
    })),
    order_type: (body.order_type as 'dine_in' | 'takeaway' | 'delivery') || 'dine_in',
    shipping_fee: Number(body.shipping_fee) || 0,
    discount: Number(body.discount) || 0,
    service_fee: Number(body.service_fee) || 0,
    tip_amount: Number(body.tip_amount) || 0,
  });

  if (snapshot.rejected) {
    return c.json({ success: false, error: snapshot.rejected.message }, 400);
  }

  await db.prepare(
    `INSERT INTO orders (id, customer_name, customer_phone, table_id, items,
     total, status, payment_method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).bind(
    id,
    data.customer_name || 'Walk-in',
    data.customer_phone || '',
    tableId,
    snapshot.itemsJson,
    snapshot.total,
    data.payment_method || 'cash',
    data.notes || '',
    now,
    now
  ).run();

  for (const item of snapshot.items) {
    const lineItemId = makeOrderId('ITEM');
    await db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, quantity, subtotal, modifiers, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      lineItemId, id, item.menuItemId, item.quantity, item.subtotalCents,
      JSON.stringify(item.modifiers || []), now
    ).run();
  }

  if (data.payment_method !== 'payos') {
    const paymentId = makeOrderId('PAY');
    await db.prepare(
      `INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(paymentId, id, data.payment_method || 'cash', snapshot.total, now, now).run();
  }

  // Auto-deduct inventory (non-blocking)
  try {
    const items = snapshot.items.map(i => ({ product_id: i.menuItemId, quantity: i.quantity, name: i.name }));
    if (items.length > 0) {
      c.executionCtx?.waitUntil(deductInventoryForOrder(c.env as Env, id, items));
    }
  } catch { /* inventory deduction best-effort */ }

  // ERPNext sync (fire-and-forget, non-blocking)
  if (syncOrderToERPNext && c.env.ERPNEXT_SYNC_ENABLED === 'true') {
    try {
      c.executionCtx?.waitUntil(
        Promise.resolve(syncOrderToERPNext(
          {
            ERPNEXT_URL: c.env.ERPNEXT_URL!,
            ERPNEXT_API_KEY: c.env.ERPNEXT_API_KEY!,
            ERPNEXT_API_SECRET: c.env.ERPNEXT_API_SECRET!
          },
          id,
          {
            customer_name: data.customer_name || 'Walk-in',
            customer_phone: data.customer_phone,
            customer_id: undefined,
            table_id: tableId,
            items: snapshot.items as unknown as Array<Record<string, unknown>>,
            total: snapshot.total,
            payment_method: data.payment_method,
            notes: data.notes
          }
        ))
      );
    } catch { /* ERPNext sync best-effort */ }
  }

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();

  // Record order creation metric
  const mc = createMetricsCollector(db);
  try {
    c.executionCtx?.waitUntil(mc.recordMetric('order_created', snapshot.total, {
      payment_method: order?.payment_method || 'unknown'
    }));
  } catch { /* executionCtx unavailable */ }

  // Notify staff of new order (non-blocking)
  try {
    c.executionCtx?.waitUntil(
      notifyStaffOnNewOrder(c.env as Env, {
        id,
        table_id: tableId,
        items: snapshot.items as unknown as Array<Record<string, unknown>>,
        total: snapshot.total
      })
    );
  } catch { /* push best-effort */ }

  return c.json({ success: true, data: order }, 201);
}

export function registerCheckoutHandlers(app: Hono<{ Bindings: Env }>) {
  app.post('/checkout', requireAuth(['owner', 'staff']), audit('order_create_checkout'), handlePosCheckout);
}
