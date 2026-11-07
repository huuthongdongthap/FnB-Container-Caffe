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
      tenantId,
    });
    if (snapshot.rejected) return errorResponse(snapshot.rejected.message, 400);
    const resolvedTableId = await resolveOrderCreationTable(db, data.table_id, tenantId);
    if (orderType === 'dine_in' && !resolvedTableId) {
      return errorResponse('dine_in orders require a valid table_id (table_number from QR)', 400);
    }
    const ownership = await resolveServerOrderOwnership({
      actor, clientSuppliedCustomerId: data.customer_id || null, customerPhone: data.customer_phone || null, db, tenantId,
    });
    const resolvedCustomerId = ownership.customerId;
    const now = new Date().toISOString();
    const rawPromoCode = (data.promo_code || data.promotion_code || '').trim().toUpperCase();
    let appliedPromo: { id: string; code: string; discountAmount: number; reservedInPlace?: boolean } | null = null;
    if (rawPromoCode) {
      const isWelcome = rawPromoCode === 'WELCOME';
      type PromoRow = {
        id: string; code: string;
        percent?: number | null; discount_type?: string | null; discount_value?: number | null;
        max_discount?: number | null; max_discount_value?: number | null;
        min_order?: number | null; min_order_value?: number | null;
        starts_at?: string | null; valid_from?: string | null;
        expires_at?: string | null; valid_to?: string | null;
        usage_limit?: number | null; max_uses?: number | null;
        usage_count?: number | null; current_uses?: number | null;
        is_active?: number; type?: string | null; tenant_id?: string | null;
      };
      let promo = await db.prepare(
        "SELECT id, code, percent, discount_type, discount_value, max_discount, max_discount_value, min_order, min_order_value, starts_at, valid_from, expires_at, valid_to, usage_limit, max_uses, usage_count, current_uses, is_active, type, tenant_id FROM promotions WHERE UPPER(code) = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
      ).bind(rawPromoCode, tenantId).first<PromoRow>().catch(() =>
        db.prepare(
          "SELECT * FROM promotions WHERE UPPER(code) = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
        ).bind(rawPromoCode, tenantId).first<PromoRow>().catch(() =>
          (tenantId === 'default' || tenantId === '*')
            ? db.prepare('SELECT * FROM promotions WHERE UPPER(code) = ?').bind(rawPromoCode).first<PromoRow>().catch(() => null)
            : null
        )
      );
      if (promo && 'tenant_id' in promo && promo.tenant_id !== undefined && tenantId !== '*') {
        const promoTenant = (promo.tenant_id && String(promo.tenant_id).trim()) || 'default';
        if (promoTenant !== tenantId) {
          return errorResponse('Mã khuyến mãi không tồn tại hoặc không thuộc cửa hàng hiện tại', 400);
        }
      }
      if (promo && Number(promo.is_active ?? 1) === 0) {
        return errorResponse('Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hoá', 400);
      }
      if (!promo && isWelcome) {
        promo = { id: 'promo_welcome', code: 'WELCOME', percent: 10, max_discount: 30000, min_order: 0, usage_limit: 0, usage_count: 0, is_active: 1 };
      }
      if (!promo) return errorResponse('Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hoá', 400);
      const startsAt = promo.starts_at ?? promo.valid_from;
      const expiresAt = promo.expires_at ?? promo.valid_to;
      const minOrder = Number(promo.min_order ?? promo.min_order_value ?? 0);
      const rawUsageLimit = Number(promo.usage_limit ?? 0);
      const rawMaxUses = Number(promo.max_uses ?? 0);
      const usageLimit = rawUsageLimit > 0 ? rawUsageLimit : rawMaxUses > 0 ? rawMaxUses : (promo.usage_limit ?? promo.max_uses);
      const usageCount = Math.max(Number(promo.usage_count ?? 0), Number(promo.current_uses ?? 0));
      if (startsAt && new Date(startsAt) > new Date()) return errorResponse('Chương trình khuyến mãi chưa bắt đầu', 400);
      // WELCOME with a real promotions row still honours the configured window
      // and usage limit; the synthetic fallback carries no expiry of its own.
      if (expiresAt && new Date(expiresAt) < new Date()) return errorResponse('Mã khuyến mãi đã hết hạn', 400);
      if (usageLimit != null && Number(usageLimit) > 0 && usageCount >= Number(usageLimit)) {
        return errorResponse('Mã khuyến mãi đã hết lượt sử dụng', 400);
      }
      if (minOrder > 0 && snapshot.subtotal < minOrder) return errorResponse(`Đơn hàng tối thiểu ${minOrder}đ`, 400);
      if (isWelcome) {
        const rawPhone = String(data.customer_phone || '').trim();
        const digits = rawPhone.replace(/\D/g, '');
        // Canonicalize the Vietnam national prefix so 0901… and +84901… are the
        // same customer and cannot both claim the first-order WELCODE discount.
        const normalizedPhone = (digits.startsWith('84') && digits.length >= 10 ? '0' + digits.slice(2) : digits);
        if (!data.customer_name?.trim() || !normalizedPhone || /^0+$/.test(normalizedPhone)) {
          return errorResponse('Mã WELCOME yêu cầu khách hàng mới để lại thông tin đăng ký', 400);
        }
        const prior = await db.prepare(
          "SELECT COUNT(*) AS cnt FROM orders WHERE (customer_id = ? OR customer_phone = ?) AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3) AND status NOT IN ('cancelled', 'failed')"
        ).bind(resolvedCustomerId, normalizedPhone, tenantId).first<{ cnt?: number }>().catch(() =>
          (tenantId === 'default' || tenantId === '*')
            ? db.prepare(
                "SELECT COUNT(*) AS cnt FROM orders WHERE (customer_id = ? OR customer_phone = ?) AND status NOT IN ('cancelled', 'failed')"
              ).bind(resolvedCustomerId, normalizedPhone).first<{ cnt?: number }>().catch(() => null)
            : null
        );
        let priorCount = Number(prior?.cnt ?? 0);
        if (priorCount === 0) {
          const priorFormatted = await db.prepare(
            "SELECT COUNT(*) AS cnt FROM orders WHERE (customer_phone = ? OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', '') = ?) AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3) AND status NOT IN ('cancelled', 'failed')"
          ).bind(rawPhone, normalizedPhone, tenantId).first<{ cnt?: number }>().catch(() =>
            (tenantId === 'default' || tenantId === '*')
              ? db.prepare(
                  "SELECT COUNT(*) AS cnt FROM orders WHERE (customer_phone = ? OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', '') = ?) AND status NOT IN ('cancelled', 'failed')"
                ).bind(rawPhone, normalizedPhone).first<{ cnt?: number }>().catch(() => null)
              : null
          );
          priorCount = Number(priorFormatted?.cnt ?? 0);
        }
        if (priorCount > 0) {
          return errorResponse('Mã WELCOME chỉ áp dụng cho khách hàng mới lần đầu đến quán', 400);
        }
      }
      let reservedInPlace = false;
      if (!isWelcome || promo.id !== 'promo_welcome') {
        const reserveSql =
          rawUsageLimit <= 0 && rawMaxUses > 0
            ? "UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1, current_uses = COALESCE(current_uses, 0) + 1 WHERE UPPER(code) = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND is_active = 1 AND (usage_limit IS NULL OR usage_limit <= 0 OR COALESCE(usage_count, 0) < usage_limit) AND (max_uses IS NULL OR max_uses <= 0 OR COALESCE(current_uses, 0) < max_uses) AND (max_uses IS NULL OR max_uses <= 0 OR COALESCE(usage_count, 0) < max_uses)"
            : "UPDATE promotions SET usage_count = usage_count + 1 WHERE UPPER(code) = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND is_active = 1 AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)";
        const reserveRes = await db.prepare(reserveSql)
          .bind(promo.code, tenantId)
          .run()
          .catch(() =>
            db.prepare(
              "UPDATE promotions SET usage_count = usage_count + 1 WHERE UPPER(code) = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND is_active = 1 AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)"
            ).bind(promo.code, tenantId).run()
          )
          .catch(() =>
            (tenantId === 'default' || tenantId === '*')
              ? db.prepare(
                  'UPDATE promotions SET usage_count = usage_count + 1 WHERE UPPER(code) = ? AND is_active = 1 AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)'
                ).bind(promo.code).run().catch(() => null)
              : null
          ) as { meta?: { changes?: number }; changes?: number } | null;
        const changes = reserveRes?.meta?.changes ?? reserveRes?.changes;
        if (changes !== undefined && Number(changes) < 1) {
          return errorResponse('Mã khuyến mãi đã hết lượt sử dụng', 400);
        }
        if (promo.id && !(rawUsageLimit <= 0 && rawMaxUses > 0)) {
          await db.prepare(
            "UPDATE promotions SET current_uses = COALESCE(current_uses, 0) + 1 WHERE id = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
          ).bind(promo.id, tenantId).run().catch(() =>
            (tenantId === 'default' || tenantId === '*')
              ? db.prepare('UPDATE promotions SET current_uses = COALESCE(current_uses, 0) + 1 WHERE id = ?').bind(promo.id).run().catch(() => {})
              : null
          );
        }
        reservedInPlace = true;
      }
      const promoType = String(promo.discount_type ?? promo.type ?? '').toLowerCase();
      let rawDiscount: number;
      if (promoType === 'fixed') {
        rawDiscount = Math.round(Number(promo.discount_value ?? promo.percent ?? 0));
      } else {
        const rawPct = Number(promo.percent ?? promo.discount_value ?? 0);
        const pct = isWelcome ? (rawPct || 10) : rawPct;
        rawDiscount = Math.round((snapshot.subtotal * pct) / 100);
      }
      const maxDiscount = promo.max_discount ?? promo.max_discount_value ?? (isWelcome ? 30000 : null);
      const cappedDisc = maxDiscount != null && Number(maxDiscount) > 0 ? Math.min(rawDiscount, Number(maxDiscount)) : rawDiscount;
      snapshot.discount = Math.min(snapshot.subtotal, Math.max(0, cappedDisc));
      snapshot.total = Math.max(0, snapshot.subtotal - snapshot.discount) + (snapshot.service_fee ?? 0) + snapshot.shipping_fee + snapshot.tip_amount;
      appliedPromo = { id: promo.id ?? promo.code, code: promo.code, discountAmount: snapshot.discount, reservedInPlace };
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
    const legacyStatements: D1PreparedStatement[] = [];
    if (idem) {
      const idemSql = `INSERT INTO order_creation_requests
        (scope_key, fingerprint, order_id, response_body, created_at) VALUES (?, ?, ?, ?, ?)`;
      const idemArgs = [idem.key, idem.fingerprint, orderId, JSON.stringify(responseBody), now] as const;
      statements.push(db.prepare(idemSql).bind(...idemArgs));
      legacyStatements.push(db.prepare(idemSql).bind(...idemArgs));
    }
    const orderInsertSql = `INSERT INTO orders (
      id, items, total, status, customer_name, customer_phone,
      customer_email, customer_address, payment_method, payment_status,
      shipping_fee, discount, notes, delivery_time, table_id,
      order_type, tip_amount, service_fee, customer_id, tenant_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const orderInsertArgs = [
      orderId, snapshot.itemsJson, snapshot.total, 'pending', data.customer_name, data.customer_phone,
      data.customer_email || null, data.customer_address || null, validatedMethod, 'unpaid',
      snapshot.shipping_fee, snapshot.discount, data.notes || null, data.delivery_time || 'now', resolvedTableId,
      orderType, snapshot.tip_amount, snapshot.service_fee, resolvedCustomerId, tenantId, now, now,
    ] as const;
    statements.push(db.prepare(orderInsertSql).bind(...orderInsertArgs));
    legacyStatements.push(db.prepare(orderInsertSql).bind(...orderInsertArgs));
    for (const item of snapshot.items) {
      const itemId = generateId('ITEM_');
      const modifiersJson = JSON.stringify(item.modifiers || []);
      const legacyItemStmt = db.prepare(`INSERT INTO order_items
        (id, order_id, product_id, quantity, subtotal, modifiers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(itemId, orderId, item.menuItemId, item.quantity, item.subtotalCents,
          modifiersJson, now);
      if (tenantId === 'default') {
        statements.push(legacyItemStmt);
      } else {
        statements.push(db.prepare(`INSERT INTO order_items
          (id, order_id, product_id, quantity, subtotal, modifiers, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(itemId, orderId, item.menuItemId, item.quantity, item.subtotalCents,
            modifiersJson, now, tenantId));
      }
      legacyStatements.push(legacyItemStmt);
    }
    if (validatedMethod === 'cod') {
      const payId = generateId('PAY_');
      statements.push(db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(payId, orderId, 'cod', snapshot.total, 'pending', tenantId, now, now));
      legacyStatements.push(db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(payId, orderId, 'cod', snapshot.total, 'pending', now, now));
    }
    if (resolvedTableId) {
      const tblClause = tenantId === 'default'
        ? "AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : 'AND (tenant_id = ? OR TRIM(tenant_id) = ?2)';
      const tableOccupySql = `UPDATE cafe_tables SET status = 'Occupied' WHERE id = ? ${tblClause} AND status = 'Available'`;
      statements.push(db.prepare(tableOccupySql).bind(resolvedTableId, tenantId));
      legacyStatements.push(db.prepare(tableOccupySql).bind(resolvedTableId, tenantId));
    }
    try {
      try {
        await db.batch(statements);
      } catch (batchErr) {
        const msg = String((batchErr as Error)?.message ?? '');
        if ((msg.includes('tenant_id') || msg.includes('no column named')) && (tenantId === 'default' || tenantId === '*' || msg.includes('order_items'))) {
          await db.batch(legacyStatements);
        } else {
          throw batchErr;
        }
      }
    }
    catch (error) {
      if (appliedPromo?.reservedInPlace) {
        const promoTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
        await db.prepare(
          "UPDATE promotions SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END, current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END WHERE UPPER(code) = UPPER(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(appliedPromo.code, promoTenant).run().catch(async () => {
          if (promoTenant === 'default') {
            await db.prepare(
              'UPDATE promotions SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END WHERE UPPER(code) = ?'
            ).bind(appliedPromo.code).run().catch(() => {});
          }
        });
      }
      // A concurrent same-key request either committed the entire order or nothing.
      const saved = idem ? await findReplay() : null;
      if (saved) return replayResponse(saved, idem!.fingerprint);
      throw error;
    }
    if (appliedPromo) {
      const promoTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
      if (!appliedPromo.reservedInPlace) {
        await db.prepare(
          "UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)"
        ).bind(appliedPromo.code, promoTenant).run().catch(async () => {
          if (promoTenant === 'default') {
            await db.prepare(
              'UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ? AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)'
            ).bind(appliedPromo.code).run().catch(() => {});
          }
        });
        await db.prepare(
          "UPDATE promotions SET current_uses = COALESCE(current_uses, 0) + 1 WHERE code = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(appliedPromo.code, promoTenant).run().catch(() => {});
      }
      await db.prepare(
        'INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(appliedPromo.id, appliedPromo.code, orderId, appliedPromo.discountAmount, snapshot.subtotal, now).run().catch(() => {});
      await db.prepare(
        'UPDATE promotion_redemptions SET tenant_id = ?, customer_id = ? WHERE order_id = ?'
      ).bind(promoTenant, resolvedCustomerId ?? null, orderId).run().catch(() => {});
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
        db, env, ctx, orderId, tenantId, data: { ...data, customer_id: resolvedCustomerId, order_type: orderType }, snapshot, validatedMethod, resolvedTableId,
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
