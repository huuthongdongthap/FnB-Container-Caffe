import type { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { validatePromotionSchema, redeemPromotionSchema } from '../../lib/validators';
import { getTenantId } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import type { PromotionCode } from './types';

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
  }
): Promise<{ eligible: boolean; reason?: string }> {
  if (opts.is_new_customer === false) {
    return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới lần đầu đến quán' };
  }
  const hasCustomerContext = Boolean(opts.customer_id || opts.customer_phone || opts.customer_name !== undefined);
  if (!hasCustomerContext) {
    return { eligible: true };
  }

  const normalizedPhone = opts.customer_phone ? opts.customer_phone.replace(/[\s\-().]/g, '') : '';
  if (opts.customer_name !== undefined && (!opts.customer_name.trim() || !normalizedPhone)) {
    return {
      eligible: false,
      reason: 'Mã WELCOME yêu cầu khách hàng mới để lại thông tin đăng ký (họ tên và số điện thoại)'
    };
  }

  if (opts.customer_id) {
    try {
      const cust = await db.prepare(
        'SELECT id, total_orders FROM customers WHERE id = ? LIMIT 1'
      ).bind(opts.customer_id).first<{ id: string; total_orders?: number }>();
      if (cust && Number(cust.total_orders ?? 0) > 0) {
        return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới chưa từng có đơn hàng' };
      }
      const priorOrder = await db.prepare(
        "SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ? AND status NOT IN ('cancelled', 'failed')"
      ).bind(opts.customer_id).first<{ cnt?: number }>();
      if (Number(priorOrder?.cnt ?? 0) > 0) {
        return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới chưa từng có đơn hàng' };
      }
    } catch {
      // Partial schema fallback
    }
  }

  if (normalizedPhone) {
    try {
      const custByPhone = await db.prepare(
        'SELECT id, total_orders FROM customers WHERE phone = ? LIMIT 1'
      ).bind(normalizedPhone).first<{ id: string; total_orders?: number }>();
      if (custByPhone && Number(custByPhone.total_orders ?? 0) > 0) {
        return { eligible: false, reason: 'Mã WELCOME chỉ áp dụng cho khách hàng mới chưa từng có đơn hàng' };
      }
      const priorByPhone = await db.prepare(
        "SELECT COUNT(*) AS cnt FROM orders WHERE customer_phone = ? AND status NOT IN ('cancelled', 'failed')"
      ).bind(normalizedPhone).first<{ cnt?: number }>();
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
  router.post('/validate', async (c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = validatePromotionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const data = parsed.data;
    const upperCode = data.code.trim().toUpperCase();
    const isWelcome = upperCode === 'WELCOME';

    let promo = await db.prepare(
      'SELECT * FROM promotions WHERE UPPER(code) = ?'
    ).bind(upperCode).first<PromotionCode & { tenant_id?: string | null }>();

    const tenantId = getTenantId(c);
    if (promo && promo.tenant_id && promo.tenant_id !== 'default' && promo.tenant_id !== tenantId) {
      promo = null;
    } else if (promo && Number(promo.is_active ?? 1) === 0) {
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
    if (!isWelcome && promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) {
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

    if (isWelcome) {
      const welcomeCheck = await checkWelcomeNewCustomerEligibility(db, {
        customer_id: data.customer_id,
        customer_phone: data.customer_phone,
        customer_name: data.customer_name,
        is_new_customer: data.is_new_customer
      });
      if (!welcomeCheck.eligible) {
        return c.json({
          success: true,
          data: { valid: false, reason: welcomeCheck.reason }
        });
      }
    }

    const percent = isWelcome ? (promo.percent || 10) : promo.percent;
    const maxDiscount = isWelcome ? (promo.max_discount || 30000) : promo.max_discount;
    const discountAmount = data.order_total !== undefined
      ? (maxDiscount > 0 ? Math.min(Math.round(data.order_total * percent / 100), maxDiscount) : Math.round(data.order_total * percent / 100))
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
  router.post('/redeem', async (c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = redeemPromotionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const data = parsed.data;
    const upperCode = data.code.trim().toUpperCase();
    const isWelcome = upperCode === 'WELCOME';

    let promo = await db.prepare(
      'SELECT * FROM promotions WHERE UPPER(code) = ?'
    ).bind(upperCode).first<PromotionCode & { tenant_id?: string | null }>();

    const tenantId = getTenantId(c);
    if (promo && promo.tenant_id && promo.tenant_id !== 'default' && promo.tenant_id !== tenantId) {
      promo = null;
    } else if (promo && Number(promo.is_active ?? 1) === 0) {
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

    if (promo.min_order > 0 && data.order_total < promo.min_order) {
      return c.json({
        success: false,
        error: `Minimum order ${promo.min_order.toLocaleString('vi-VN')}đ required`
      }, 400);
    }

    if (isWelcome) {
      const welcomeCheck = await checkWelcomeNewCustomerEligibility(db, {
        customer_id: data.customer_id,
        customer_phone: data.customer_phone,
        customer_name: data.customer_name,
        is_new_customer: data.is_new_customer
      });
      if (!welcomeCheck.eligible) {
        return c.json({ success: false, error: welcomeCheck.reason || 'Mã WELCOME chỉ áp dụng cho khách hàng mới' }, 400);
      }
    }

    const percent = isWelcome ? (promo.percent || 10) : promo.percent;
    const maxDiscount = isWelcome ? (promo.max_discount || 30000) : promo.max_discount;

    // Idempotent check by order_id so retrying redemption for the same order does not double-increment usage_count
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

    if (!isWelcome && promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) {
      return c.json({ success: false, error: 'Usage limit reached' }, 400);
    }

    const orderRow = await db.prepare(
      'SELECT id, tenant_id, status FROM orders WHERE id = ? LIMIT 1'
    ).bind(data.order_id).first<{ id?: string; tenant_id?: string | null; status?: string }>().catch(() => null);
    if (!orderRow || !orderRow.id) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    if (orderRow.tenant_id && orderRow.tenant_id !== 'default' && orderRow.tenant_id !== tenantId) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const rawDiscount = Math.round(data.order_total * percent / 100);
    const discountAmount = maxDiscount > 0
      ? Math.min(rawDiscount, maxDiscount)
      : rawDiscount;

    // Increment usage with atomic conditional guard
    try {
      if (promo.id !== undefined && promo.id !== null) {
        await db.prepare(
          'UPDATE promotions SET usage_count = usage_count + 1 WHERE id = ? AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)'
        ).bind(promo.id).run();
      } else {
        await db.prepare(
          'UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ? AND (usage_limit IS NULL OR usage_limit = 0 OR usage_count < usage_limit)'
        ).bind(promo.code).run();
      }
    } catch {
      await db.prepare(
        'UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ?'
      ).bind(promo.code).run().catch(() => {});
    }

    // Log redemption
    try {
      await db.prepare(
        'INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(promo.id ?? promo.code, promo.code, data.order_id, discountAmount, data.order_total, new Date().toISOString()).run();
    } catch {
      // promotion_redemptions table is optional in canonical D1 schema
    }

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
