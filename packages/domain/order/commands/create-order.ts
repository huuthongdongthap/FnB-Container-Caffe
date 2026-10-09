/**
 * Orders — Create order handler
 * Canonical Order Write Handler
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { createOrderSchema, paymentMethodSchema } from 'worker/src/lib/validators';
import { generateId, parseJSON } from '../model/helpers';
import { calculateOrderSnapshot } from '../policies/order-snapshot';
import { runPostOrderSideEffects } from './create-order-side-effects';
import { verifyJWT } from 'worker/src/lib/jwt';
import { resolveServerOrderOwnership } from '../../customer/policies/order-ownership-policy';

const log = createLogger({ route: 'orders' });

export async function createOrder(request: Request, env: Record<string, unknown>, ctx?: { waitUntil?: (p: Promise<unknown>) => void }) {
  // ── Idempotency check (Idempotency-Key header → KV cache) ──────
  const idemKey = request.headers.get('Idempotency-Key');
  if (idemKey && env.AUTH_KV) {
    const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    const cached = await kv.get(`order:idempotency:${idemKey}`, 'json');
    if (cached) return new Response(JSON.stringify(cached), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' } });
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

    // ── Server-authoritative price snapshot ──────────────
    const snapshot = await calculateOrderSnapshot(db, {
      items: data.items,
      order_type: data.order_type || 'dine_in',
      shipping_fee: data.shipping_fee,
      discount: data.discount,
      service_fee: data.service_fee,
      tip_amount: data.tip_amount,
    });
    if (snapshot.rejected) {
      return errorResponse(snapshot.rejected.message, 400);
    }
    const itemsJson = snapshot.itemsJson;

    // ── DO Broadcast (before D1) ──────────────────────────
    if ((env as Record<string, unknown>).ORDER_BROADCASTER) {
      const ns = (env as Record<string, unknown>).ORDER_BROADCASTER as import('@cloudflare/workers-types').DurableObjectNamespace;
      const stub = ns.get(ns.idFromName(orderId));
      (stub as unknown as { broadcast(msg: unknown): Promise<void> }).broadcast({
        orderId, status: 'pending', payment_status: 'unpaid', items: snapshot.items, total: snapshot.total,
        customer_name: data.customer_name, customer_phone: data.customer_phone, table_id: null,
        createdAt: Date.now(), updatedAt: Date.now(),
      }).catch(e => {
        if (env.AUTH_KV) {
          (env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace).put(
            `broadcast:fail:${orderId}`,
            JSON.stringify({ orderId, error: 'DO_BROADCAST_FAILED', message: (e as Error).message, ts: new Date().toISOString() }),
            { expirationTtl: 86400 }
          ).catch(() => {});
        }
      });
    }

    let resolvedTableId: string | null = null;
    if (data.table_id) {
      const tableNum = data.table_id.trim();
      let tableRow = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ?').bind(tableNum).first<{ id: string }>();
      if (!tableRow && tableNum !== tableNum.toUpperCase()) {
        tableRow = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ?').bind(tableNum.toUpperCase()).first<{ id: string }>();
      }
      if (tableRow) {
        resolvedTableId = tableRow.id;
        await db.prepare("UPDATE cafe_tables SET status = 'Occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Available'").bind(tableRow.id).run();
      }
    }

    if (data.order_type === 'dine_in' && !resolvedTableId) {
      return errorResponse('dine_in orders require a valid table_id (table_number from QR)', 400);
    }

    const now = new Date().toISOString();

    // ── Server-authoritative Customer Ownership Resolution ────────
    let actor: { id?: string; role?: string } | null = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && env.JWT_SECRET) {
      try {
        const payload = await verifyJWT(authHeader.substring(7), env.JWT_SECRET as string);
        if (payload) actor = { id: payload.id || (payload as any).sub, role: payload.role };
      } catch { /* guest */ }
    }
    const ownership = await resolveServerOrderOwnership({
      actor,
      clientSuppliedCustomerId: data.customer_id || null,
      customerPhone: data.customer_phone || null,
      db: db as any,
    });
    const resolvedCustomerId = ownership.customerId;

    // ── Canonical D1 orders persistence ──────────────────────────
    await db.prepare(`
      INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        customer_email, customer_address, payment_method, payment_status,
        shipping_fee, discount, notes, delivery_time, table_id,
        order_type, tip_amount, service_fee, customer_id, tenant_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, itemsJson,
      snapshot.total, 'pending',
      data.customer_name, data.customer_phone,
      data.customer_email || null, data.customer_address || null,
      validatedMethod, 'unpaid',
      snapshot.shipping_fee,
      snapshot.discount,
      data.notes || null, data.delivery_time || 'now',
      resolvedTableId,
      data.order_type || 'dine_in',
      snapshot.tip_amount,
      snapshot.service_fee,
      resolvedCustomerId,
      data.tenant_id || 'default',
      now, now
    ).run();

    // ── Canonical D1 order_items persistence (7 columns) ─────────
    for (const item of snapshot.items) {
      const lineItemId = generateId('ITEM_');
      await db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, quantity, subtotal, modifiers, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        lineItemId,
        orderId,
        item.menuItemId,
        item.quantity,
        item.subtotalCents,
        JSON.stringify(item.modifiers || []),
        now
      ).run();
    }

    // ── Canonical payments record (COD / non-PayOS) ─────────────
    if (validatedMethod !== 'payos') {
      const paymentId = generateId('PAY_');
      await db.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(paymentId, orderId, validatedMethod, snapshot.total, 'pending', now, now).run();
    }

    // ── Post-order side effects (non-blocking) ───────────────────
    await runPostOrderSideEffects({
      db, env, ctx, orderId, data, snapshot, validatedMethod, resolvedTableId
    });

    // ── Cache idempotency response ──────────────────────────────
    const idemBody = {
      success: true, data: {
        id: orderId, status: 'pending', payment_status: 'unpaid',
        items: snapshot.items, total: snapshot.total,
        customer: { full_name: data.customer_name, phone: data.customer_phone, address: data.customer_address || null },
        customer_name: data.customer_name, customer_phone: data.customer_phone,
        customer_address: data.customer_address || null, payment_method: validatedMethod,
        shipping_fee: snapshot.shipping_fee, discount: snapshot.discount,
        notes: data.notes || null, delivery_time: data.delivery_time || 'now',
        table_id: resolvedTableId, order_type: data.order_type || 'dine_in',
        created_at: now
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
