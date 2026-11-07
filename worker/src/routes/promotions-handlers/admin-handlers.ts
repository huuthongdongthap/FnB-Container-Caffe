import type { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin, matchesTenantRow } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import {
  findPromoForTenant,
  resolvePromoReadTenantId,
  resolvePromoWriteTenantId,
  validatePromotionNumericAndDateBounds,
} from './helpers';
import type { CreatePromotionInput } from './types';

const PROMO_ADMIN_ROLES = ['owner', 'manager', 'admin'];
const PROMO_READ_STAFF_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'staff', 'cashier', 'waiter'];

function verifyPromoCallerTenant(
  c: Parameters<typeof getTenantId>[0] & { json: (data: unknown, status?: number) => Response },
  allowedRoles: string[],
  requireUser: boolean,
): Response | null {
  const user = (typeof c.get === 'function' ? c.get('user') : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  if (!user || !user.role) {
    return requireUser ? c.json({ success: false, error: 'Unauthorized — vui lòng đăng nhập' }, 401) : null;
  }
  const role = String(user.role).toLowerCase();
  if (!allowedRoles.includes(role)) {
    return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
  }
  const userTenant = (user.tenantId || user.tenant_id || '').trim();
  const isWildcardHQ = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
  const hqAdmin = isHQSuperAdmin(c as Parameters<typeof isHQSuperAdmin>[0]) || isHQSuperAdmin(user) || isWildcardHQ;
  const boundTenant = userTenant || 'default';
  const reqTenant = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  const ctxTenant = (typeof c.get === 'function' ? (c.get('tenantId') as string | undefined) : undefined)?.trim() || '';
  const resolvedTenant = getTenantId(c).trim() || 'default';

  if (!hqAdmin) {
    if (
      boundTenant === '*' ||
      boundTenant.toLowerCase() === 'hq' ||
      reqTenant === '*' ||
      reqTenant.toLowerCase() === 'hq' ||
      (reqTenant && reqTenant !== boundTenant) ||
      (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) ||
      resolvedTenant !== boundTenant
    ) {
      return c.json({ success: false, error: 'Không đủ quyền truy cập chi nhánh khác' }, 403);
    }
  } else if (!isWildcardHQ && ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' && ctxTenant !== boundTenant && !reqTenant) {
    return c.json({ success: false, error: 'Không đủ quyền truy cập chi nhánh khác' }, 403);
  }
  return null;
}

const requirePromoAdminAuth: import('hono').MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (!c.get('user')) {
    return requireAuth(PROMO_ADMIN_ROLES)(c, async () => {
      const check = verifyPromoCallerTenant(c, PROMO_ADMIN_ROLES, true);
      if (check) {
        c.res = check;
        return;
      }
      await next();
    });
  }
  const check = verifyPromoCallerTenant(c, PROMO_ADMIN_ROLES, true);
  if (check) return check;
  await next();
};

export function registerPromotionAdminHandlers(router: Hono<{ Bindings: Env }>): void {
  router.get('/', optionalAuth(), async (c) => {
    const tenantCheck = verifyPromoCallerTenant(c, PROMO_READ_STAFF_ROLES, false);
    if (tenantCheck) return tenantCheck;

    const db = c.env.AURA_DB;
    const tenantId = resolvePromoReadTenantId(c);
    let results: unknown[] = [];
    if (tenantId !== '*') {
      try {
        const scopedRes = await db.prepare(
          "SELECT * FROM promotions WHERE (tenant_id = ? OR (? = 'default' AND (tenant_id IS NULL OR TRIM(tenant_id) = ''))) ORDER BY created_at DESC"
        ).bind(tenantId, tenantId).all();
        results = scopedRes.results || [];
      } catch {
        if (tenantId === 'default') {
          const res = await db.prepare('SELECT * FROM promotions ORDER BY created_at DESC').all().catch(() =>
            db.prepare('SELECT * FROM promotions').all().catch(() => ({ results: [] }))
          );
          results = res.results || [];
        }
      }
      results = (results as Array<Record<string, unknown>>).filter((r) => matchesTenantRow(r, tenantId));
    } else {
      const res = await db.prepare('SELECT * FROM promotions ORDER BY created_at DESC').all().catch(() =>
        db.prepare('SELECT * FROM promotions').all().catch(() => ({ results: [] }))
      );
      results = res.results || [];
    }
    return c.json({ success: true, data: results, promotions: results });
  });

  router.get('/:code', optionalAuth(), async (c, next) => {
    const code = c.req.param('code').toUpperCase();
    if (code === 'SUMMARY') {
      await next();
      return;
    }
    const tenantCheck = verifyPromoCallerTenant(c, PROMO_READ_STAFF_ROLES, false);
    if (tenantCheck) return tenantCheck;

    const db = c.env.AURA_DB;
    const tenantId = resolvePromoReadTenantId(c);
    let promo = await findPromoForTenant(db, code, tenantId);
    if (!promo && code === 'WELCOME') {
      promo = {
        id: 'promo_welcome', code: 'WELCOME', percent: 10, max_discount: 30000,
        min_order: 0, usage_limit: 0, usage_count: 0, starts_at: null, expires_at: null, is_active: 1,
      };
    }
    if (!promo) return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    return c.json({ success: true, data: promo, promotion: promo });
  });

  router.post('/', requirePromoAdminAuth, async (c) => {
    const db = c.env.AURA_DB;
    const rawTenantId = resolvePromoWriteTenantId(c);
    const writeTenant = rawTenantId === '*' ? 'default' : rawTenantId;
    const body = await c.req.json() as CreatePromotionInput;
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return c.json({ success: false, error: 'Mã khuyến mãi là bắt buộc' }, 400);
    const validationErr = validatePromotionNumericAndDateBounds(body, null, true);
    if (validationErr) return c.json({ success: false, error: validationErr }, 400);

    const existing = await findPromoForTenant(db, code, writeTenant);
    if (existing) return c.json({ success: false, error: 'Mã khuyến mãi đã tồn tại' }, 409);

    const p = [code, body.percent, body.max_discount ?? 0, body.min_order ?? 0, body.usage_limit ?? 0];
    const active = body.is_active ?? 1;
    try {
      await db.prepare(
        'INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)'
      ).bind(...p, body.starts_at ?? null, body.expires_at ?? null, active, writeTenant).run();
    } catch {
      if (writeTenant !== 'default') return c.json({ success: false, error: 'Failed to create promotion' }, 500);
      await db.prepare(
        'INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)'
      ).bind(...p, body.starts_at ?? null, body.expires_at ?? null, active).run().catch(() =>
        db.prepare(
          'INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, expires_at, is_active) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
        ).bind(...p, body.expires_at ?? null, active).run()
      );
    }

    const created = await findPromoForTenant(db, code, writeTenant);
    return c.json({ success: true, data: created }, 201);
  });

  router.patch('/:code', requirePromoAdminAuth, async (c) => {
    const db = c.env.AURA_DB;
    const rawTenantId = resolvePromoWriteTenantId(c, true);
    const rawParam = c.req.param('code');
    const code = rawParam.toUpperCase();
    const body = await c.req.json() as Partial<CreatePromotionInput>;

    const existing = await findPromoForTenant(db, code, rawTenantId);
    if (!existing) return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    const writeTenant =
      rawTenantId === '*'
        ? (typeof existing.tenant_id === 'string' && existing.tenant_id.trim()) || 'default'
        : rawTenantId;

    const validationErr = validatePromotionNumericAndDateBounds(body, existing, false);
    if (validationErr) return c.json({ success: false, error: validationErr }, 400);

    const whereClause = "WHERE (id = ? OR code = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
    const whereArgs = [rawParam, code, writeTenant];
    const baseFields = [body.percent ?? null, body.max_discount ?? null, body.min_order ?? null, body.usage_limit ?? null];
    const setCols = 'percent = COALESCE(?, percent), max_discount = COALESCE(?, max_discount), min_order = COALESCE(?, min_order), usage_limit = COALESCE(?, usage_limit)';

    try {
      await db.prepare(
        `UPDATE promotions SET ${setCols}, starts_at = COALESCE(?, starts_at), expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP ${whereClause}`
      ).bind(...baseFields, body.starts_at ?? null, body.expires_at ?? null, body.is_active ?? null, ...whereArgs).run();
    } catch {
      try {
        await db.prepare(
          `UPDATE promotions SET ${setCols}, starts_at = COALESCE(?, starts_at), expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) ${whereClause}`
        ).bind(...baseFields, body.starts_at ?? null, body.expires_at ?? null, body.is_active ?? null, ...whereArgs).run();
      } catch {
        try {
          await db.prepare(
            `UPDATE promotions SET ${setCols}, expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) ${whereClause}`
          ).bind(...baseFields, body.expires_at ?? null, body.is_active ?? null, ...whereArgs).run();
        } catch {
          if (writeTenant === 'default') {
            await db.prepare(
              `UPDATE promotions SET ${setCols}, starts_at = COALESCE(?, starts_at), expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) WHERE (id = ? OR code = ?)`
            ).bind(...baseFields, body.starts_at ?? null, body.expires_at ?? null, body.is_active ?? null, rawParam, code).run().catch(() =>
              db.prepare(
                `UPDATE promotions SET ${setCols}, expires_at = COALESCE(?, expires_at), is_active = COALESCE(?, is_active) WHERE (id = ? OR code = ?)`
              ).bind(...baseFields, body.expires_at ?? null, body.is_active ?? null, rawParam, code).run().catch(() => {})
            );
          }
        }
      }
    }

    const updated = await findPromoForTenant(db, code, writeTenant);
    return c.json({ success: true, data: updated });
  });

  router.delete('/:code', requirePromoAdminAuth, async (c) => {
    const db = c.env.AURA_DB;
    const rawTenantId = resolvePromoWriteTenantId(c, true);
    const rawParam = c.req.param('code');
    const code = rawParam.toUpperCase();
    const existing = await findPromoForTenant(db, code, rawTenantId);
    if (!existing) return c.json({ success: false, error: 'Không tìm thấy khuyến mãi' }, 404);
    const writeTenant =
      rawTenantId === '*'
        ? (typeof existing.tenant_id === 'string' && existing.tenant_id.trim()) || 'default'
        : rawTenantId;

    await db.prepare(
      "DELETE FROM promotions WHERE (id = ? OR code = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    )
      .bind(rawParam, code, writeTenant)
      .run()
      .catch(() => {
        if (writeTenant === 'default') {
          return db.prepare('DELETE FROM promotions WHERE (id = ? OR code = ?)').bind(rawParam, code).run();
        }
        return null;
      });
    return c.json({ success: true, data: null });
  });
}
