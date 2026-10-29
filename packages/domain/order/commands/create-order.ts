/** Canonical order writer: signed scope, server prices and atomic persistence. */
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { createOrderSchema, paymentMethodSchema } from 'worker/src/lib/validators';
import { generateId, parseJSON } from '../model/helpers';
import { calculateCheckoutSnapshot } from '../policies/checkout-snapshot';
import { resolveOrderCreationScope, resolveOrderCreationTable, orderCreationIdempotency, OrderCreationError, type OrderCreationActor } from '../policies/order-creation-scope';
import { runPostOrderSideEffects } from './create-order-side-effects';
import { publishOrderEvent } from '../policies/customer-order-payload';
import { resolveServerOrderOwnership } from '../../customer/policies/order-ownership-policy';

const log = createLogger({ route: 'orders' });
interface SavedCreation { fingerprint: string; response_body: string }
const replayResponse = (row: SavedCreation, fingerprint: string) => row.fingerprint !== fingerprint
  ? errorResponse('Idempotency-Key reused with different order data', 409)
  : new Response(row.response_body, { status: 200, headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' } });

export async function createOrder(
  request: Request, env: Record<string, unknown>,
  ctx?: { waitUntil?: (p: Promise<unknown>) => void }, trustedActor?: OrderCreationActor,
) {
  try {
    const parsed = createOrderSchema.safeParse(await parseJSON(request));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }
    const data = parsed.data;
    const validatedMethod = paymentMethodSchema.parse(data.payment_method);
    const { actor, tenantId } = await resolveOrderCreationScope(request, env, trustedActor);
    const idemKey = request.headers.get('Idempotency-Key');
    const scopedData = { ...data };
    delete scopedData.tenant_id;
    const idem = idemKey ? await orderCreationIdempotency(tenantId, actor?.id, idemKey, scopedData) : null;
    const db = env.AURA_DB as D1Database;
    const findReplay = () => db.prepare('SELECT fingerprint, response_body FROM order_creation_requests WHERE scope_key = ?')
      .bind(idem!.key).first<SavedCreation>();
    // D1 is authoritative; KV eviction or outage must never duplicate an accepted offline order.
    if (idem) {
      const saved = await findReplay();
      if (saved) return replayResponse(saved, idem.fingerprint);
    }
    const orderId = generateId('ORD_');
    const orderType = data.order_type || (data.table_id ? 'dine_in' : 'takeaway');
    const snapshot = await calculateCheckoutSnapshot(db, {
      items: data.items, order_type: orderType, shipping_fee: data.shipping_fee,
      discount: data.discount, service_fee: data.service_fee, tip_amount: data.tip_amount,
    });
    if (snapshot.rejected) return errorResponse(snapshot.rejected.message, 400);
    const resolvedTableId = await resolveOrderCreationTable(db, data.table_id, tenantId);
    if (orderType === 'dine_in' && !resolvedTableId) {
      return errorResponse('dine_in orders require a valid table_id (table_number from QR)', 400);
    }
    const ownership = await resolveServerOrderOwnership({
      actor, clientSuppliedCustomerId: data.customer_id || null, customerPhone: data.customer_phone || null, db,
    });
    const resolvedCustomerId = ownership.customerId;
    const now = new Date().toISOString();
    const rawPromoCode = (data.promo_code || data.promotion_code || '').trim().toUpperCase();
    let appliedPromo: { id: string; code: string; discountAmount: number } | null = null;
    if (rawPromoCode) {
      const isWelcome = rawPromoCode === 'WELCOME';
      let promo = await db.prepare(
        'SELECT id, code, percent, max_discount, min_order, starts_at, expires_at, usage_limit, usage_count, is_active FROM promotions WHERE UPPER(code) = ? AND is_active = 1'
      ).bind(rawPromoCode).first<{
        id: string; code: string; percent: number; max_discount: number; min_order: number;
        starts_at?: string | null; expires_at?: string | null; usage_limit: number; usage_count: number;
      }>().catch(() => null);
      if (!promo && isWelcome) {
        promo = { id: 'promo_welcome', code: 'WELCOME', percent: 10, max_discount: 30000, min_order: 0, usage_limit: 0, usage_count: 0 };
      }
      if (!promo) return errorResponse('Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hoá', 400);
      if (promo.starts_at && new Date(promo.starts_at) > new Date()) return errorResponse('Chương trình khuyến mãi chưa bắt đầu', 400);
      if (!isWelcome && promo.expires_at && new Date(promo.expires_at) < new Date()) return errorResponse('Mã khuyến mãi đã hết hạn', 400);
      if (!isWelcome && promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) return errorResponse('Mã khuyến mãi đã hết lượt sử dụng', 400);
      if (promo.min_order > 0 && snapshot.subtotal < promo.min_order) return errorResponse(`Đơn hàng tối thiểu ${promo.min_order}đ`, 400);
      if (isWelcome) {
        const normalizedPhone = (data.customer_phone || '').replace(/[\s\-().]/g, '');
        if (!data.customer_name?.trim() || !normalizedPhone) {
          return errorResponse('Mã WELCOME yêu cầu khách hàng mới để lại thông tin đăng ký', 400);
        }
        const prior = await db.prepare(
          "SELECT COUNT(*) AS cnt FROM orders WHERE (customer_id = ? OR customer_phone = ?) AND status NOT IN ('cancelled', 'failed')"
        ).bind(resolvedCustomerId, normalizedPhone).first<{ cnt?: number }>().catch(() => null);
        if (Number(prior?.cnt ?? 0) > 0) {
          return errorResponse('Mã WELCOME chỉ áp dụng cho khách hàng mới lần đầu đến quán', 400);
        }
      }
      const pct = isWelcome ? (promo.percent || 10) : promo.percent;
      const cap = isWelcome ? (promo.max_discount || 30000) : promo.max_discount;
      const rawDisc = Math.round((snapshot.subtotal * pct) / 100);
      snapshot.discount = cap > 0 ? Math.min(rawDisc, cap) : rawDisc;
      snapshot.total = Math.max(0, snapshot.subtotal - snapshot.discount) + snapshot.shipping_fee + snapshot.tip_amount;
      appliedPromo = { id: promo.id ?? promo.code, code: promo.code, discountAmount: snapshot.discount };
    }
    const responseBody = {
      success: true, data: {
        id: orderId, status: 'pending', payment_status: 'unpaid', items: snapshot.items, total: snapshot.total,
        customer: { full_name: data.customer_name, phone: data.customer_phone, address: data.customer_address || null },
        customer_name: data.customer_name, customer_phone: data.customer_phone,
        customer_address: data.customer_address || null, payment_method: validatedMethod,
        shipping_fee: snapshot.shipping_fee, discount: snapshot.discount, notes: data.notes || null,
        delivery_time: data.delivery_time || 'now', table_id: resolvedTableId, order_type: orderType, created_at: now,
      },
      message: 'Order created successfully',
    };
    const statements: D1PreparedStatement[] = [];
    if (idem) {
      statements.push(db.prepare(`INSERT INTO order_creation_requests
        (scope_key, fingerprint, order_id, response_body, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(idem.key, idem.fingerprint, orderId, JSON.stringify(responseBody), now));
    }
    statements.push(db.prepare(`INSERT INTO orders (
      id, items, total, status, customer_name, customer_phone,
      customer_email, customer_address, payment_method, payment_status,
      shipping_fee, discount, notes, delivery_time, table_id,
      order_type, tip_amount, service_fee, customer_id, tenant_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderId, snapshot.itemsJson, snapshot.total, 'pending', data.customer_name, data.customer_phone,
        data.customer_email || null, data.customer_address || null, validatedMethod, 'unpaid',
        snapshot.shipping_fee, snapshot.discount, data.notes || null, data.delivery_time || 'now', resolvedTableId,
        orderType, snapshot.tip_amount, snapshot.service_fee, resolvedCustomerId, tenantId, now, now));
    for (const item of snapshot.items) {
      statements.push(db.prepare(`INSERT INTO order_items
        (id, order_id, product_id, quantity, subtotal, modifiers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(generateId('ITEM_'), orderId, item.menuItemId, item.quantity, item.subtotalCents,
          JSON.stringify(item.modifiers || []), now));
    }
    if (validatedMethod === 'cod') {
      statements.push(db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(generateId('PAY_'), orderId, 'cod', snapshot.total, 'pending', now, now));
    }
    if (resolvedTableId) {
      statements.push(db.prepare("UPDATE cafe_tables SET status = 'Occupied' WHERE id = ? AND tenant_id = ? AND status = 'Available'")
        .bind(resolvedTableId, tenantId));
    }
    try { await db.batch(statements); }
    catch (error) {
      // A concurrent same-key request either committed the entire order or nothing.
      const saved = idem ? await findReplay() : null;
      if (saved) return replayResponse(saved, idem!.fingerprint);
      throw error;
    }
    if (appliedPromo) {
      await db.prepare(
        'UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ? AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)'
      ).bind(appliedPromo.code).run().catch(() => {});
      await db.prepare(
        'INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(appliedPromo.id, appliedPromo.code, orderId, appliedPromo.discountAmount, snapshot.subtotal, now).run().catch(() => {});
    }
    await publishOrderEvent(env.AUTH_KV as KVNamespace | undefined, orderId, 'pending');
    // Notifications and cache writes run only after commit and cannot turn success into a retryable 500.
    try {
      if (env.ORDER_BROADCASTER) {
        const ns = env.ORDER_BROADCASTER as import('@cloudflare/workers-types').DurableObjectNamespace;
        const stub = ns.get(ns.idFromName(orderId));
        const event = {
          orderId, status: 'pending', payment_status: 'unpaid', items: snapshot.items, total: snapshot.total,
          customer_name: data.customer_name, customer_phone: data.customer_phone, table_id: resolvedTableId,
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        const broadcast = stub.fetch('https://do/broadcast', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
        }).then(result => { if (!result.ok) throw new Error(`Broadcast returned ${result.status}`); })
          .catch(error => log.warn('Order broadcast failed after commit', { orderId, message: (error as Error).message }));
        if (ctx?.waitUntil) ctx.waitUntil(broadcast); else await broadcast;
      }
      await runPostOrderSideEffects({
        db, env, ctx, orderId, data: { ...data, customer_id: resolvedCustomerId, order_type: orderType }, snapshot, validatedMethod, resolvedTableId,
      });
    } catch (error) {
      log.warn('Order side effect failed after persistence', { orderId, message: (error as Error).message });
    }
    if (idem && env.AUTH_KV) {
      await (env.AUTH_KV as KVNamespace).put(idem.key,
        JSON.stringify({ fingerprint: idem.fingerprint, body: responseBody }), { expirationTtl: 86400 }).catch(() => {});
    }
    return jsonResponse(responseBody, 201);
  } catch (error) {
    if (error instanceof OrderCreationError) return Response.json({ success: false, error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
    log.error('CreateOrder error:', { message: (error as Error).message });
    return errorResponse('Failed to create order', 500);
  }
}
