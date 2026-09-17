import type { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import type { CreatePromotionInput } from './types';

export function registerPromotionAdminHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/promotions — list all promotions
  router.get('/', async (c) => {
    const db = c.env.AURA_DB;
    const { results } = await db.prepare(
      'SELECT * FROM promotions ORDER BY created_at DESC'
    ).all();
    return c.json({ success: true, data: results, promotions: results });
  });

  // GET /api/promotions/:code — get single promotion
  router.get('/:code', async (c) => {
    const db = c.env.AURA_DB;
    const code = c.req.param('code').toUpperCase();
    const promo = await db.prepare(
      'SELECT * FROM promotions WHERE code = ?'
    ).bind(code).first();
    if (!promo) {
      return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    }
    return c.json({ success: true, data: promo, promotion: promo });
  });

  // POST /api/promotions — create new promotion
  router.post('/', requireAuth(['owner']), async (c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json() as CreatePromotionInput;
    const code = body.code.trim().toUpperCase();
    if (!code) {
      return c.json({ success: false, error: 'Mã khuyến mãi là bắt buộc' }, 400);
    }
    if (!body.percent || body.percent <= 0 || body.percent > 100) {
      return c.json({ success: false, error: 'Phần trăm giảm phải từ 1-100' }, 400);
    }

    const existing = await db.prepare('SELECT code FROM promotions WHERE code = ?').bind(code).first();
    if (existing) {
      return c.json({ success: false, error: 'Mã khuyến mãi đã tồn tại' }, 409);
    }

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
      body.is_active ?? 1
    ).run();

    const created = await db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first();
    return c.json({ success: true, data: created }, 201);
  });

  // PATCH /api/promotions/:code — update promotion
  router.patch('/:code', requireAuth(['owner']), async (c) => {
    const db = c.env.AURA_DB;
    const code = c.req.param('code').toUpperCase();
    const body = await c.req.json() as Partial<CreatePromotionInput>;

    const existing = await db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first();
    if (!existing) {
      return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    }

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
      code
    ).run();

    const updated = await db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first();
    return c.json({ success: true, data: updated });
  });

  // DELETE /api/promotions/:code — delete promotion
  router.delete('/:code', requireAuth(['owner']), async (c) => {
    const db = c.env.AURA_DB;
    const code = c.req.param('code').toUpperCase();
    const existing = await db.prepare('SELECT code FROM promotions WHERE code = ?').bind(code).first();
    if (!existing) {
      return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    }

    await db.prepare('DELETE FROM promotions WHERE code = ?').bind(code).run();
    return c.json({ success: true, data: null });
  });
}
