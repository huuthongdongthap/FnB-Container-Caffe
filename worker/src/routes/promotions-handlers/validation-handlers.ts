import type { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { validatePromotionSchema, redeemPromotionSchema } from '../../lib/validators';
import { optionalAuth } from '../../middleware/auth';
import { isHQSuperAdmin, matchesTenantRow, resolvePublicTenantId } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import { isPlaceholderPhone } from './helpers';
import type { PromotionCode } from './types';

function getTenantId(c: {
  env: Env;
  req: { header: (k: string) => string | undefined; query?: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): string {
  const user = c.get('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const userTenant = (user?.tenantId || user?.tenant_id || '').trim();
  const role = (user?.role || '').trim().toLowerCase();
  const hq =
    isHQSuperAdmin(c as Parameters<typeof isHQSuperAdmin>[0]) ||
    isHQSuperAdmin(user) ||
    ((role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq'));
  const reqTenant = (
    c.req.query?.('tenant_id') ||
    c.req.query?.('tenantId') ||
    c.req.query?.('store_id') ||
    c.req.query?.('storeId') ||
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Store-ID') ||
    c.req.header('x-store-id') ||
    ''
  ).trim();
  if (hq && reqTenant) {
    return reqTenant === '*' || reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant;
  }
  const raw = resolvePublicTenantId(c as Parameters<typeof resolvePublicTenantId>[0]).trim() || 'default';
  const resolved = raw.toLowerCase() === 'hq' ? '*' : raw;
  if (resolved === '*' && !hq) {
    return 'default';
  }
  return resolved;
}

function hasPromotionTenantMismatch(c: {
  req: { header: (k: string) => string | undefined; query?: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): boolean {
  const user = c.get('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const candidateOverrides = [
    c.req.query?.('tenant_id'),
    c.req.query?.('tenantId'),
    c.req.query?.('store_id'),
    c.req.query?.('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return true;
  }
  const reqTenant = candidateOverrides[0] || '';
  if (!user?.role) {
    return reqTenant === '*' || reqTenant.toLowerCase() === 'hq';
  }
  const userTenant = (user.tenantId || user.tenant_id || '').trim();
  const role = (user.role || '').trim().toLowerCase();
  const hq =
    isHQSuperAdmin(c as Parameters<typeof isHQSuperAdmin>[0]) ||
    isHQSuperAdmin(user) ||
    ((role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq'));
  if (hq) return false;
  const boundTenant = userTenant || 'default';
  if (boundTenant === '*' || boundTenant.toLowerCase() === 'hq') return true;
  if (reqTenant === '*' || reqTenant.toLowerCase() === 'hq') return true;
  if (reqTenant && reqTenant !== boundTenant) return true;
  const ctxTenant = (c.get('tenantId') as string | undefined)?.trim();
  if (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) return true;
  return false;
}

function normalizePhone(phone: string | null | undefined): string {
  return phone ? phone.replace(/[\s\-().]/g, '') : '';
}

function computePromotionDiscountAmount(
  promoRow: Record<string, unknown>,
  orderTotal: number,
  percentFallback: number,
  maxDiscountCap: number,
): number {
  const rawType = String(promoRow.discount_type ?? promoRow.type ?? '').toLowerCase();
  const isFixed = rawType === 'fixed' || rawType === 'fixed_amount' || rawType === 'amount';
  const fixedValue = Number(promoRow.discount_value ?? promoRow.value ?? promoRow.percent ?? 0);
  const rawDiscount = isFixed
    ? Math.max(0, Math.round(fixedValue))
    : Math.max(0, Math.round((orderTotal * percentFallback) / 100));
  const capped = maxDiscountCap > 0 ? Math.min(rawDiscount, maxDiscountCap) : rawDiscount;
  return orderTotal > 0 ? Math.min(capped, orderTotal) : capped;
}

const DEFAULT_WELCOME_PROMO: PromotionCode = {
  id: 'promo_welcome',
  code: 'WELCOME',
  percent: 10,
  max_discount: 30000,
  min_order: 0,
  starts_at: null,
  expires_at: null,
  usage_limit: 0,
  usage_count: 0,
  is_active: 1
};

export async function checkWelcomeNewCustomerEligibility(
  db: D1Database,
  opts: {
    customer_id?: string;
    customer_phone?: string;
    customer_name?: string;
    is_new_customer?: boolean;
    tenant_id?: string;
  }
): Promise<{ eligible: boolean; reason?: string }> {
  if (opts.is_new_customer === false) {
    return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới lần đầu đến quán' };
  }
  const hasCustomerContext = Boolean(opts.customer_id || opts.customer_phone || opts.customer_name !== undefined);
  if (!hasCustomerContext) {
    return { eligible: true };
  }

  const normalizedPhone = normalizePhone(opts.customer_phone);
  if (!opts.customer_id && opts.customer_name !== undefined && (!opts.customer_name.trim() || !normalizedPhone)) {
    return {
      eligible: false,
      reason: 'Mã WELCOME yêu cầu khách hàng mới để lại thông tin đăng ký (họ tên và số điện thoại)'
    };
  }

  const targetTenant = opts.tenant_id && opts.tenant_id !== '*' ? opts.tenant_id : null;

  if (opts.customer_id) {
    try {
      const cust = await db.prepare(
        'SELECT id, total_orders, tenant_id FROM customers WHERE id = ? LIMIT 1'
      ).bind(opts.customer_id).first<{ id: string; total_orders?: number; tenant_id?: string | null }>().catch(() =>
        db.prepare('SELECT id, total_orders FROM customers WHERE id = ? LIMIT 1').bind(opts.customer_id).first<{ id: string; total_orders?: number }>()
      );
      if (cust && (!targetTenant || matchesTenantRow(cust as unknown as Record<string, unknown>, targetTenant)) && Number(cust.total_orders ?? 0) > 0) {
        return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới chưa từng có đơn hàng' };
      }
      const priorOrder = await (targetTenant
        ? db.prepare(
            "SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ? AND status NOT IN ('cancelled', 'failed') AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
          ).bind(opts.customer_id, targetTenant).first<{ cnt?: number }>().catch(() =>
            db.prepare(
              "SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ? AND status NOT IN ('cancelled', 'failed')"
            ).bind(opts.customer_id).first<{ cnt?: number }>()
          )
        : db.prepare(
            "SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ? AND status NOT IN ('cancelled', 'failed')"
          ).bind(opts.customer_id).first<{ cnt?: number }>()
      );
      if (Number(priorOrder?.cnt ?? 0) > 0) {
        return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới chưa từng có đơn hàng' };
      }
    } catch {
      // Partial schema fallback
    }
  }

  if (normalizedPhone) {
    try {
      const custByPhone = await (targetTenant
        ? db.prepare(
            "SELECT id, total_orders, tenant_id FROM customers WHERE phone = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) LIMIT 1"
          ).bind(normalizedPhone, targetTenant).first<{ id: string; total_orders?: number; tenant_id?: string | null }>().catch(() =>
            db.prepare('SELECT id, total_orders FROM customers WHERE phone = ? LIMIT 1').bind(normalizedPhone).first<{ id: string; total_orders?: number }>()
          )
        : db.prepare(
            'SELECT id, total_orders FROM customers WHERE phone = ? LIMIT 1'
          ).bind(normalizedPhone).first<{ id: string; total_orders?: number }>()
      );
      if (custByPhone && (!targetTenant || matchesTenantRow(custByPhone as unknown as Record<string, unknown>, targetTenant)) && Number(custByPhone.total_orders ?? 0) > 0) {
        return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới chưa từng có đơn hàng' };
      }
      const priorByPhone = await (targetTenant
        ? db.prepare(
            "SELECT COUNT(*) AS cnt FROM orders WHERE customer_phone = ? AND status NOT IN ('cancelled', 'failed') AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
          ).bind(normalizedPhone, targetTenant).first<{ cnt?: number }>().catch(() =>
            db.prepare(
              "SELECT COUNT(*) AS cnt FROM orders WHERE customer_phone = ? AND status NOT IN ('cancelled', 'failed')"
            ).bind(normalizedPhone).first<{ cnt?: number }>()
          )
        : db.prepare(
            "SELECT COUNT(*) AS cnt FROM orders WHERE customer_phone = ? AND status NOT IN ('cancelled', 'failed')"
          ).bind(normalizedPhone).first<{ cnt?: number }>()
      );
      if (Number(priorByPhone?.cnt ?? 0) > 0) {
        return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới chưa từng có đơn hàng' };
      }
    } catch {
      // Partial schema fallback
    }
  }

  return { eligible: true };
}

export function registerPromotionValidationHandlers(router: Hono<{ Bindings: Env }>): void {
  // POST /api/promotions/validate — validate discount code
  router.post('/validate', optionalAuth(), async (c) => {
    if (hasPromotionTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
    }
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = validatePromotionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const data = parsed.data;
    const upperCode = data.code.trim().toUpperCase();
    const isWelcome = upperCode === 'WELCOME';

    const tenantId = getTenantId(c);
    let promo = await db.prepare(
      'SELECT * FROM promotions WHERE UPPER(code) = ?'
    ).bind(upperCode).first<PromotionCode & { tenant_id?: string | null }>();

    if (promo && !matchesTenantRow(promo as unknown as Record<string, unknown>, tenantId)) {
      const scoped = tenantId !== '*'
        ? await db.prepare(
            "SELECT * FROM promotions WHERE UPPER(code) = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
          ).bind(upperCode, tenantId).first<PromotionCode & { tenant_id?: string | null }>().catch(() => null)
        : null;
      promo = scoped && matchesTenantRow(scoped as unknown as Record<string, unknown>, tenantId) ? scoped : null;
    }
    if (promo && Number(promo.is_active ?? 1) === 0) {
      promo = null;
    } else if (!promo && isWelcome) {
      promo = DEFAULT_WELCOME_PROMO;
    }

    if (!promo) {
      return c.json({ success: true, data: { valid: false, reason: 'Mã không tồn tại hoặc đã bị vô hiệu hoá' } });
    }

    // Check start date
    if (promo.starts_at && new Date(promo.starts_at) > new Date()) {
      return c.json({ success: true, data: { valid: false, reason: 'Chương trình chưa bắt đầu' } });
    }

    // Check expiration (WELCOME never expires per store policy)
    if (!isWelcome && promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return c.json({ success: true, data: { valid: false, reason: 'Code has expired' } });
    }

    // Check usage limit (WELCOME has no global cap)
    const validatePromoRow = promo as unknown as Record<string, unknown>;
    const validateMaxUses = Math.max(
      Number(promo.usage_limit ?? 0) > 0 ? Number(promo.usage_limit) : 0,
      Number(validatePromoRow.max_uses ?? 0) > 0 ? Number(validatePromoRow.max_uses) : 0,
    );
    const validateCurrentUses = Math.max(
      Number(promo.usage_count ?? 0),
      Number(validatePromoRow.current_uses ?? validatePromoRow.used_count ?? 0),
    );
    if (!isWelcome && validateMaxUses > 0 && validateCurrentUses >= validateMaxUses) {
      return c.json({ success: true, data: { valid: false, reason: 'Mã đã hết lượt sử dụng' } });
    }

    // Check min order
    if (data.order_total !== undefined && data.order_total < promo.min_order) {
      return c.json({
        success: true,
        data: {
          valid: false,
          reason: `Minimum order ${promo.min_order.toLocaleString('vi-VN')}đ required`
        }
      });
    }

    const isWelcomePromo = isWelcome || (promo as { type?: string }).type === 'welcome_new_customer';
    const user = c.get('user' as never) as {
      id?: string;
      sub?: string;
      customerId?: string;
      phone?: string;
      name?: string;
      role?: string;
    } | undefined;
    const validateCustomerId = data.customer_id || user?.customerId || user?.id || user?.sub;

    if (isWelcomePromo) {
      const effectiveCustomerId = validateCustomerId;
      const effectiveCustomerPhone = data.customer_phone || user?.phone;
      const welcomeCheck = await checkWelcomeNewCustomerEligibility(db, {
        customer_id: effectiveCustomerId,
        customer_phone: effectiveCustomerPhone,
        customer_name: data.customer_name,
        is_new_customer: data.is_new_customer,
        tenant_id: tenantId,
      });
      if (!welcomeCheck.eligible) {
        return c.json({
          success: true,
          data: { valid: false, reason: welcomeCheck.reason }
        });
      }
    }

    const validatePerCustomerLimit = Number(
      validatePromoRow.usage_limit_per_customer ?? validatePromoRow.max_uses_per_customer ?? validatePromoRow.per_customer_limit ?? 0
    );
    if (!isWelcome && validatePerCustomerLimit > 0 && validateCustomerId) {
      try {
        const custRedemptions = await db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM promotion_redemptions WHERE (promotion_id = ? OR UPPER(code) = ?) AND customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(promo.id ?? promo.code, upperCode, validateCustomerId, tenantId === '*' ? 'default' : tenantId)
          .first<{ cnt?: number }>()
          .catch(() =>
            db
              .prepare(
                'SELECT COUNT(*) AS cnt FROM promotion_redemptions WHERE (promotion_id = ? OR UPPER(code) = ?) AND customer_id = ?'
              )
              .bind(promo.id ?? promo.code, upperCode, validateCustomerId)
              .first<{ cnt?: number }>()
              .catch(() => null)
          );
        if (Number(custRedemptions?.cnt ?? 0) >= validatePerCustomerLimit) {
          return c.json({
            success: true,
            data: { valid: false, reason: 'Bạn đã hết lượt sử dụng mã này' }
          });
        }
      } catch {
        // Optional column/table in partial schemas
      }
    }

    const promoRow = promo as unknown as Record<string, unknown>;
    const rawPercent = Number(promo.percent ?? promoRow.value ?? promoRow.discount_value ?? 0);
    const percent = isWelcome ? (rawPercent || 10) : rawPercent;
    const rawMaxDiscount = Number(promo.max_discount ?? promoRow.max_discount_value ?? promoRow.max_discount_amount ?? 0);
    const maxDiscount = isWelcome ? (rawMaxDiscount || 30000) : rawMaxDiscount;
    const discountAmount = data.order_total !== undefined
      ? computePromotionDiscountAmount(promoRow, data.order_total, percent, maxDiscount)
      : undefined;

    return c.json({
      success: true,
      data: {
        valid: true,
        code: promo.code,
        percent,
        max_discount: maxDiscount,
        min_order: promo.min_order,
        ...(discountAmount !== undefined ? { discount_amount: discountAmount } : {})
      }
    });
  });

  // POST /api/promotions/redeem — redeem discount code
  router.post('/redeem', optionalAuth(), async (c) => {
    if (hasPromotionTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
    }
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = redeemPromotionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const data = parsed.data;
    const upperCode = data.code.trim().toUpperCase();
    const isWelcome = upperCode === 'WELCOME';

    const tenantId = getTenantId(c);
    let promo = await db.prepare(
      'SELECT * FROM promotions WHERE UPPER(code) = ?'
    ).bind(upperCode).first<PromotionCode & { tenant_id?: string | null; type?: string }>();

    if (promo && !matchesTenantRow(promo as unknown as Record<string, unknown>, tenantId)) {
      const scoped = tenantId !== '*'
        ? await db.prepare(
            "SELECT * FROM promotions WHERE UPPER(code) = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(upperCode, tenantId).first<PromotionCode & { tenant_id?: string | null; type?: string }>().catch(() => null)
        : null;
      promo = scoped && matchesTenantRow(scoped as unknown as Record<string, unknown>, tenantId) ? scoped : null;
    }
    if (promo && Number(promo.is_active ?? 1) === 0) {
      promo = null;
    } else if (!promo && isWelcome) {
      promo = DEFAULT_WELCOME_PROMO;
    }

    if (!promo) {
      return c.json({ success: false, error: 'Invalid code' }, 400);
    }

    if (promo.starts_at && new Date(promo.starts_at) > new Date()) {
      return c.json({ success: false, error: 'Chương trình chưa bắt đầu' }, 400);
    }

    if (!isWelcome && promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return c.json({ success: false, error: 'Code has expired' }, 400);
    }

    const promoRow = promo as unknown as Record<string, unknown>;
    const rawPercent = Number(promo.percent ?? promoRow.value ?? promoRow.discount_value ?? 0);
    const percent = isWelcome ? (rawPercent || 10) : rawPercent;
    const rawMaxDiscount = Number(promo.max_discount ?? promoRow.max_discount_value ?? promoRow.max_discount_amount ?? 0);
    const maxDiscount = isWelcome ? (rawMaxDiscount || 30000) : rawMaxDiscount;
    const minOrder = Number(promo.min_order ?? promoRow.min_order_value ?? promoRow.min_order_amount ?? 0);
    const isWelcomePromo = isWelcome || promo.type === 'welcome_new_customer';

    type RedeemOrderLookupRow = {
      id?: string;
      tenant_id?: string | null;
      status?: string;
      payment_status?: string | null;
      customer_id?: string | null;
      customer_phone?: string | null;
      customer_name?: string | null;
      order_token?: string | null;
      subtotal?: number | null;
      total?: number | null;
      total_amount?: number | null;
    };
    const orderRow = await db.prepare(
      'SELECT id, tenant_id, status, payment_status, customer_id, customer_phone, customer_name, order_token, subtotal, total, total_amount FROM orders WHERE id = ? LIMIT 1'
    ).bind(data.order_id).first<RedeemOrderLookupRow>().catch(() =>
      db.prepare(
        'SELECT id, tenant_id, status, payment_status, customer_id, customer_phone, customer_name, order_token, subtotal, total FROM orders WHERE id = ? LIMIT 1'
      ).bind(data.order_id).first<RedeemOrderLookupRow>().catch(() =>
        db.prepare(
          'SELECT id, tenant_id, status, payment_status, customer_id, customer_phone, customer_name, subtotal, total FROM orders WHERE id = ? LIMIT 1'
        ).bind(data.order_id).first<RedeemOrderLookupRow>().catch(() =>
          db.prepare(
            'SELECT id, tenant_id, status, customer_id, customer_phone, customer_name, subtotal, total FROM orders WHERE id = ? LIMIT 1'
          ).bind(data.order_id).first<RedeemOrderLookupRow>().catch(() =>
            db.prepare(
              'SELECT id, tenant_id, status FROM orders WHERE id = ? LIMIT 1'
            ).bind(data.order_id).first<RedeemOrderLookupRow>().catch(() => null)
          )
        )
      )
    );
    if (orderRow && !matchesTenantRow(orderRow as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const user = c.get('user' as never) as {
      id?: string;
      sub?: string;
      customerId?: string;
      phone?: string;
      name?: string;
      role?: string;
      tenantId?: string;
    } | undefined;
    const isStaffRole = Boolean(
      user?.role && ['owner', 'manager', 'supervisor', 'staff', 'admin', 'superadmin', 'cashier', 'waiter'].includes(String(user.role).toLowerCase())
    );
    const staffTenant = user?.tenantId ? String(user.tenantId).trim() : '';
    const isPrivilegedStaff = isStaffRole && (
      isHQSuperAdmin(c as Parameters<typeof isHQSuperAdmin>[0]) ||
      staffTenant === '*' ||
      !staffTenant ||
      staffTenant === tenantId
    );
    if (isStaffRole && !isPrivilegedStaff) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const disallowedStatuses = ['cancelled', 'completed', 'refunded', 'failed', 'expired'];
    if (orderRow && typeof orderRow.status === 'string' && disallowedStatuses.includes(orderRow.status.trim().toLowerCase())) {
      return c.json({ success: false, error: 'Cannot redeem promotion on an order in its current status' }, 409);
    }
    const disallowedPaymentStatuses = ['paid', 'refunded'];
    if (orderRow && typeof orderRow.payment_status === 'string' && disallowedPaymentStatuses.includes(orderRow.payment_status.trim().toLowerCase())) {
      return c.json({ success: false, error: 'Cannot redeem promotion on a paid or refunded order' }, 409);
    }

    const orderCustomerId = typeof orderRow?.customer_id === 'string' && orderRow.customer_id.trim()
      ? orderRow.customer_id.trim()
      : undefined;
    const rawOrderPhone = typeof orderRow?.customer_phone === 'string' ? orderRow.customer_phone.trim() : '';
    const orderCustomerPhone = rawOrderPhone && !isPlaceholderPhone(rawOrderPhone)
      ? rawOrderPhone
      : undefined;
    const orderCustomerName = typeof orderRow?.customer_name === 'string' && orderRow.customer_name.trim()
      ? orderRow.customer_name.trim()
      : undefined;

    if (!isPrivilegedStaff && orderRow) {
      const ctxCustomerId = (c as unknown as { get?: (k: string) => string | undefined }).get?.('customerId')
        || ((c as unknown as { get?: (k: string) => { id?: string } | undefined }).get?.('customer'))?.id
        || user?.customerId
        || (!isStaffRole ? (user?.sub || user?.id) : undefined);
      const callerIds = [ctxCustomerId, user?.customerId, !isStaffRole ? user?.id : undefined, !isStaffRole ? user?.sub : undefined]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim());
      const rawVerifiedPhone = ((c as unknown as { get?: (k: string) => { phone?: string } | undefined }).get?.('customer'))?.phone
        || (c as unknown as { get?: (k: string) => string | undefined }).get?.('customerPhone')
        || user?.phone;
      const verifiedPhone = rawVerifiedPhone && !isPlaceholderPhone(rawVerifiedPhone)
        ? rawVerifiedPhone.trim()
        : undefined;
      const reqOrderToken = (
        (typeof body?.order_token === 'string' ? body.order_token : '') ||
        c.req.header('x-order-token') ||
        c.req.header('X-Order-Token') ||
        c.req.query('order_token') ||
        ''
      ).trim();
      const hasValidOrderToken = Boolean(
        reqOrderToken && typeof orderRow.order_token === 'string' && orderRow.order_token.trim() === reqOrderToken
      );

      if (orderCustomerId) {
        if (!hasValidOrderToken && (callerIds.length === 0 || !callerIds.includes(orderCustomerId))) {
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
        if (data.customer_id && data.customer_id.trim() !== orderCustomerId) {
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
      }
      if (orderCustomerPhone) {
        const hasMatchingId = Boolean(orderCustomerId && callerIds.includes(orderCustomerId));
        const hasMatchingPhone = Boolean(
          verifiedPhone && normalizePhone(verifiedPhone) === normalizePhone(orderCustomerPhone)
        );
        if (!hasValidOrderToken && !hasMatchingId && !hasMatchingPhone) {
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
        if (data.customer_phone && normalizePhone(data.customer_phone) !== normalizePhone(orderCustomerPhone)) {
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
      }
      if (
        !orderCustomerId &&
        !orderCustomerPhone &&
        orderRow.id === data.order_id &&
        !hasValidOrderToken &&
        ('customer_phone' in orderRow || 'order_token' in orderRow || tenantId !== 'default')
      ) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
    }

    const rawOrderTotalCandidate = orderRow?.subtotal ?? orderRow?.total ?? orderRow?.total_amount;
    const parsedCandidateTotal = Number(rawOrderTotalCandidate);
    const dbSubtotal = Number(orderRow?.subtotal);
    const dbTotal = Number(orderRow?.total);
    const dbTotalAmount = Number(orderRow?.total_amount);
    const dbOrderTotal = Number.isFinite(parsedCandidateTotal) && parsedCandidateTotal > 0
      ? parsedCandidateTotal
      : Number.isFinite(dbSubtotal) && dbSubtotal > 0
        ? dbSubtotal
        : Number.isFinite(dbTotal) && dbTotal > 0
          ? dbTotal
          : Number.isFinite(dbTotalAmount) && dbTotalAmount > 0
            ? dbTotalAmount
            : null;
    const effectiveOrderTotal = dbOrderTotal ?? data.order_total;

    if (minOrder > 0 && effectiveOrderTotal < minOrder) {
      return c.json({
        success: false,
        error: `Minimum order ${minOrder.toLocaleString('vi-VN')}đ required`
      }, 400);
    }

    const effectiveCustomerId = data.customer_id || orderCustomerId || user?.customerId || user?.id || user?.sub;
    const effectiveCustomerPhone = data.customer_phone || orderCustomerPhone || user?.phone;
    const effectiveCustomerName = data.customer_name !== undefined ? data.customer_name : orderCustomerName;

    if (isWelcomePromo) {
      const welcomeCheck = await checkWelcomeNewCustomerEligibility(db, {
        customer_id: effectiveCustomerId,
        customer_phone: effectiveCustomerPhone,
        customer_name: effectiveCustomerName,
        is_new_customer: data.is_new_customer,
        tenant_id: tenantId,
      });
      if (!welcomeCheck.eligible) {
        return c.json({ success: false, error: welcomeCheck.reason || 'Mã WELCOME chỉ áp dụng cho khách hàng mới' }, 400);
      }
    }

    // Idempotent check by order_id after verifying tenant ownership
    try {
      const existingRedemption = await db.prepare(
        'SELECT order_id, discount_amount FROM promotion_redemptions WHERE order_id = ? LIMIT 1'
      ).bind(data.order_id).first<{ order_id?: string; discount_amount?: number }>();
      if (existingRedemption && existingRedemption.order_id === data.order_id && typeof existingRedemption.discount_amount === 'number') {
        return c.json({
          success: true,
          data: {
            code: promo.code,
            percent,
            discount_amount: existingRedemption.discount_amount,
            order_id: data.order_id,
            idempotent: true
          }
        });
      }
    } catch {
      // promotion_redemptions table is optional in partial schemas
    }

    if (!orderRow || !orderRow.id) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const maxUsesLimit = Math.max(
      Number(promo.usage_limit ?? 0) > 0 ? Number(promo.usage_limit) : 0,
      Number(promoRow.max_uses ?? 0) > 0 ? Number(promoRow.max_uses) : 0,
    );
    const currentUsesCount = Math.max(
      Number(promo.usage_count ?? 0),
      Number(promoRow.current_uses ?? promoRow.used_count ?? 0),
    );
    if (!isWelcome && maxUsesLimit > 0 && currentUsesCount >= maxUsesLimit) {
      return c.json({ success: false, error: 'Usage limit reached' }, 400);
    }

    const perCustomerLimit = Number(
      promoRow.usage_limit_per_customer ?? promoRow.max_uses_per_customer ?? promoRow.per_customer_limit ?? 0
    );
    if (!isWelcome && perCustomerLimit > 0 && effectiveCustomerId) {
      try {
        const custRedemptions = await db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM promotion_redemptions WHERE (promotion_id = ? OR UPPER(code) = ?) AND customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(promo.id ?? promo.code, upperCode, effectiveCustomerId, tenantId === '*' ? 'default' : tenantId)
          .first<{ cnt?: number }>()
          .catch(() =>
            db
              .prepare(
                'SELECT COUNT(*) AS cnt FROM promotion_redemptions WHERE (promotion_id = ? OR UPPER(code) = ?) AND customer_id = ?'
              )
              .bind(promo.id ?? promo.code, upperCode, effectiveCustomerId)
              .first<{ cnt?: number }>()
              .catch(() => null)
          );
        if (Number(custRedemptions?.cnt ?? 0) >= perCustomerLimit) {
          return c.json({ success: false, error: 'Per-customer usage limit reached' }, 400);
        }
      } catch {
        // Optional column/table in partial schemas
      }
    }

    const discountAmount = computePromotionDiscountAmount(promoRow, effectiveOrderTotal, percent, maxDiscount);

    // Increment usage with atomic conditional guard
    if (!isWelcome && promo.usage_limit && promo.usage_limit > 0) {
      let usageRes: { meta?: { changes?: number } } | null = null;
      if (promo.id !== undefined && promo.id !== null) {
        if (tenantId !== '*') {
          try {
            usageRes = await db.prepare(
              "UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ? AND (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR TRIM(tenant_id) = ''))) AND (usage_limit IS NULL OR usage_limit = 0 OR COALESCE(usage_count, 0) < usage_limit)"
            ).bind(promo.id, tenantId, tenantId).run();
          } catch {
            try {
              usageRes = await db.prepare(
                "UPDATE promotions SET used_count = COALESCE(used_count, 0) + 1 WHERE id = ? AND (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR TRIM(tenant_id) = '')))"
              ).bind(promo.id, tenantId, tenantId).run();
            } catch {
              if (tenantId === 'default') {
                usageRes = await db.prepare(
                  'UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ? AND (usage_limit IS NULL OR usage_limit = 0 OR COALESCE(usage_count, 0) < usage_limit)'
                ).bind(promo.id).run();
              } else {
                usageRes = { meta: { changes: 0 } };
              }
            }
          }
        } else {
          usageRes = await db.prepare(
            'UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ? AND (usage_limit IS NULL OR usage_limit = 0 OR COALESCE(usage_count, 0) < usage_limit)'
          ).bind(promo.id).run();
        }
      } else if (tenantId !== '*') {
        try {
          usageRes = await db.prepare(
            "UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE code = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND (usage_limit IS NULL OR usage_limit = 0 OR COALESCE(usage_count, 0) < usage_limit)"
          ).bind(promo.code, tenantId).run();
        } catch {
          if (tenantId === 'default') {
            usageRes = await db.prepare(
              'UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE code = ? AND (usage_limit IS NULL OR usage_limit = 0 OR COALESCE(usage_count, 0) < usage_limit)'
            ).bind(promo.code).run();
          } else {
            usageRes = { meta: { changes: 0 } };
          }
        }
      } else {
        usageRes = await db.prepare(
          'UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE code = ? AND (usage_limit IS NULL OR usage_limit = 0 OR COALESCE(usage_count, 0) < usage_limit)'
        ).bind(promo.code).run();
      }
      if ((usageRes?.meta?.changes ?? 1) === 0) {
        return c.json({ success: false, error: 'Usage limit reached' }, 409);
      }
    } else {
      try {
        if (promo.id !== undefined && promo.id !== null) {
          if (tenantId !== '*') {
            await db.prepare(
              "UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ? AND (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR TRIM(tenant_id) = '')))"
            ).bind(promo.id, tenantId, tenantId).run();
          } else {
            await db.prepare(
              'UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ?'
            ).bind(promo.id).run();
          }
        } else if (tenantId !== '*') {
          await db.prepare(
            "UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE code = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)"
          ).bind(promo.code, tenantId).run();
        } else {
          await db.prepare(
            'UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE code = ?'
          ).bind(promo.code).run();
        }
      } catch {
        if (promo.id !== undefined && promo.id !== null) {
          try {
            if (tenantId !== '*') {
              await db.prepare(
                "UPDATE promotions SET used_count = COALESCE(used_count, 0) + 1 WHERE id = ? AND (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR TRIM(tenant_id) = '')))"
              ).bind(promo.id, tenantId, tenantId).run();
            } else {
              await db.prepare(
                'UPDATE promotions SET used_count = COALESCE(used_count, 0) + 1 WHERE id = ?'
              ).bind(promo.id).run();
            }
          } catch {
            if (tenantId === 'default') {
              try {
                await db.prepare(
                  'UPDATE promotions SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ?'
                ).bind(promo.id).run();
              } catch {
                await db.prepare(
                  'UPDATE promotions SET used_count = used_count + 1 WHERE id = ?'
                ).bind(promo.id).run().catch(() => {});
              }
            }
          }
        } else if (tenantId === 'default') {
          await db.prepare(
            'UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ?'
          ).bind(promo.code).run().catch(() => {});
        }
      }
    }

    // Log redemption
    const redeemedAtIso = new Date().toISOString();
    const targetTenantId = tenantId === '*'
      ? ((orderRow?.tenant_id ? String(orderRow.tenant_id).trim() : '') || (promo.tenant_id ? String(promo.tenant_id).trim() : '') || 'default')
      : (tenantId || 'default');
    try {
      await db.prepare(
        'INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(promo.id ?? promo.code, promo.code, data.order_id, discountAmount, effectiveOrderTotal, redeemedAtIso).run();
    } catch {
      await db.prepare(
        'INSERT INTO promotion_redemptions (id, promotion_id, order_id, discount_amount, redeemed_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), promo.id ?? promo.code, data.order_id, discountAmount, redeemedAtIso).run().catch(() => {});
    }
    await db.prepare(
      'UPDATE promotion_redemptions SET tenant_id = ?, customer_id = ? WHERE order_id = ?'
    ).bind(targetTenantId, effectiveCustomerId ?? null, data.order_id).run().catch(async () => {
      await db.prepare(
        'UPDATE promotion_redemptions SET tenant_id = ? WHERE order_id = ?'
      ).bind(targetTenantId, data.order_id).run().catch(() => {});
    });

    return c.json({
      success: true,
      data: {
        code: promo.code,
        percent,
        discount_amount: discountAmount,
        order_id: data.order_id
      }
    });
  });
}
