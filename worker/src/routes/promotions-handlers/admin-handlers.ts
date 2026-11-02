import type { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import type { CreatePromotionInput } from './types';

const PROMO_ADMIN_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

async function findPromoForTenant(
  db: import('@cloudflare/workers-types').D1Database,
  code: string,
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT * FROM promotions WHERE code = ?').bind(code).first<Record<string, unknown>>();
  if (row && matchesTenantRow(row, tenantId)) return row;
  if (row && tenantId !== '*') {
    const scoped = await db.prepare("SELECT * FROM promotions WHERE code = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?")
      .bind(code, tenantId).first<Record<string, unknown>>().catch(() => null);
    if (scoped && matchesTenantRow(scoped, tenantId)) return scoped;
  }
  return null;
}

export function registerPromotionAdminHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/promotions — list all promotions
  router.get('/', optionalAuth(), async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    let results: unknown[] = [];
    try {
      const res = await db.prepare(
        'SELECT * FROM promotions ORDER BY created_at DESC'
      ).all();
      results = res.results || [];
    } catch {
      const res = await db.prepare('SELECT * FROM promotions').all().catch(() => ({ results: [] }));
      results = res.results || [];
    }
    if (tenantId !== '*') {
      results = (results as Array<Record<string, unknown>>).filter(
        (r) => matchesTenantRow(r, tenantId)
      );
    }
    return c.json({ success: true, data: results, promotions: results });
  });

  // GET /api/promotions/:code — get single promotion
  router.get('/:code', optionalAuth(), async (c, next) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const code = c.req.param('code').toUpperCase();
    if (code === 'SUMMARY') {
      await next();
      return;
    }
    let promo = await findPromoForTenant(db, code, tenantId);
    if (!promo && code === 'WELCOME') {
      promo = {
        id: 'promo_welcome',
        code: 'WELCOME',
        percent: 10,
        max_discount: 30000,
        min_order: 0,
        usage_limit: 0,
        usage_count: 0,
        starts_at: null,
        expires_at: null,
        is_active: 1
      };
    }
    if (!promo) {
      return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    }
    return c.json({ success: true, data: promo, promotion: promo });
  });

  // POST /api/promotions — create new promotion
  router.post('/', requireAuth(PROMO_ADMIN_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const rawTenantId = getTenantId(c);
    const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
    const body = await c.req.json() as CreatePromotionInput;
    const code = body.code.trim().toUpperCase();
    if (!code) {
      return c.json({ success: false, error: 'Mã khuyến mãi là bắt buộc' }, 400);
    }
    if (!body.percent || body.percent <= 0 || body.percent > 100) {
      return c.json({ success: false, error: 'Phần trăm giảm phải từ 1-100' }, 400);
    }

    const existing = await findPromoForTenant(db, code, tenantId);
    if (existing) {
      return c.json({ success: false, error: 'Mã khuyến mãi đã tồn tại' }, 409);
    }

    const p = [code, body.percent, body.max_discount ?? 0, body.min_order ?? 0, body.usage_limit ?? 0];
    const active = body.is_active ?? 1;
    try {
      await db.prepare(
        'INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)'
      ).bind(...p, body.starts_at ?? null, body.expires_at ?? null, active, tenantId).run();
    } catch {
      if (tenantId !== 'default') {
        return c.json({ success: false, error: 'Failed to create promotion' }, 500);
      }
      try {
        await db.prepare(
          'INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)'
        ).bind(...p, body.starts_at ?? null, body.expires_at ?? null, active).run();
      } catch {
        await db.prepare(
          'INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, expires_at, is_active) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
        ).bind(...p, body.expires_at ?? null, active).run();
      }
    }

    const created = await findPromoForTenant(db, code, tenantId);
    return c.json({ success: true, data: created }, 201);
  });

  // PATCH /api/promotions/:code — update promotion
  router.patch('/:code', requireAuth(PROMO_ADMIN_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const code = c.req.param('code').toUpperCase();
    const body = await c.req.json() as Partial<CreatePromotionInput>;

    const existing = await findPromoForTenant(db, code, tenantId);
    if (!existing) {
      return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    }

    if (body.percent !== undefined && (body.percent <= 0 || body.percent > 100)) {
      return c.json({ success: false, error: 'Phần trăm giảm phải từ 1-100' }, 400);
    }

    const whereClause = tenantId !== '*'
      ? "WHERE code = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?"
      : 'WHERE code = ?';
    const whereArgs = tenantId !== '*' ? [code, tenantId] : [code];
    const baseFields = [body.percent ?? null, body.max_discount ?? null, body.min_order ?? null, body.usage_limit ?? null];

    try {
      await db.prepare(
        `UPDATE promotions SET percent = COALESCE(?, percent), max_discount = COALESCE(?, max_discount), min_order = COALESCE(?, min_order), usage_limit = COALESCE(?, usage_limit), starts_at = COALESCE(?, starts_at), expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) ${whereClause}`
      ).bind(...baseFields, body.starts_at ?? null, body.expires_at ?? null, body.is_active ?? null, ...whereArgs).run();
    } catch {
      try {
        await db.prepare(
          'UPDATE promotions SET percent = COALESCE(?, percent), max_discount = COALESCE(?, max_discount), min_order = COALESCE(?, min_order), usage_limit = COALESCE(?, usage_limit), starts_at = COALESCE(?, starts_at), expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) WHERE code = ?'
        ).bind(...baseFields, body.starts_at ?? null, body.expires_at ?? null, body.is_active ?? null, code).run();
      } catch {
        await db.prepare(
          'UPDATE promotions SET percent = COALESCE(?, percent), max_discount = COALESCE(?, max_discount), min_order = COALESCE(?, min_order), usage_limit = COALESCE(?, usage_limit), expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) WHERE code = ?'
        ).bind(...baseFields, body.expires_at ?? null, body.is_active ?? null, code).run();
      }
    }

    const updated = await findPromoForTenant(db, code, tenantId);
    return c.json({ success: true, data: updated });
  });

  // DELETE /api/promotions/:code — delete promotion
  router.delete('/:code', requireAuth(PROMO_ADMIN_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const code = c.req.param('code').toUpperCase();
    const existing = await findPromoForTenant(db, code, tenantId);
    if (!existing) {
      return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    }

    if (tenantId !== '*') {
      await db.prepare("DELETE FROM promotions WHERE code = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?")
        .bind(code, tenantId)
        .run()
        .catch(() => db.prepare('DELETE FROM promotions WHERE code = ?').bind(code).run());
    } else {
      await db.prepare('DELETE FROM promotions WHERE code = ?').bind(code).run();
    }
    return c.json({ success: true, data: null });
  });
}
