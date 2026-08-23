/**
 * Orders — Create order handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { createOrderSchema, paymentMethodSchema } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { generateId, parseJSON } from './helpers';
import { notifyTelegram } from './telegram';
import { deductInventoryForOrder } from '../../routes/inventory/order-deduction';
import { syncOrderToERPNext } from '../../tree/erpnext/sync.js';
import type { PushEnv, PushPayload } from '../../tree/push/notifier.js';

type Env = import('../../types/env').Env;

const log = createLogger({ route: 'orders' });

export async function createOrder(request: Request, env: Record<string, unknown>, ctx?: { waitUntil?: (p: Promise<unknown>) => void }) {
  // ── Idempotency check (Idempotency-Key header → KV cache) ──────
  const idemKey = request.headers.get('Idempotency-Key');
  if (idemKey && env.AUTH_KV) {
    const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const cached = await kv.get(`order:idempotency:${idemKey}`, 'json');
    if (cached) return new Response(JSON.stringify(cached), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await parseJSON(request);
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }
    const data = parsed.data;
    const validatedMethod = paymentMethodSchema.parse(data.payment_method);

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const orderId = generateId('ORD_');
    const itemsJson = JSON.stringify(data.items);

    // If table_id (table_number from QR) provided, resolve to actual table UUID

    // ── DO Broadcast (before D1 — Phase 1) ──────────────────────────
    // CF throws RangeError for DO dispatch errors. Catch → log to KV.
    if ((env as Record<string, unknown>).ORDER_BROADCASTER) {
      const ns = (env as Record<string, unknown>).ORDER_BROADCASTER as import('@cloudflare/workers-types').DurableObjectNamespace;
      const stub = ns.get(ns.idFromName(orderId));
      // Build event; table_id resolved below after table lookup
      ;(async () => {
        try {
          await (stub as unknown as { broadcast(msg: unknown): Promise<void> }).broadcast({
            orderId,
            status: 'pending',
            payment_status: 'unpaid',
            items: data.items,
            total: parseInt(String(data.total)),
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            table_id: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } catch (e) {
          if (env.AUTH_KV) {
            const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
            await kv.put(`broadcast:fail:${orderId}`, JSON.stringify({
              orderId,
              error: 'DO_BROADCAST_FAILED',
              message: (e as Error).message,
              ts: new Date().toISOString(),
            }), { expirationTtl: 86400 });
          }
        }
      })().catch(() => {});
    }

    let resolvedTableId: string | null = null;
    if (data.table_id) {
      const tableRow = await db.prepare(
        'SELECT id FROM cafe_tables WHERE table_number = ?'
      ).bind(data.table_id).first<{ id: string }>();
      if (tableRow) {
        resolvedTableId = tableRow.id;
        // Auto-occupy the table
        await db.prepare(
          'UPDATE cafe_tables SET status = \'Occupied\', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = \'Available\''
        ).bind(tableRow.id).run();
      }
    }

    await db.prepare(`
      INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        customer_email, customer_address, payment_method, payment_status,
        shipping_fee, discount, notes, delivery_time, table_id,
        order_type, tip_amount, service_fee, customer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, itemsJson,
      parseInt(String(data.total)), 'pending',
      data.customer_name, data.customer_phone,
      data.customer_email || null, data.customer_address || null,
      validatedMethod, 'unpaid',
      parseInt(String(data.shipping_fee || 0)),
      parseInt(String(data.discount || 0)),
      data.notes || null, data.delivery_time || 'now',
      resolvedTableId,
      data.order_type || 'dine_in',
      parseInt(String(data.tip_amount || 0)),
      parseInt(String(data.service_fee || 0)),
      data.customer_id || null
    ).run();

    // Skip payment record for PayOS — create-link endpoint handles it with PayOS transaction data.
    // Only create payment record for COD and other non-PayOS methods.
    if (validatedMethod !== 'payos') {
      const paymentId = generateId('PAY_');
      await db.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status)
        VALUES (?, ?, ?, ?, ?)
      `).bind(paymentId, orderId, validatedMethod, parseInt(String(data.total)), 'pending').run();
    }

    if (data.customer_email) {
      await db.prepare(`
        INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier)
        VALUES (?, ?, ?, ?, 0, 0, 'bronze')
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name, phone = excluded.phone, updated_at = CURRENT_TIMESTAMP
      `).bind(
        generateId('CUST_'), data.customer_email, data.customer_name, data.customer_phone
      ).run();
    }

    // ERPNext sync (fire-and-forget -- never block order creation)
    if (ctx?.waitUntil) {
      ctx.waitUntil(
        Promise.resolve(
          syncOrderToERPNext(
            {
              ERPNEXT_URL: (env as Record<string, string>).ERPNEXT_URL!,
              ERPNEXT_API_KEY: (env as Record<string, string>).ERPNEXT_API_KEY!,
              ERPNEXT_API_SECRET: (env as Record<string, string>).ERPNEXT_API_SECRET!
            },
            orderId,
            {
              customer_name: data.customer_name,
              customer_phone: data.customer_phone,
              customer_id: undefined,
              table_id: resolvedTableId,
              items: data.items,
              total: parseInt(String(data.total)),
              payment_method: validatedMethod,
              notes: data.notes
            }
          )
        )
      );
    }
    if (env.AUTH_KV) {
      const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      await kv.put('latest_order_ts', new Date().toISOString());
    }

    if (validatedMethod === 'cod') {
      const telegramPromise = notifyTelegram(env, {
        id: orderId, items: data.items, total: data.total,
        customer_name: data.customer_name, customer_phone: data.customer_phone,
        customer_address: data.customer_address, payment_method: validatedMethod,
        notes: data.notes
      }).catch(e => log.error('Telegram async error:', { message: (e as Error).message }));
      if (ctx?.waitUntil) {
        ctx.waitUntil(telegramPromise);
      } else {
        await telegramPromise;
      }
    }

    // Notify kitchen staff via push (non-blocking)
    const { sendPushToStaff } = await import('../push/notifier.js');
    // @ts-ignore -- PushEnv needs AURA_DB binding
    const pushPromise = sendPushToStaff(env, {
      title: 'Đơn hàng mới 🍳',
      body: `Bàn ${data.table_id || 'Mang đi'} — ${data.items.length} món`,
      data: { url: '/kds', orderId }
    }, 'staff-kitchen').catch(e => log.warn('Push notify failed:', { message: (e as Error).message }));
    if (ctx?.waitUntil) {
      ctx.waitUntil(pushPromise);
    } else {
      // cast ok - recordMetric returns Promise
    }

    if (ctx?.waitUntil) {
      const mc = createMetricsCollector(db);
      ctx.waitUntil(mc.recordMetric('order_created', parseInt(String(data.total)), {
        payment_method: validatedMethod, is_anonymous: !data.customer_email
      }));
    }

    // Post-order: non-blocking inventory deduction (log-only on failure)
    try {
      await deductInventoryForOrder(env as unknown as import('../../types/env').Env, orderId, data.items as Array<{ product_id: string; quantity: number; name?: string }>);
    } catch (e) {
      log.warn('Inventory deduction failed for order', {
        orderId,
        message: (e as Error).message
      });
    }

    if (data.customer_email) {
      const { sendEmail } = await import('../../lib/email.js');
      const { renderOrderConfirm } = await import('../../templates/order-confirm.js');
      const paymentLabels: Record<string, string> = { cod: 'COD', payos: 'PayOS' };
      const emailPromise = sendEmail(env, {
        to: data.customer_email,
        subject: `Xác nhận đơn hàng #${orderId} — AURA CAFE`,
        html: renderOrderConfirm({
          id: orderId,
          items: data.items.map(i => ({ name: i.name, qty: i.qty || i.quantity || 1, price: i.price || 0 })),
          total: Number(data.total),
          payment_method: paymentLabels[validatedMethod] || validatedMethod
        })
      }).catch(e => log.error('Email order confirm error:', { message: (e as Error).message }));
      if (ctx?.waitUntil) {
        ctx.waitUntil(emailPromise);
      }
    }

  // ── Cache idempotency response ──────────────────────────────────
  const idemBody = {
    success: true, data: {
      id: orderId, status: 'pending', payment_status: 'unpaid',
      items: data.items, total: parseInt(String(data.total)),
      customer: { full_name: data.customer_name, phone: data.customer_phone, address: data.customer_address || null },
      customer_name: data.customer_name, customer_phone: data.customer_phone,
      customer_address: data.customer_address || null, payment_method: validatedMethod,
      shipping_fee: parseInt(String(data.shipping_fee || 0)), discount: parseInt(String(data.discount || 0)),
      notes: data.notes || null, delivery_time: data.delivery_time || 'now',
      table_id: resolvedTableId,
      created_at: new Date().toISOString()
    },
    message: 'Order created successfully'
  };
  if (idemKey && env.AUTH_KV) {
    const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    await kv.put(`order:idempotency:${idemKey}`, JSON.stringify(idemBody), { expirationTtl: 86400 });
  }
  return jsonResponse(idemBody, 201);
} catch (error) {
  log.error('CreateOrder error:', { message: (error as Error).message });
  return errorResponse(`Failed to create order: ${(error as Error).message}`, 500);
}
}
