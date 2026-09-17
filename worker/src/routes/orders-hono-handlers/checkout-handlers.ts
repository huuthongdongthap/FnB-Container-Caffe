import type { Hono } from 'hono';
import { createOrderInputSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { deductInventoryForOrder } from '@aura/domain-inventory';
import { notifyStaffOnNewOrder } from '../../tree/push/triggers';
import { syncOrderToERPNext } from '../../tree/erpnext/sync';
import { makeOrderId, type OrderRecord } from './types';

export function registerCheckoutHandlers(app: Hono<{ Bindings: Env }>) {
  // POST /api/orders/checkout — create order (used by KDS/POS, staff-only)
  app.post('/checkout', requireAuth(['owner', 'staff']), audit('order_create_checkout'), async(c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = createOrderInputSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const data = parsed.data;

    const id = makeOrderId();
    const now = new Date().toISOString();

    await db.prepare(
      `INSERT INTO orders (id, customer_name, customer_phone, table_id, items,
       total, status, payment_method, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    ).bind(
      id,
      data.customer_name || 'Walk-in',
      data.customer_phone || '',
      body.table_id || null,
      JSON.stringify(data.items),
      parseInt(String(body.total || 0)),
      data.payment_method || 'cash',
      data.notes || '',
      now,
      now
    ).run();

    // Auto-deduct inventory (non-blocking — fires in background)
    try {
      const items: Array<{ product_id: string; quantity: number; name?: string }> =
      Array.isArray(data.items) ? data.items : [];
      if (items.length > 0) {
        c.executionCtx?.waitUntil(deductInventoryForOrder(c.env as Env, id, items));
      }
    } catch { /* inventory deduction best-effort */ }

    // ERPNext sync (fire-and-forget, non-blocking — delegated to syncOrderToERPNext)
    if (syncOrderToERPNext) {
      try {
        if (c.env.ERPNEXT_SYNC_ENABLED === 'true') {
          c.executionCtx?.waitUntil(
            Promise.resolve(
              syncOrderToERPNext(
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
                  table_id: (body.table_id as string) || null,
                  items: (data.items as Array<Record<string, unknown>>) || [],
                  total: parseInt(String(body.total || 0)),
                  payment_method: data.payment_method,
                  notes: data.notes
                }
              )
            )
          );
        }
      } catch { /* ERPNext sync best-effort */ }
    }

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();

    // Record order creation metric
    const mc = createMetricsCollector(db);
    try {
      c.executionCtx?.waitUntil(mc.recordMetric('order_created', parseInt(String(body.total || 0)), {
        payment_method: order?.payment_method || 'unknown'
      }));
    } catch { /* executionCtx unavailable */ }

    // Notify staff of new order (non-blocking)
    try {
      c.executionCtx?.waitUntil(
        notifyStaffOnNewOrder(c.env as Env, {
          id,
          table_id: (body.table_id as string) || null,
          items: (data.items as Array<Record<string, unknown>>) || [],
          total: parseInt(String(body.total || 0))
        })
      );
    } catch { /* push best-effort */ }

    return c.json({ success: true, data: order }, 201);
  });
}