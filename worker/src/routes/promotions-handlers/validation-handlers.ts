import type { Hono } from 'hono';
import { validatePromotionSchema, redeemPromotionSchema } from '../../lib/validators';
import type { Env } from '../../types/env';
import type { PromotionCode } from './types';

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

    const promo = await db.prepare(
      'SELECT * FROM promotions WHERE code = ? AND is_active = 1'
    ).bind(data.code.trim().toUpperCase()).first<PromotionCode>();

    if (!promo) {
      return c.json({ success: true, data: { valid: false, reason: 'Mã không tồn tại hoặc đã bị vô hiệu hoá' } });
    }

    // Check start date
    if (promo.starts_at && new Date(promo.starts_at) > new Date()) {
      return c.json({ success: true, data: { valid: false, reason: 'Chương trình chưa bắt đầu' } });
    }

    // Check expiration
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return c.json({ success: true, data: { valid: false, reason: 'Code has expired' } });
    }

    // Check usage limit
    if (promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) {
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

    return c.json({
      success: true,
      data: {
        valid: true,
        code: promo.code,
        percent: promo.percent,
        max_discount: promo.max_discount,
        min_order: promo.min_order
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

    const promo = await db.prepare(
      'SELECT * FROM promotions WHERE code = ? AND is_active = 1'
    ).bind(data.code.trim().toUpperCase()).first<PromotionCode>();

    if (!promo) {
      return c.json({ success: false, error: 'Invalid code' }, 400);
    }

    if (promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) {
      return c.json({ success: false, error: 'Usage limit reached' }, 400);
    }

    const discountAmount = Math.min(
      Math.round(data.order_total * promo.percent / 100),
      promo.max_discount
    );

    // Increment usage
    await db.prepare(
      'UPDATE promotions SET usage_count = usage_count + 1 WHERE id = ?'
    ).bind(promo.id).run();

    // Log redemption
    await db.prepare(
      'INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(promo.id, promo.code, data.order_id, discountAmount, data.order_total, new Date().toISOString()).run();

    return c.json({
      success: true,
      data: {
        code: promo.code,
        percent: promo.percent,
        discount_amount: discountAmount,
        order_id: data.order_id
      }
    });
  });
}
