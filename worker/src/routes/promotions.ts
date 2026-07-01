/**
 * Promotions Routes — /api/promotions
 * Discount code validation and redemption.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

interface PromotionCode {
  id: string;
  code: string;
  percent: number;
  max_discount: number;
  min_order: number;
  expires_at: string;
  usage_limit: number;
  usage_count: number;
  is_active: number;
}

interface ValidateResult {
  valid: boolean;
  code?: string;
  percent?: number;
  max_discount?: number;
  min_order?: number;
  reason?: string;
}

interface RedeemInput {
  code: string;
  order_id: string;
  order_total: number;
}

export const promotionsRouter = new Hono<{ Bindings: Env }>();

// POST /api/promotions/validate — validate discount code
promotionsRouter.post('/validate', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json<{ code: string; order_total?: number }>();

  if (!body.code) {
    return c.json({ success: false, error: 'code required' }, 400);
  }

  const promo = await db.prepare(
    'SELECT * FROM promotions WHERE code = ? AND is_active = 1'
  ).bind(body.code.trim().toUpperCase()).first<PromotionCode>();

  if (!promo) {
    return c.json({ success: true, data: { valid: false, reason: 'Invalid or expired code' } });
  }

  // Check expiration
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return c.json({ success: true, data: { valid: false, reason: 'Code has expired' } });
  }

  // Check usage limit
  if (promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) {
    return c.json({ success: true, data: { valid: false, reason: 'Code usage limit reached' } });
  }

  // Check min order
  if (body.order_total !== undefined && body.order_total < promo.min_order) {
    return c.json({
      success: true,
      data: {
        valid: false,
        reason: `Minimum order ${promo.min_order.toLocaleString('vi-VN')}đ required`,
      },
    });
  }

  return c.json({
    success: true,
    data: {
      valid: true,
      code: promo.code,
      percent: promo.percent,
      max_discount: promo.max_discount,
      min_order: promo.min_order,
    },
  });
});

// POST /api/promotions/redeem — redeem discount code
promotionsRouter.post('/redeem', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json<RedeemInput>();

  if (!body.code || !body.order_id) {
    return c.json({ success: false, error: 'code and order_id required' }, 400);
  }

  const promo = await db.prepare(
    'SELECT * FROM promotions WHERE code = ? AND is_active = 1'
  ).bind(body.code.trim().toUpperCase()).first<PromotionCode>();

  if (!promo) {
    return c.json({ success: false, error: 'Invalid code' }, 400);
  }

  if (promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) {
    return c.json({ success: false, error: 'Usage limit reached' }, 400);
  }

  const discountAmount = Math.min(
    Math.round(body.order_total * promo.percent / 100),
    promo.max_discount
  );

  // Increment usage
  await db.prepare(
    'UPDATE promotions SET usage_count = usage_count + 1 WHERE id = ?'
  ).bind(promo.id).run();

  // Log redemption
  await db.prepare(
    'INSERT INTO promotion_redemptions (promotion_id, code, order_id, discount_amount, order_total, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(promo.id, promo.code, body.order_id, discountAmount, body.order_total, new Date().toISOString()).run();

  return c.json({
    success: true,
    data: {
      code: promo.code,
      percent: promo.percent,
      discount_amount: discountAmount,
      order_id: body.order_id,
    },
  });
});
