/**
 * Promotions Routes — /api/promotions
 * Discount code validation and redemption.
 */

import { Hono } from 'hono';
import { validatePromotionSchema, redeemPromotionSchema } from '../lib/validators';
import { requireAuth } from '../middleware/auth';
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

interface CreatePromotionInput {
  code: string;
  percent: number;
  max_discount?: number;
  min_order?: number;
  usage_limit?: number;
  starts_at?: string;
  expires_at?: string;
  is_active?: number;
}

export const promotionsRouter = new Hono<{ Bindings: Env }>();

// ── Admin CRUD (owner only) ──

// GET /api/promotions — list all promotions
promotionsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const { results } = await db.prepare(
    'SELECT * FROM promotions ORDER BY created_at DESC'
  ).all();
  return c.json({ success: true, data: results });
});

// GET /api/promotions/:code — get single promotion
promotionsRouter.get('/:code', async (c) => {
  const db = c.env.AURA_DB;
  const code = c.req.param('code').toUpperCase();
  const promo = await db.prepare(
    'SELECT * FROM promotions WHERE code = ?'
  ).bind(code).first();
  if (!promo) return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
  return c.json({ success: true, data: promo });
});

// POST /api/promotions — create new promotion
promotionsRouter.post('/', requireAuth(['owner']), async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as CreatePromotionInput;
  const code = body.code.trim().toUpperCase();
  if (!code) return c.json({ success: false, error: 'Mã khuyến mãi là bắt buộc' }, 400);
  if (!body.percent || body.percent <= 0 || body.percent > 100) {
    return c.json({ success: false, error: 'Phần trăm giảm phải từ 1-100' }, 400);
  }

  const existing = await db.prepare('SELECT code FROM promotions WHERE code = ?').bind(code).first();
  if (existing) return c.json({ success: false, error: 'Mã khuyến mãi đã tồn tại' }, 409);

  await db.prepare(
    `INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    code,
    body.percent,
    body.max_discount ?? 0,
    body.min_order ?? 0,
    body.usage_limit ?? 0,
    body.starts_at ?? null,
    body.expires_at ?? null,
    body.is_active ?? 1,
  ).run();

  const created = await db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first();
  return c.json({ success: true, data: created }, 201);
});

// PATCH /api/promotions/:code — update promotion
promotionsRouter.patch('/:code', requireAuth(['owner']), async (c) => {
  const db = c.env.AURA_DB;
  const code = c.req.param('code').toUpperCase();
  const body = await c.req.json() as Partial<CreatePromotionInput>;

  const existing = await db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first();
  if (!existing) return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);

  if (body.percent !== undefined && (body.percent <= 0 || body.percent > 100)) {
    return c.json({ success: false, error: 'Phần trăm giảm phải từ 1-100' }, 400);
  }

  await db.prepare(
    `UPDATE promotions SET
      percent = COALESCE(?, percent),
      max_discount = COALESCE(?, max_discount),
      min_order = COALESCE(?, min_order),
      usage_limit = COALESCE(?, usage_limit),
      starts_at = COALESCE(?, starts_at),
      expires_at = COALESCE(?, expires_at),
      is_active = COALESCE(?, is_active)
     WHERE code = ?`
  ).bind(
    body.percent ?? null,
    body.max_discount ?? null,
    body.min_order ?? null,
    body.usage_limit ?? null,
    body.starts_at ?? null,
    body.expires_at ?? null,
    body.is_active ?? null,
    code,
  ).run();

  const updated = await db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first();
  return c.json({ success: true, data: updated });
});

// DELETE /api/promotions/:code — delete promotion
promotionsRouter.delete('/:code', requireAuth(['owner']), async (c) => {
  const db = c.env.AURA_DB;
  const code = c.req.param('code').toUpperCase();
  const existing = await db.prepare('SELECT code FROM promotions WHERE code = ?').bind(code).first();
  if (!existing) return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);

  await db.prepare('DELETE FROM promotions WHERE code = ?').bind(code).run();
  return c.json({ success: true, data: null });
});

// POST /api/promotions/validate — validate discount code
promotionsRouter.post('/validate', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = validatePromotionSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;

  const promo = await db.prepare(
    'SELECT * FROM promotions WHERE code = ? AND is_active = 1'
  ).bind(data.code.trim().toUpperCase()).first<PromotionCode>();

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
  if (data.order_total !== undefined && data.order_total < promo.min_order) {
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
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemPromotionSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
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
      order_id: data.order_id,
    },
  });
});
