/**
 * Promotions Router — Validate + apply discount codes server-side
 * Thay thế hardcoded validCodes trong js/checkout.js L214-219
 */

import { Hono } from 'hono';

export const promotionsRouter = new Hono();

// POST /api/promotions/validate  { code, subtotal }
promotionsRouter.post('/validate', async (c) => {
  const db = c.env.AURA_DB;
  try {
    const { code, subtotal } = await c.req.json();
    if (!code) {
      return c.json({ success: false, error: 'Code là bắt buộc' }, 400);
    }

    const row = await db.prepare(
      'SELECT * FROM promotions WHERE code = ? AND is_active = 1'
    ).bind(String(code).trim().toUpperCase()).first();

    if (!row) {
      return c.json({ success: false, error: 'Mã giảm giá không hợp lệ' }, 404);
    }

    // Validate time window
    const now = new Date().toISOString();
    if (row.starts_at && now < row.starts_at) {
      return c.json({ success: false, error: 'Mã chưa bắt đầu' }, 400);
    }
    if (row.expires_at && now > row.expires_at) {
      return c.json({ success: false, error: 'Mã đã hết hạn' }, 400);
    }

    // Validate min_order
    if (row.min_order && subtotal < row.min_order) {
      return c.json({
        success: false,
        error: `Đơn tối thiểu ${row.min_order.toLocaleString('vi-VN')}₫`,
      }, 400);
    }

    // Validate usage limit
    if (row.usage_limit && row.usage_count >= row.usage_limit) {
      return c.json({ success: false, error: 'Mã đã hết lượt sử dụng' }, 400);
    }

    // Calculate discount
    let amount = Math.floor((subtotal || 0) * row.percent / 100);
    if (row.max_discount && amount > row.max_discount) {
      amount = row.max_discount;
    }

    return c.json({
      success: true,
      code: row.code,
      percent: row.percent,
      amount,
      max_discount: row.max_discount,
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/promotions/redeem  { code } — increment usage_count sau khi checkout thành công
promotionsRouter.post('/redeem', async (c) => {
  const db = c.env.AURA_DB;
  try {
    const { code } = await c.req.json();
    if (!code) { return c.json({ success: false, error: 'Code là bắt buộc' }, 400); }
    await db.prepare(
      'UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ? AND is_active = 1'
    ).bind(String(code).trim().toUpperCase()).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/promotions — list active (public)
promotionsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  try {
    const { results } = await db.prepare(
      'SELECT code, percent, max_discount, min_order, expires_at FROM promotions WHERE is_active = 1'
    ).all();
    return c.json({ success: true, promotions: results || [] });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});
