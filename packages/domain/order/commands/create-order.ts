/** Canonical order writer: signed scope, server prices and atomic persistence. */
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { createMetricsCollector } from 'worker/src/lib/metrics-collector';
import { createOrderSchema, paymentMethodSchema } from 'worker/src/lib/validators';
import { assertTenantWritable } from 'worker/src/lib/saas-entitlement';
import { isHQSuperAdmin } from 'worker/src/middleware/tenant';
import {
  assertCashSettlementWrite,
  isCashReconciliationActiveForTenant,
  resolveCashCollectingShift,
  type CashCollectingShift,
} from '../../shift/commands/cash-settlement';
import { generateId, generateOrderNumber, parseJSON } from '../model/helpers';
import { calculateCheckoutSnapshot } from '../policies/checkout-snapshot';
import { resolveOrderCreationScope, resolveOrderCreationTable, orderCreationIdempotency, OrderCreationError, type OrderCreationActor } from '../policies/order-creation-scope';
import { runPostOrderSideEffects } from './create-order-side-effects';
import { publishOrderEvent } from '../policies/customer-order-payload';
import { fanOutOrderBroadcast } from '../policies/order-broadcast';
import {
  generateOrderToken,
  hashOrderToken,
  resolveServerOrderOwnership,
} from '../../customer/policies/order-ownership-policy';
import {
  findLoyaltyVoucherByCode,
  validateLoyaltyVoucher,
  reserveLoyaltyVoucherAtomically,
  rollbackLoyaltyVoucherReservation,
  type LoyaltyVoucherRecord,
} from '../loyalty-voucher';

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
    const db = env.AURA_DB as D1Database;
    if (
      db &&
      tenantId &&
      tenantId !== 'default' &&
      tenantId !== 'hq' &&
      tenantId !== '*' &&
      !(actor && isHQSuperAdmin(actor))
    ) {
      const writeCheck = await assertTenantWritable(db, tenantId);
      if (!writeCheck.allowed) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            code: writeCheck.code || 'subscription_expired_readonly',
            error: writeCheck.code || 'subscription_expired_readonly',
            message: writeCheck.message,
            lifecycleState: writeCheck.entitlement.lifecycleState,
          },
          402
        );
      }
    }
    const idemKey = request.headers.get('Idempotency-Key');
    const scopedData = { ...data };
    delete scopedData.tenant_id;
    const idem = idemKey ? await orderCreationIdempotency(tenantId, actor?.id, idemKey, scopedData) : null;
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
    let appliedPromo: {
      id: string;
      code: string;
      discountAmount: number;
      reservedInPlace?: boolean;
      customerKey?: string | null;
      normalizedPromoPhone?: string;
      perCustomerLimit?: number;
    } | null = null;
    let appliedLoyaltyVoucher: LoyaltyVoucherRecord | null = null;
    if (rawPromoCode) {
      const isWelcome = rawPromoCode === 'WELCOME';
      type PromoRow = {
        id: string; code: string;
        percent?: number | null; discount_type?: string | null; discount_value?: number | null; value?: number | null;
        max_discount?: number | null; max_discount_value?: number | null;
        min_order?: number | null; min_order_value?: number | null;
        starts_at?: string | null; valid_from?: string | null;
        expires_at?: string | null; valid_to?: string | null;
        usage_limit?: number | null; max_uses?: number | null;
        usage_count?: number | null; current_uses?: number | null;
        usage_limit_per_customer?: number | null; max_uses_per_customer?: number | null; per_customer_limit?: number | null;
        is_active?: number; type?: string | null; tenant_id?: string | null;
      };
      let promo = await db.prepare(
        "SELECT id, code, percent, discount_type, discount_value, value, max_discount, max_discount_value, min_order, min_order_value, starts_at, valid_from, expires_at, valid_to, usage_limit, max_uses, usage_count, current_uses, usage_limit_per_customer, is_active, type, tenant_id FROM promotions WHERE UPPER(code) = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
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
      if (!promo) {
        const loyaltyVoucher = await findLoyaltyVoucherByCode(db, rawPromoCode, tenantId);
        if (!loyaltyVoucher) {
          return errorResponse('Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hoá', 400);
        }
        const actorRole = String(actor?.role ?? '').trim().toLowerCase();
        const isStaffActor = ['staff', 'cashier', 'waiter', 'barista', 'supervisor', 'manager', 'admin', 'owner'].includes(actorRole);
        if (
          (ownership.resolvedVia === 'staff_override' || ownership.resolvedVia === 'deterministic_identifier') &&
          !isStaffActor
        ) {
          return errorResponse('Không có quyền sử dụng mã voucher thay cho khách hàng', 403);
        }
        const voucherCheck = validateLoyaltyVoucher(loyaltyVoucher, {
          customerId: resolvedCustomerId,
          allowStaffOverride: isStaffActor && !resolvedCustomerId,
          orderTotal: snapshot.subtotal,
        });
        if (!voucherCheck.valid) {
          return errorResponse(voucherCheck.reason || 'Mã voucher không hợp lệ', 400);
        }
        const reserved = await reserveLoyaltyVoucherAtomically(db, loyaltyVoucher, orderId, now);
        if (!reserved) {
          return errorResponse('Mã voucher đã được sử dụng hoặc không còn hiệu lực', 400);
        }
        appliedLoyaltyVoucher = loyaltyVoucher;
        const voucherDiscount = voucherCheck.discountAmount ?? 0;
        snapshot.discount = Math.min(snapshot.subtotal, Math.max(0, voucherDiscount));
        snapshot.total = Math.max(0, snapshot.subtotal - snapshot.discount) + (snapshot.service_fee ?? 0) + snapshot.shipping_fee + snapshot.tip_amount;
      }
      if (promo) {
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
      const rawPromoPhone = String(data.customer_phone || '').trim();
      const promoPhoneDigits = rawPromoPhone.replace(/\D/g, '');
      const normalizedPromoPhone =
        promoPhoneDigits.startsWith('84') && promoPhoneDigits.length >= 10
          ? '0' + promoPhoneDigits.slice(2)
          : promoPhoneDigits;
      const isFixedType = [promo.type, promo.discount_type].some((t) => {
        const s = String(t ?? '').trim().toLowerCase();
        return s === 'fixed' || s === 'fixed_amount' || s === 'amount';
      });
      const promoType = String(promo.type ?? promo.discount_type ?? '').trim().toLowerCase();
      const isPercentType = !isFixedType && (promoType === '' || promoType === 'percent' || promoType === 'percentage');
      if (!isFixedType && !isPercentType) {
        return errorResponse('Loại khuyến mãi không hợp lệ', 400);
      }
      const resolvePromoAmount = (...candidates: Array<number | null | undefined>): number => {
        for (const c of candidates) {
          if (c !== null && c !== undefined) {
            const n = Number(c);
            if (!Number.isFinite(n) || n < 0) return -1;
            if (n > 0) return n;
          }
        }
        return 0;
      };
      let rawDiscount: number;
      if (isFixedType) {
        const rawFixed = resolvePromoAmount(promo.discount_value, promo.value);
        if (!Number.isFinite(rawFixed) || rawFixed <= 0) {
          return errorResponse('Giá trị giảm giá không hợp lệ', 400);
        }
        rawDiscount = Math.round(rawFixed);
      } else {
        const rawPct = resolvePromoAmount(promo.percent, promo.discount_value, promo.value);
        if (rawPct < 0) {
          return errorResponse('Giá trị giảm giá phần trăm không hợp lệ', 400);
        }
        const pct = isWelcome ? (rawPct || 10) : rawPct;
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          return errorResponse('Giá trị giảm giá phần trăm không hợp lệ', 400);
        }
        rawDiscount = Math.round((snapshot.subtotal * pct) / 100);
      }
      const perCustomerLimit = Number(
        promo.usage_limit_per_customer ?? promo.max_uses_per_customer ?? promo.per_customer_limit ?? 0
      );
      if (Number.isFinite(perCustomerLimit) && perCustomerLimit > 0) {
        const customerKey = resolvedCustomerId || normalizedPromoPhone || '';
        if (!customerKey) {
          return errorResponse('Mã khuyến mãi này yêu cầu thông tin khách hàng', 400);
        }
        const redemptionTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
        let perCustRow: { cnt?: number } | null = null;
        try {
          perCustRow = await db.prepare(
            `SELECT COUNT(*) AS cnt
             FROM promotion_redemptions pr
             LEFT JOIN orders o ON o.id = pr.order_id
             WHERE (UPPER(pr.code) = ? OR pr.promotion_id = ?)
               AND COALESCE(NULLIF(TRIM(pr.tenant_id), ''), 'default') = ?
               AND (
                 pr.customer_id = ?
                 OR (? != '' AND pr.customer_id = ?)
                 OR (? != '' AND (
                   o.customer_phone = ?
                   OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', '') = ?
                   OR (
                     REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', '') LIKE '84%'
                     AND '0' || SUBSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', ''), 3) = ?
                   )
                 ))
               )
               AND (o.status IS NULL OR o.status NOT IN ('cancelled', 'failed'))`
          ).bind(
            String(promo.code || '').toUpperCase(),
            String(promo.id ?? promo.code ?? ''),
            redemptionTenant,
            customerKey,
            normalizedPromoPhone,
            normalizedPromoPhone,
            normalizedPromoPhone,
            normalizedPromoPhone,
            normalizedPromoPhone,
            normalizedPromoPhone
          ).first<{ cnt?: number }>();
        } catch (err) {
          const msg = String((err as Error)?.message ?? '').toLowerCase();
          if (msg.includes('no such column') || msg.includes('no such table')) {
            try {
              perCustRow = await db.prepare(
                `SELECT COUNT(*) AS cnt
                 FROM promotion_redemptions
                 WHERE (UPPER(code) = ? OR promotion_id = ?)
                   AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                   AND (customer_id = ? OR (? != '' AND customer_id = ?))`
              ).bind(
                String(promo.code || '').toUpperCase(),
                String(promo.id ?? promo.code ?? ''),
                redemptionTenant,
                customerKey,
                normalizedPromoPhone,
                normalizedPromoPhone
              ).first<{ cnt?: number }>();
            } catch (fallbackErr) {
              const fbMsg = String((fallbackErr as Error)?.message ?? '').toLowerCase();
              if (fbMsg.includes('no such column') && redemptionTenant === 'default') {
                try {
                  perCustRow = await db.prepare(
                    `SELECT COUNT(*) AS cnt
                     FROM promotion_redemptions
                     WHERE (UPPER(code) = ? OR promotion_id = ?)
                       AND (customer_id = ? OR (? != '' AND customer_id = ?))`
                  ).bind(
                    String(promo.code || '').toUpperCase(),
                    String(promo.id ?? promo.code ?? ''),
                    customerKey,
                    normalizedPromoPhone,
                    normalizedPromoPhone
                  ).first<{ cnt?: number }>();
                } catch (legacyErr) {
                  const legMsg = String((legacyErr as Error)?.message ?? '').toLowerCase();
                  if (!legMsg.includes('no such table')) {
                    return errorResponse('Không thể kiểm tra giới hạn khuyến mãi, vui lòng thử lại', 503);
                  }
                }
              } else if (!fbMsg.includes('no such table')) {
                return errorResponse('Không thể kiểm tra giới hạn khuyến mãi, vui lòng thử lại', 503);
              }
            }
          } else {
            return errorResponse('Không thể kiểm tra giới hạn khuyến mãi, vui lòng thử lại', 503);
          }
        }
        if (Number(perCustRow?.cnt ?? 0) >= perCustomerLimit) {
          return errorResponse('Bạn đã sử dụng hết lượt cho mã khuyến mãi này', 400);
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
      const maxDiscount = promo.max_discount ?? promo.max_discount_value ?? (isWelcome ? 30000 : null);
      const cappedDisc = maxDiscount != null && Number(maxDiscount) > 0 ? Math.min(rawDiscount, Number(maxDiscount)) : rawDiscount;
      snapshot.discount = Math.min(snapshot.subtotal, Math.max(0, cappedDisc));
      snapshot.total = Math.max(0, snapshot.subtotal - snapshot.discount) + (snapshot.service_fee ?? 0) + snapshot.shipping_fee + snapshot.tip_amount;
      appliedPromo = {
        id: promo.id ?? promo.code,
        code: promo.code,
        discountAmount: snapshot.discount,
        reservedInPlace,
        customerKey: resolvedCustomerId || normalizedPromoPhone || null,
        normalizedPromoPhone,
        perCustomerLimit: Number.isFinite(perCustomerLimit) && perCustomerLimit > 0 ? perCustomerLimit : 0,
      };
      }
    }
    // Redeem customer loyalty points atomically (1 point = 100 VND => 100 points = 10,000 VND)
    const rawRequestedPoints = Math.max(0, Math.floor(Number(data.redeem_points ?? data.loyalty_points_redeemed ?? 0)));
    let redeemedPoints = 0;
    let appliedCashback = 0;
    let cashbackWalletId: string | null = null;
    let cashbackBalanceAfter = 0;

    const rollbackPreOrderReservations = async () => {
      if (appliedLoyaltyVoucher) {
        await rollbackLoyaltyVoucherReservation(db, appliedLoyaltyVoucher, orderId);
        appliedLoyaltyVoucher = null;
      }
      if (appliedCashback > 0 && cashbackWalletId) {
        const walletTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
        await db.prepare(
          "UPDATE cashback_wallets SET balance = balance + ?, total_spent = CASE WHEN COALESCE(total_spent, 0) >= ? THEN total_spent - ? ELSE 0 END, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(appliedCashback, appliedCashback, appliedCashback, now, cashbackWalletId, walletTenant).run().catch(async () => {
          if (walletTenant === 'default') {
            await db.prepare(
              'UPDATE cashback_wallets SET balance = balance + ?, total_spent = CASE WHEN COALESCE(total_spent, 0) >= ? THEN total_spent - ? ELSE 0 END, updated_at = ? WHERE id = ?'
            ).bind(appliedCashback, appliedCashback, appliedCashback, now, cashbackWalletId).run().catch(() => {});
          }
        });
        appliedCashback = 0;
      }
      if (redeemedPoints > 0 && resolvedCustomerId) {
        const loyaltyTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
        await db.prepare(
          "UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(redeemedPoints, resolvedCustomerId, loyaltyTenant).run().catch(async () => {
          if (loyaltyTenant === 'default') {
            await db.prepare('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?')
              .bind(redeemedPoints, resolvedCustomerId).run().catch(() => {});
          }
        });
        redeemedPoints = 0;
      }
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
        appliedPromo.reservedInPlace = false;
      }
    };

    if (rawRequestedPoints > 0) {
      if (!resolvedCustomerId) {
        await rollbackPreOrderReservations();
        return errorResponse('Cần xác định tài khoản khách hàng thành viên để đổi điểm thưởng', 400);
      }
      if (ownership.resolvedVia === 'staff_override' || ownership.resolvedVia === 'deterministic_identifier') {
        const pointsActorRole = String(actor?.role ?? '').trim().toLowerCase();
        const allowedPointsStaffRoles = ['staff', 'cashier', 'waiter', 'barista', 'supervisor', 'manager', 'admin', 'owner'];
        if (!allowedPointsStaffRoles.includes(pointsActorRole)) {
          await rollbackPreOrderReservations();
          return errorResponse('Không có quyền đổi điểm thưởng thay cho khách hàng', 403);
        }
      }
      const remainingPayable = Math.max(0, snapshot.subtotal - snapshot.discount);
      const maxSubtotalRedeemVnd = Math.floor(snapshot.subtotal * 0.5);
      const maxRedeemablePoints = Math.floor(Math.min(remainingPayable, maxSubtotalRedeemVnd) / 100);
      const candidatePoints = Math.min(rawRequestedPoints, maxRedeemablePoints);
      if (candidatePoints > 0) {
        const loyaltyTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
        let deductRes: { meta?: { changes?: number } } | null = null;
        try {
          deductRes = await db.prepare(
            "UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ? AND COALESCE(loyalty_points, 0) >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(candidatePoints, resolvedCustomerId, candidatePoints, loyaltyTenant).run();
        } catch {
          if (loyaltyTenant === 'default') {
            deductRes = await db.prepare(
              'UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ? AND COALESCE(loyalty_points, 0) >= ?'
            ).bind(candidatePoints, resolvedCustomerId, candidatePoints).run();
          }
        }
        if ((deductRes?.meta?.changes ?? 0) < 1) {
          await rollbackPreOrderReservations();
          return errorResponse('Số điểm thưởng hiện tại không đủ để quy đổi cho đơn hàng này', 400);
        }
        redeemedPoints = candidatePoints;
        const pointsDiscountVnd = redeemedPoints * 100;
        snapshot.discount = Math.min(snapshot.subtotal, snapshot.discount + pointsDiscountVnd);
        snapshot.total = Math.max(0, snapshot.subtotal - snapshot.discount) + (snapshot.service_fee ?? 0) + snapshot.shipping_fee + snapshot.tip_amount;
      }
    }
    // Atomic cashback wallet deduction (Checkout & POS)
    const rawCashbackRequested = Math.max(0, Math.floor(Number(data.cashback_amount ?? 0)));
    const wantCashback = Boolean(data.use_cashback) || rawCashbackRequested > 0;
    if (wantCashback) {
      if (!resolvedCustomerId) {
        await rollbackPreOrderReservations();
        return errorResponse('Cần xác định tài khoản khách hàng thành viên để sử dụng ví hoàn tiền', 400);
      }
      if (ownership.resolvedVia === 'staff_override' || ownership.resolvedVia === 'deterministic_identifier') {
        const cashbackActorRole = String(actor?.role ?? '').trim().toLowerCase();
        const allowedCashbackStaffRoles = ['staff', 'cashier', 'waiter', 'barista', 'supervisor', 'manager', 'admin', 'owner'];
        if (!allowedCashbackStaffRoles.includes(cashbackActorRole)) {
          await rollbackPreOrderReservations();
          return errorResponse('Không có quyền sử dụng ví hoàn tiền thay cho khách hàng', 403);
        }
      }
      const walletTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
      const walletRow = await db.prepare(
        "SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(resolvedCustomerId, walletTenant).first<{ id: string; balance: number }>().catch(() =>
        walletTenant === 'default'
          ? db.prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ? LIMIT 1')
              .bind(resolvedCustomerId).first<{ id: string; balance: number }>().catch(() => null)
          : null
      );
      const availableBalance = Math.max(0, Math.floor(Number(walletRow?.balance ?? 0)));
      const remainingPayable = Math.max(0, snapshot.total);
      let desiredCashback = rawCashbackRequested > 0
        ? Math.min(rawCashbackRequested, availableBalance, remainingPayable)
        : Math.min(availableBalance, remainingPayable);
      if (rawCashbackRequested > availableBalance) {
        await rollbackPreOrderReservations();
        return errorResponse('Số dư ví hoàn tiền không đủ', 400);
      }
      if (validatedMethod === 'payos' && desiredCashback > 0) {
        const postCashbackTotal = remainingPayable - desiredCashback;
        if (postCashbackTotal > 0 && postCashbackTotal < 1000) {
          if (rawCashbackRequested > 0) {
            await rollbackPreOrderReservations();
            return errorResponse('Số tiền còn lại sau khi trừ ví hoàn tiền cho PayOS phải bằng 0đ hoặc tối thiểu 1.000đ', 400);
          }
          desiredCashback = Math.max(0, remainingPayable - 1000);
        }
      }
      if (desiredCashback > 0 && walletRow) {
        let walletDeductRes: { meta?: { changes?: number } } | null = null;
        try {
          walletDeductRes = await db.prepare(
            "UPDATE cashback_wallets SET balance = balance - ?, total_spent = COALESCE(total_spent, 0) + ?, updated_at = ? WHERE id = ? AND balance >= ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(desiredCashback, desiredCashback, now, walletRow.id, desiredCashback, walletTenant).run();
        } catch {
          if (walletTenant === 'default') {
            walletDeductRes = await db.prepare(
              'UPDATE cashback_wallets SET balance = balance - ?, total_spent = COALESCE(total_spent, 0) + ?, updated_at = ? WHERE id = ? AND balance >= ?'
            ).bind(desiredCashback, desiredCashback, now, walletRow.id, desiredCashback).run().catch(() => null);
          }
        }
        if ((walletDeductRes?.meta?.changes ?? 0) < 1) {
          await rollbackPreOrderReservations();
          return errorResponse('Số dư ví hoàn tiền không đủ hoặc vừa thay đổi, vui lòng thử lại', 409);
        }
        appliedCashback = desiredCashback;
        cashbackWalletId = walletRow.id;
        cashbackBalanceAfter = Math.max(0, availableBalance - appliedCashback);
        snapshot.discount = snapshot.discount + appliedCashback;
        snapshot.total = Math.max(0, snapshot.total - appliedCashback);
      }
    }
    if (validatedMethod === 'payos' && snapshot.total > 0 && snapshot.total < 1000) {
      await rollbackPreOrderReservations();
      return errorResponse('Số tiền còn lại cho PayOS phải bằng 0đ hoặc tối thiểu 1.000đ', 400);
    }
    const effectiveShiftTenant =
      tenantId && tenantId.trim() && tenantId !== '*' && tenantId.trim().toLowerCase() !== 'hq'
        ? tenantId.trim()
        : 'default';
    let settledPayNow = false;
    let payNowShift: CashCollectingShift | null = null;
    let cashTenderedAmount: number | undefined;
    let changeDueAmount: number | undefined;

    if (validatedMethod === 'cod') {
      if (data.cash_tendered !== undefined && snapshot.total > 0 && data.cash_tendered < snapshot.total) {
        await rollbackPreOrderReservations();
        return errorResponse('Số tiền khách đưa nhỏ hơn tổng thanh toán', 400);
      }
      if (data.pay_now === true && snapshot.total > 0) {
        const payNowActorRole = String(actor?.role ?? '').trim().toLowerCase();
        const isAllowedPayNowStaff = Boolean(
          actor?.id &&
            ['owner', 'admin', 'manager', 'supervisor', 'cashier', 'waiter', 'staff'].includes(payNowActorRole),
        );
        if (!isAllowedPayNowStaff) {
          await rollbackPreOrderReservations();
          return errorResponse('Chỉ nhân viên thu ngân mới được xác nhận thu tiền mặt ngay khi tạo đơn', 403);
        }
        let collecting: { shift: CashCollectingShift | null; hasShifts: boolean };
        try {
          collecting = await resolveCashCollectingShift(db, String(actor!.id), effectiveShiftTenant);
        } catch {
          await rollbackPreOrderReservations();
          return errorResponse('Collecting shift schema requires reconciliation', 409);
        }
        if (collecting.shift) {
          payNowShift = collecting.shift;
          settledPayNow = true;
        } else if (!collecting.hasShifts) {
          settledPayNow = true;
        } else {
          const reconActive = await isCashReconciliationActiveForTenant(env, db, effectiveShiftTenant);
          if (reconActive) {
            await rollbackPreOrderReservations();
            return jsonResponse(
              {
                success: false,
                code: 'SHIFT_REQUIRED_FOR_CASH',
                error: 'Cần mở ca làm việc trước khi thu tiền mặt tại quầy (SHIFT_REQUIRED_FOR_CASH)',
              },
              409,
            );
          }
        }
        if (settledPayNow) {
          cashTenderedAmount = data.cash_tendered !== undefined ? Math.round(data.cash_tendered) : snapshot.total;
          changeDueAmount = Math.max(0, cashTenderedAmount - snapshot.total);
        }
      } else if (snapshot.total === 0 && data.cash_tendered !== undefined) {
        cashTenderedAmount = Math.round(data.cash_tendered);
        changeDueAmount = Math.max(0, cashTenderedAmount);
      }
    }

    const initialPaymentStatus: 'paid' | 'unpaid' = snapshot.total === 0 || settledPayNow ? 'paid' : 'unpaid';
    const rawIncomingOrderNumber =
      typeof (data as Record<string, unknown>).order_number === 'string'
        ? String((data as Record<string, unknown>).order_number).trim()
        : '';
    const orderNumber = rawIncomingOrderNumber || generateOrderNumber();
    const guestOrderToken = !resolvedCustomerId ? generateOrderToken() : null;
    const guestTokenHash = guestOrderToken ? await hashOrderToken(guestOrderToken) : null;
    const responseBody = {
      success: true, data: {
        id: orderId, order_number: orderNumber, status: 'pending', payment_status: initialPaymentStatus, items: snapshot.items, total: snapshot.total,
        customer: { full_name: data.customer_name, phone: data.customer_phone, address: data.customer_address || null },
        customer_name: data.customer_name, customer_phone: data.customer_phone,
        customer_address: data.customer_address || null, payment_method: validatedMethod,
        ...(validatedMethod === 'cod' ? { is_cod: 1 } : {}),
        ...(settledPayNow ? { cod_paid_at: now } : {}),
        ...(cashTenderedAmount !== undefined ? { cash_tendered: cashTenderedAmount } : {}),
        ...(changeDueAmount !== undefined ? { change_due: changeDueAmount } : {}),
        shipping_fee: snapshot.shipping_fee, discount: snapshot.discount,
        ...(redeemedPoints > 0 ? { loyalty_points_redeemed: redeemedPoints } : {}),
        ...(appliedCashback > 0 ? { cashback_used: appliedCashback } : {}),
        ...(appliedLoyaltyVoucher ? { loyalty_voucher_code: appliedLoyaltyVoucher.code } : {}),
        notes: data.notes || null,
        delivery_time: data.delivery_time || 'now', table_id: resolvedTableId, order_type: orderType, created_at: now,
      },
      ...(guestOrderToken ? { order_token: guestOrderToken } : {}),
      message: 'Order created successfully',
    };
    const statements: D1PreparedStatement[] = [];
    const noGuestHashStatements: D1PreparedStatement[] = [];
    const legacyStatements: D1PreparedStatement[] = [];
    if (idem) {
      const idemSql = `INSERT INTO order_creation_requests
        (scope_key, fingerprint, order_id, response_body, created_at) VALUES (?, ?, ?, ?, ?)`;
      const idemArgs = [idem.key, idem.fingerprint, orderId, JSON.stringify(responseBody), now] as const;
      statements.push(db.prepare(idemSql).bind(...idemArgs));
      noGuestHashStatements.push(db.prepare(idemSql).bind(...idemArgs));
      legacyStatements.push(db.prepare(idemSql).bind(...idemArgs));
    }
    const extraOrderCols: string[] = [];
    const extraOrderVals: unknown[] = [];
    if (validatedMethod === 'cod') {
      extraOrderCols.push('is_cod');
      extraOrderVals.push(1);
    }
    if (settledPayNow) {
      extraOrderCols.push('cod_paid_at');
      extraOrderVals.push(now);
    }
    const loyaltyExtraOrderCols: string[] = [];
    const loyaltyExtraOrderVals: unknown[] = [];
    if (redeemedPoints > 0) {
      extraOrderCols.push('loyalty_points_redeemed');
      extraOrderVals.push(redeemedPoints);
      loyaltyExtraOrderCols.push('loyalty_points_redeemed');
      loyaltyExtraOrderVals.push(redeemedPoints);
    }
    if (appliedCashback > 0) {
      extraOrderCols.push('cashback_used');
      extraOrderVals.push(appliedCashback);
      loyaltyExtraOrderCols.push('cashback_used');
      loyaltyExtraOrderVals.push(appliedCashback);
    }
    extraOrderCols.push('subtotal', 'discount_amount');
    extraOrderVals.push(snapshot.subtotal, snapshot.discount);
    const persistedPromoCode = typeof data.promo_code === 'string' ? data.promo_code.trim().toUpperCase() : '';
    if (persistedPromoCode) {
      extraOrderCols.push('promo_code');
      extraOrderVals.push(persistedPromoCode);
    }
    const extraColSql = extraOrderCols.length > 0 ? `, ${extraOrderCols.join(', ')}` : '';
    const extraPhSql = extraOrderCols.length > 0 ? `, ${extraOrderCols.map(() => '?').join(', ')}` : '';
    const loyaltyExtraColSql = loyaltyExtraOrderCols.length > 0 ? `, ${loyaltyExtraOrderCols.join(', ')}` : '';
    const loyaltyExtraPhSql = loyaltyExtraOrderCols.length > 0 ? `, ${loyaltyExtraOrderCols.map(() => '?').join(', ')}` : '';
    const orderInsertSql = `INSERT INTO orders (
      id, items, total, status, customer_name, customer_phone,
      customer_email, customer_address, payment_method, payment_status,
      shipping_fee, discount${extraColSql}, notes, delivery_time, table_id,
      order_type, tip_amount, service_fee, customer_id, guest_token_hash, tenant_id, created_at, updated_at, order_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${extraPhSql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const orderInsertArgs = [
      orderId, snapshot.itemsJson, snapshot.total, 'pending', data.customer_name, data.customer_phone,
      data.customer_email || null, data.customer_address || null, validatedMethod, initialPaymentStatus,
      snapshot.shipping_fee, snapshot.discount, ...extraOrderVals, data.notes || null, data.delivery_time || 'now', resolvedTableId,
      orderType, snapshot.tip_amount, snapshot.service_fee, resolvedCustomerId, guestTokenHash, tenantId, now, now, orderNumber,
    ];
    const orderInsertNoGuestSql = `INSERT INTO orders (
      id, items, total, status, customer_name, customer_phone,
      customer_email, customer_address, payment_method, payment_status,
      shipping_fee, discount${loyaltyExtraColSql}, notes, delivery_time, table_id,
      order_type, tip_amount, service_fee, customer_id, tenant_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${loyaltyExtraPhSql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const orderInsertNoGuestArgs = [
      orderId, snapshot.itemsJson, snapshot.total, 'pending', data.customer_name, data.customer_phone,
      data.customer_email || null, data.customer_address || null, validatedMethod, initialPaymentStatus,
      snapshot.shipping_fee, snapshot.discount, ...loyaltyExtraOrderVals, data.notes || null, data.delivery_time || 'now', resolvedTableId,
      orderType, snapshot.tip_amount, snapshot.service_fee, resolvedCustomerId, tenantId, now, now,
    ];
    const orderInsertLegacySql = `INSERT INTO orders (
      id, items, total, status, customer_name, customer_phone,
      customer_email, customer_address, payment_method, payment_status,
      shipping_fee, discount${loyaltyExtraColSql}, notes, delivery_time, table_id,
      order_type, tip_amount, service_fee, customer_id, tenant_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${loyaltyExtraPhSql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const orderInsertLegacyArgs = [
      orderId, snapshot.itemsJson, snapshot.total, 'pending', data.customer_name, data.customer_phone,
      data.customer_email || null, data.customer_address || null, validatedMethod, initialPaymentStatus,
      snapshot.shipping_fee, snapshot.discount, ...loyaltyExtraOrderVals, data.notes || null, data.delivery_time || 'now', resolvedTableId,
      orderType, snapshot.tip_amount, snapshot.service_fee, resolvedCustomerId, tenantId, now, now,
    ] as const;
    statements.push(db.prepare(orderInsertSql).bind(...orderInsertArgs));
    noGuestHashStatements.push(db.prepare(orderInsertNoGuestSql).bind(...orderInsertNoGuestArgs));
    legacyStatements.push(db.prepare(orderInsertLegacySql).bind(...orderInsertLegacyArgs));
    if (redeemedPoints > 0 && resolvedCustomerId) {
      const loyaltyTxId = generateId('LTX_');
      const loyaltyTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
      const loyaltyDesc = `Đổi ${redeemedPoints} điểm giảm ${(redeemedPoints * 100).toLocaleString('vi-VN')}đ cho đơn ${orderId}`;
      const scopedLoyaltyStmt = db.prepare(
        `INSERT INTO loyalty_transactions (id, customer_id, order_id, points, type, description, idempotency_key, tenant_id, created_at)
         VALUES (?, ?, ?, ?, 'redeem', ?, ?, ?, ?)`
      ).bind(loyaltyTxId, resolvedCustomerId, orderId, -redeemedPoints, loyaltyDesc, `redeem:${orderId}`, loyaltyTenant, now);
      statements.push(scopedLoyaltyStmt);
      noGuestHashStatements.push(scopedLoyaltyStmt);
      legacyStatements.push(
        db.prepare(
          `INSERT INTO loyalty_transactions (id, customer_id, order_id, points, type, description, created_at)
           VALUES (?, ?, ?, ?, 'redeem', ?, ?)`
        ).bind(loyaltyTxId, resolvedCustomerId, orderId, -redeemedPoints, loyaltyDesc, now)
      );
    }
    if (appliedCashback > 0 && resolvedCustomerId && cashbackWalletId) {
      const cbTxId = generateId('CBTX_');
      const walletTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
      const cbDesc = `Thanh toán bằng ví hoàn tiền cho đơn ${orderId}`;
      const scopedCbStmt = db.prepare(
        `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, description, tenant_id, created_at)
         VALUES (?, ?, ?, ?, 'spend', ?, ?, ?, ?, ?)`
      ).bind(cbTxId, cashbackWalletId, resolvedCustomerId, orderId, -appliedCashback, cashbackBalanceAfter, cbDesc, walletTenant, now);
      statements.push(scopedCbStmt);
      noGuestHashStatements.push(scopedCbStmt);
      legacyStatements.push(
        db.prepare(
          `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, description, created_at)
           VALUES (?, ?, ?, ?, 'spend', ?, ?, ?, ?)`
        ).bind(cbTxId, cashbackWalletId, resolvedCustomerId, orderId, -appliedCashback, cashbackBalanceAfter, cbDesc, now)
      );
    }
    for (const item of snapshot.items) {
      const itemId = generateId('ITEM_');
      const modifiersJson = JSON.stringify(item.modifiers || []);
      const legacyItemStmt = db.prepare(`INSERT INTO order_items
        (id, order_id, product_id, quantity, subtotal, modifiers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(itemId, orderId, item.menuItemId, item.quantity, item.subtotalCents,
          modifiersJson, now);
      if (tenantId === 'default') {
        statements.push(legacyItemStmt);
        noGuestHashStatements.push(legacyItemStmt);
      } else {
        const scopedItemStmt = db.prepare(`INSERT INTO order_items
          (id, order_id, product_id, quantity, subtotal, modifiers, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(itemId, orderId, item.menuItemId, item.quantity, item.subtotalCents,
            modifiersJson, now, tenantId);
        statements.push(scopedItemStmt);
        noGuestHashStatements.push(scopedItemStmt);
      }
      legacyStatements.push(legacyItemStmt);
    }
    let settledPayNowPaymentId: string | null = null;
    if (validatedMethod === 'cod' && snapshot.total > 0) {
      const payId = generateId('PAY_');
      const codPayStatus = settledPayNow ? 'completed' : 'pending';
      const scopedPayStmt = db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(payId, orderId, 'cod', snapshot.total, codPayStatus, tenantId, now, now);
      statements.push(scopedPayStmt);
      noGuestHashStatements.push(scopedPayStmt);
      legacyStatements.push(db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(payId, orderId, 'cod', snapshot.total, codPayStatus, now, now));
      if (settledPayNow && payNowShift && actor?.id) {
        settledPayNowPaymentId = payId;
        const attrStmt = db
          .prepare(
            `INSERT INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(payId, effectiveShiftTenant, payNowShift.id, actor.id, now);
        const shiftSalesStmt = db
          .prepare(
            `UPDATE staff_shifts
             SET cash_sales = COALESCE(cash_sales, 0) + ?,
                 total_sales = COALESCE(total_sales, 0) + ?,
                 order_count = COALESCE(order_count, 0) + 1
             WHERE CAST(id AS TEXT) = ? AND staff_id = ? AND clock_in = ? AND clock_out IS NULL
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
               AND NOT EXISTS (
                 SELECT 1 FROM shift_reconciliations r
                 WHERE r.shift_id = ?
                   AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?
               )`,
          )
          .bind(
            snapshot.total,
            snapshot.total,
            payNowShift.id,
            actor.id,
            payNowShift.clock_in,
            effectiveShiftTenant,
            payNowShift.id,
            effectiveShiftTenant,
          );
        statements.push(attrStmt, assertCashSettlementWrite(db), shiftSalesStmt, assertCashSettlementWrite(db));
        noGuestHashStatements.push(attrStmt, assertCashSettlementWrite(db), shiftSalesStmt, assertCashSettlementWrite(db));
      }
    }
    if (appliedPromo) {
      // The redemption ledger row commits atomically with the order; order_id UNIQUE makes it replay-safe.
      const redemptionTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
      const scopedPromoStmt = db.prepare(
        `INSERT INTO promotion_redemptions
          (promotion_id, code, order_id, customer_id, discount_amount, order_total, tenant_id, redeemed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(appliedPromo.id, appliedPromo.code, orderId, resolvedCustomerId ?? appliedPromo.customerKey ?? null,
        appliedPromo.discountAmount, snapshot.subtotal, redemptionTenant, now);
      statements.push(scopedPromoStmt);
      noGuestHashStatements.push(scopedPromoStmt);
      legacyStatements.push(db.prepare(
        'INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(appliedPromo.id, appliedPromo.code, orderId, appliedPromo.discountAmount, snapshot.subtotal, now));
    }
    if (resolvedTableId) {
      const tblClause = tenantId === 'default'
        ? "AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : 'AND (tenant_id = ? OR TRIM(tenant_id) = ?2)';
      const tableOccupySql = `UPDATE cafe_tables SET status = 'Occupied' WHERE id = ? ${tblClause} AND LOWER(TRIM(COALESCE(status, ''))) = 'available'`;
      statements.push(db.prepare(tableOccupySql).bind(resolvedTableId, tenantId));
      noGuestHashStatements.push(db.prepare(tableOccupySql).bind(resolvedTableId, tenantId));
      legacyStatements.push(db.prepare(tableOccupySql).bind(resolvedTableId, tenantId));
    }
    try {
      try {
        await db.batch(statements);
      } catch (batchErr) {
        const msg = String((batchErr as Error)?.message ?? '');
        if (msg.includes('guest_token_hash')) {
          try {
            await db.batch(noGuestHashStatements);
          } catch (subErr) {
            const subMsg = String((subErr as Error)?.message ?? '');
            if ((subMsg.includes('tenant_id') || subMsg.includes('customer_id') || subMsg.includes('order_number') || subMsg.includes('no column named')) && (tenantId === 'default' || tenantId === '*' || subMsg.includes('order_items') || subMsg.includes('order_number'))) {
              await db.batch(legacyStatements);
            } else {
              throw subErr;
            }
          }
        } else if (
          !payNowShift &&
          (msg.includes('tenant_id') || msg.includes('customer_id') || msg.includes('order_number') || msg.includes('is_cod') || msg.includes('no column named') || msg.includes('no such column')) &&
          (tenantId === 'default' || tenantId === '*' || msg.includes('order_items') || msg.includes('order_number') || msg.includes('is_cod'))
        ) {
          await db.batch(legacyStatements);
        } else {
          throw batchErr;
        }
      }
      if (appliedPromo?.perCustomerLimit && appliedPromo.perCustomerLimit > 0 && appliedPromo.customerKey) {
        const redemptionTenant = tenantId === '*' ? 'default' : (tenantId || 'default');
        const promoCodeUpper = String(appliedPromo.code || '').toUpperCase();
        const promoIdStr = String(appliedPromo.id || '');
        const rollbackCommittedOrder = async () => {
          await db.prepare('DELETE FROM order_creation_requests WHERE order_id = ?').bind(orderId).run().catch(() => {});
          await db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderId).run().catch(() => {});
          if (settledPayNowPaymentId && payNowShift) {
            await db.prepare('DELETE FROM cash_payment_attributions WHERE payment_id = ?').bind(settledPayNowPaymentId).run().catch(() => {});
            await db.prepare(
              `UPDATE staff_shifts
               SET cash_sales = MAX(0, COALESCE(cash_sales, 0) - ?),
                   total_sales = MAX(0, COALESCE(total_sales, 0) - ?),
                   order_count = MAX(0, COALESCE(order_count, 0) - 1)
               WHERE CAST(id AS TEXT) = ?
                 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            ).bind(snapshot.total, snapshot.total, payNowShift.id, effectiveShiftTenant).run().catch(() => {});
          }
          await db.prepare('DELETE FROM payments WHERE order_id = ?').bind(orderId).run().catch(() => {});
          await db.prepare('DELETE FROM loyalty_transactions WHERE order_id = ?').bind(orderId).run().catch(() => {});
          await db.prepare('DELETE FROM cashback_transactions WHERE order_id = ?').bind(orderId).run().catch(() => {});
          await db.prepare('DELETE FROM promotion_redemptions WHERE order_id = ?').bind(orderId).run().catch(() => {});
          await db.prepare('DELETE FROM orders WHERE id = ?').bind(orderId).run().catch(() => {});
          if (resolvedTableId) {
            await db.prepare(
              `UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Occupied'
               AND NOT EXISTS (SELECT 1 FROM orders WHERE table_id = ? AND status NOT IN ('completed', 'cancelled', 'failed'))`
            ).bind(resolvedTableId, resolvedTableId).run().catch(() => {});
          }
          await rollbackPreOrderReservations();
        };
        const promoPhone = appliedPromo.normalizedPromoPhone || '';
        let postCountRow: { cnt?: number } | null = null;
        try {
          postCountRow = await db.prepare(
            `SELECT COUNT(*) AS cnt
             FROM promotion_redemptions pr
             LEFT JOIN orders o ON o.id = pr.order_id
             WHERE (UPPER(pr.code) = ? OR pr.promotion_id = ?)
               AND COALESCE(NULLIF(TRIM(pr.tenant_id), ''), 'default') = ?
               AND (
                 pr.customer_id = ?
                 OR (? != '' AND pr.customer_id = ?)
                 OR (? != '' AND (
                   o.customer_phone = ?
                   OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', '') = ?
                   OR (
                     REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', '') LIKE '84%'
                     AND '0' || SUBSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(o.customer_phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', ''), 3) = ?
                   )
                 ))
               )
               AND (o.status IS NULL OR o.status NOT IN ('cancelled', 'failed'))
               AND pr.rowid <= COALESCE(
                 (SELECT pr_self.rowid FROM promotion_redemptions pr_self WHERE pr_self.order_id = ? ORDER BY pr_self.rowid ASC LIMIT 1),
                 9223372036854775807
               )`
          ).bind(
            promoCodeUpper,
            promoIdStr,
            redemptionTenant,
            appliedPromo.customerKey,
            promoPhone,
            promoPhone,
            promoPhone,
            promoPhone,
            promoPhone,
            promoPhone,
            orderId
          )
            .first<{ cnt?: number }>();
        } catch (joinErr) {
          const joinMsg = joinErr instanceof Error ? joinErr.message : String(joinErr);
          if (/no such column|no such table/i.test(joinMsg)) {
            try {
              postCountRow = await db.prepare(
                `SELECT COUNT(*) AS cnt
                 FROM promotion_redemptions pr
                 WHERE (UPPER(pr.code) = ? OR pr.promotion_id = ?)
                   AND COALESCE(NULLIF(TRIM(pr.tenant_id), ''), 'default') = ?
                   AND (pr.customer_id = ? OR (? != '' AND pr.customer_id = ?))
                   AND pr.rowid <= COALESCE(
                     (SELECT pr_self.rowid FROM promotion_redemptions pr_self WHERE pr_self.order_id = ? ORDER BY pr_self.rowid ASC LIMIT 1),
                     9223372036854775807
                   )`
              ).bind(promoCodeUpper, promoIdStr, redemptionTenant, appliedPromo.customerKey, promoPhone, promoPhone, orderId)
                .first<{ cnt?: number }>();
            } catch (fallbackErr) {
              const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              if (!/no such table/i.test(fbMsg)) {
                await rollbackCommittedOrder();
                return errorResponse('Không thể xác minh giới hạn sử dụng mã khuyến mãi', 503);
              }
            }
          } else {
            await rollbackCommittedOrder();
            return errorResponse('Không thể xác minh giới hạn sử dụng mã khuyến mãi', 503);
          }
        }
        if (postCountRow && Number(postCountRow.cnt ?? 0) > appliedPromo.perCustomerLimit) {
          await rollbackCommittedOrder();
          return errorResponse('Bạn đã sử dụng hết lượt cho mã khuyến mãi này', 400);
        }
      }
    }
    catch (error) {
      await rollbackPreOrderReservations();
      if (/integer overflow/i.test(String(error))) {
        return errorResponse('Ca làm việc vừa đóng hoặc đã đối soát; vui lòng làm mới và thử lại', 409);
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
    }
    const orderEventTenant =
      tenantId && tenantId.trim() && tenantId !== '*' && tenantId.trim().toLowerCase() !== 'hq'
        ? tenantId.trim()
        : 'default';
    await publishOrderEvent(env.AUTH_KV as KVNamespace | undefined, orderId, 'pending', {
      tenantId: orderEventTenant,
      paymentStatus: initialPaymentStatus,
    });
    // Notifications and cache writes run only after commit and cannot turn success into a retryable 500.
    try {
      if (env.ORDER_BROADCASTER) {
        const doTenant = tenantId && tenantId.trim() && tenantId !== '*' && tenantId.trim().toLowerCase() !== 'hq'
          ? tenantId.trim()
          : 'default';
        const event = {
          orderId, order_number: orderNumber, status: 'pending', payment_status: initialPaymentStatus, items: snapshot.items, total: snapshot.total,
          customer_name: data.customer_name, customer_phone: data.customer_phone, table_id: resolvedTableId,
          order_type: orderType,
          ...(doTenant !== 'default' ? { tenant_id: doTenant } : {}),
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        const broadcast = fanOutOrderBroadcast(env.ORDER_BROADCASTER, orderId, doTenant, event)
          .catch(error => log.warn('Order broadcast failed after commit', { orderId, message: (error as Error).message }));
        if (ctx?.waitUntil) ctx.waitUntil(broadcast); else await broadcast;
      }
      if (settledPayNow && snapshot.total > 0) {
        try {
          const metrics = createMetricsCollector(db);
          const metricTask = Promise.all([
            metrics.recordMetric('payment_success', snapshot.total, { provider: 'cod', order_id: orderId, tenant_id: orderEventTenant }),
            metrics.recordMetric('revenue', snapshot.total, { provider: 'cod', tenant_id: orderEventTenant }),
          ]).catch(() => {});
          if (ctx?.waitUntil) ctx.waitUntil(metricTask);
          else await metricTask;
        } catch {
          // Non-blocking metrics recording
        }
      }
      await runPostOrderSideEffects({
        db, env, ctx, orderId, tenantId, data: { ...data, customer_id: resolvedCustomerId, order_type: orderType }, snapshot, validatedMethod, resolvedTableId, initialPaymentStatus,
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
