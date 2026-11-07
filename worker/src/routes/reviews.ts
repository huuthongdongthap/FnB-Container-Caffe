/**
 * Reviews Routes — /api/reviews
 */

import { Hono } from 'hono';
import { resolvePilotStore } from '../lib/pilot-store';
import { createReviewSchema } from '../lib/validators';
import { optionalAuth } from '../middleware/auth';
import { getTenantId as getCanonicalTenantId, isHQSuperAdmin } from '../middleware/tenant';
import type { Env } from '../types/env';

function makeReviewId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `rev_${Date.now().toString(36)}${rand}`;
}

function getTenantId(c: {
  env: Env;
  req: { query?: (k: string) => string | undefined; header: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): string {
  // Use session-derived tenant when authenticated; fall back to deployment-bound store only.
  if (typeof c?.get === 'function' && (c.get('user') || c.get('tenantId'))) {
    const resolved = getCanonicalTenantId(c as Parameters<typeof getCanonicalTenantId>[0]);
    const normalized = resolved.toLowerCase() === 'hq' ? '*' : resolved;
    if (normalized === '*' && isHQSuperAdmin(c as unknown as Parameters<typeof isHQSuperAdmin>[0])) {
      const requestedOverride = (
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
      if (requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq') {
        return requestedOverride;
      }
    }
    return normalized;
  }
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

function resolveReviewTenant(c: {
  env: Env;
  req: { query?: (k: string) => string | undefined; header: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): { ok: true; tenantId: string } | { ok: false; status: 403; error: string } {
  const user = (typeof c?.get === 'function' ? c.get('user') : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
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
    return { ok: false, status: 403, error: 'Forbidden: cross-tenant review access denied' };
  }
  const requestedTenant = candidateOverrides[0] || '';
  if (user && !isHQSuperAdmin(user)) {
    const rawUserTenant = String(user.tenantId || user.tenant_id || '').trim();
    const ctxTenant = typeof c?.get === 'function' ? String(c.get('tenantId') || '').trim() : '';
    const userTenant = rawUserTenant || ctxTenant || 'default';
    if (
      rawUserTenant === '*' ||
      rawUserTenant.toLowerCase() === 'hq' ||
      ctxTenant === '*' ||
      ctxTenant.toLowerCase() === 'hq' ||
      (rawUserTenant && ctxTenant && ctxTenant !== rawUserTenant) ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      (requestedTenant && requestedTenant !== userTenant)
    ) {
      return { ok: false, status: 403, error: 'Forbidden: cross-tenant review access denied' };
    }
    return { ok: true, tenantId: userTenant };
  }
  if (!user && (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq')) {
    return { ok: false, status: 403, error: 'Forbidden: cross-tenant review access denied' };
  }
  const resolved = getTenantId(c);
  return { ok: true, tenantId: resolved.toLowerCase() === 'hq' ? '*' : resolved };
}

function matchesTenantRow(row: unknown, tenantId: string): boolean {
  if (tenantId === '*' || tenantId.toLowerCase() === 'hq') return true;
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  const rawOrderTenant = typeof r.order_tenant_id === 'string' && r.order_tenant_id.trim() ? r.order_tenant_id.trim() : null;
  const rawReviewTenant = typeof r.tenant_id === 'string' && r.tenant_id.trim() ? r.tenant_id.trim() : null;
  const raw = rawOrderTenant ?? rawReviewTenant;
  if (raw === null) return tenantId === 'default';
  return raw === tenantId;
}

interface ReviewRecord {
  id: string;
  order_id: string;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
}

export const reviewsRouter = new Hono<{ Bindings: Env }>();
reviewsRouter.use('*', async (c, next) => {
  if (!c.get('user' as never) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});

// POST /api/reviews — submit a review
reviewsRouter.post('/', optionalAuth(), async(c) => {
  const db = c.env.AURA_DB;
  const tenantRes = resolveReviewTenant(c as unknown as Parameters<typeof resolveReviewTenant>[0]);
  if (!tenantRes.ok) {
    return c.json({ success: false, error: tenantRes.error }, tenantRes.status);
  }
  const tenantId = tenantRes.tenantId;
  const auth = c.get('user' as never) as { id?: string; role?: string } | undefined;

  // Rate limit: 5 reviews per hour per IP
  const kv = c.env.AUTH_KV as { get: (k: string) => Promise<string | null>; put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
  if (kv) {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
    const rlKey = `rl:review:${ip}`;
    const cur = parseInt(await kv.get(rlKey) || '0', 10);
    if (cur >= 5) {
      return c.json({ success: false, error: 'Too many reviews, please try again later' }, 429);
    }
    await kv.put(rlKey, String(cur + 1), { expirationTtl: 3600 });
  }

  const body = await c.req.json() as Record<string, unknown>;
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const data = parsed.data;
  const rating = data.rating;

  // Require either auth or a valid order_id
  if (!auth?.id && !data.order_id) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  const isStaff = Boolean(auth?.role && ['owner', 'manager', 'supervisor', 'admin'].includes(auth.role));
  if (auth?.role && !isStaff && auth.role !== 'customer') {
    return c.json({ success: false, error: 'Forbidden: role cannot submit customer reviews' }, 403);
  }

  // If order_id provided, verify order exists, belongs to tenant, and caller is authorized
  let resolvedOrderTenant: string | undefined;
  if (data.order_id) {
    let orderRow: {
      id: string;
      customer_id?: string | null;
      customer_phone?: string | null;
      status?: string | null;
      tenant_id?: string | null;
    } | null = null;
    try {
      orderRow = await db
        .prepare('SELECT id, customer_id, customer_phone, status, tenant_id FROM orders WHERE id = ?')
        .bind(data.order_id)
        .first<{
          id: string;
          customer_id?: string | null;
          customer_phone?: string | null;
          status?: string | null;
          tenant_id?: string | null;
        }>()
        .catch(() => null);
      if (!orderRow) {
        orderRow = await db
          .prepare('SELECT id, customer_id, tenant_id FROM orders WHERE id = ?')
          .bind(data.order_id)
          .first<{ id: string; customer_id?: string | null; tenant_id?: string | null }>()
          .catch(() =>
            db
              .prepare('SELECT id, customer_id FROM orders WHERE id = ?')
              .bind(data.order_id)
              .first<{ id: string; customer_id?: string | null; tenant_id?: string | null }>()
              .catch(() =>
                db
                  .prepare('SELECT id, tenant_id FROM orders WHERE id = ?')
                  .bind(data.order_id)
                  .first<{ id: string; customer_id?: string | null; tenant_id?: string | null }>()
              )
          );
      }
    } catch {
      orderRow = null;
    }

    if (!orderRow) {
      const countRow = await db
        .prepare('SELECT COUNT(*) as cnt FROM orders')
        .first<{ cnt?: number }>()
        .catch(() => null);
      const hasOrdersTable = Boolean(countRow && typeof countRow.cnt === 'number');
      if (hasOrdersTable || auth?.id || (tenantId !== 'default' && tenantId !== '*')) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
    } else {
      if (!matchesTenantRow(orderRow, tenantId)) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
      const rawOrderTenant = typeof orderRow.tenant_id === 'string' ? orderRow.tenant_id.trim() : '';
      if (rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq') {
        resolvedOrderTenant = rawOrderTenant;
      }
      if (
        orderRow.status &&
        ['cancelled', 'canceled', 'failed', 'pending', 'rejected', 'expired', 'refunded'].includes(
          String(orderRow.status).trim().toLowerCase()
        )
      ) {
        return c.json({ success: false, error: 'Order cannot be reviewed in its current status' }, 400);
      }
      if (orderRow.customer_id && !isStaff && (!auth?.id || orderRow.customer_id !== auth.id)) {
        return c.json({ success: false, error: 'Forbidden: not your order' }, 403);
      }
      if (!orderRow.customer_id && !isStaff && orderRow.customer_phone) {
        let suppliedPhone = String(
          (body.customer_phone ?? body.phone ?? (auth as { phone?: string } | undefined)?.phone ?? '') || ''
        ).trim();
        if (!suppliedPhone && auth?.id) {
          const custPhoneRow = await db
            .prepare('SELECT phone FROM customers WHERE id = ?')
            .bind(auth.id)
            .first<{ phone?: string | null }>()
            .catch(() => null);
          suppliedPhone = String(custPhoneRow?.phone ?? '').trim();
        }
        const normalizePhoneDigits = (raw: string): string => {
          const digits = raw.replace(/\D/g, '');
          if (digits.startsWith('84') && digits.length >= 10) {
            return '0' + digits.slice(2);
          }
          return digits;
        };
        const orderPhoneNorm = normalizePhoneDigits(String(orderRow.customer_phone));
        const suppliedPhoneNorm = normalizePhoneDigits(suppliedPhone);
        if (!suppliedPhoneNorm || suppliedPhoneNorm !== orderPhoneNorm) {
          return c.json(
            { success: false, error: 'Forbidden: customer phone verification required to review guest order' },
            403
          );
        }
      } else if (!orderRow.customer_id && !isStaff && !orderRow.customer_phone && !auth?.id && 'customer_phone' in orderRow) {
        return c.json(
          { success: false, error: 'Forbidden: customer phone verification required to review guest order' },
          403
        );
      }
    }

    let existingReview: { id: string; order_id?: string; tenant_id?: string | null } | null = null;
    let usedUnscopedReviewFallback = false;
    try {
      existingReview = await db
        .prepare(
          "SELECT id, order_id, tenant_id FROM reviews WHERE order_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
        )
        .bind(data.order_id, tenantId, tenantId)
        .first<{ id: string; order_id?: string; tenant_id?: string | null }>();
    } catch {
      if (tenantId === 'default' || tenantId === '*') {
        usedUnscopedReviewFallback = true;
        existingReview = await db
          .prepare('SELECT id, order_id FROM reviews WHERE order_id = ? LIMIT 1')
          .bind(data.order_id)
          .first<{ id: string; order_id?: string; tenant_id?: string | null }>()
          .catch(() => null);
      }
    }
    const existingMatchesTenant = existingReview
      ? ('tenant_id' in existingReview || usedUnscopedReviewFallback
        ? matchesTenantRow(existingReview, tenantId)
        : true)
      : false;
    if (existingReview && existingMatchesTenant && (!existingReview.order_id || existingReview.order_id === data.order_id)) {
      return c.json({ success: false, error: 'Order has already been reviewed' }, 409);
    }
  }

  const id = makeReviewId();
  const now = new Date().toISOString();
  const effectiveTenant =
    resolvedOrderTenant ||
    (tenantId && tenantId.trim() && tenantId.trim() !== '*' && tenantId.trim().toLowerCase() !== 'hq'
      ? tenantId.trim()
      : 'default');

  try {
    await db.prepare(
      'INSERT INTO reviews (id, order_id, rating, comment, customer_name, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, data.order_id, rating, data.comment || '', data.customer_name || 'Anonymous', effectiveTenant, now).run();
  } catch {
    if (!data.order_id && effectiveTenant !== 'default') {
      return c.json({ success: false, error: 'Tenant-scoped standalone reviews require tenant_id column' }, 503);
    }
    await db.prepare(
      'INSERT INTO reviews (id, order_id, rating, comment, customer_name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, data.order_id, rating, data.comment || '', data.customer_name || 'Anonymous', now).run();
  }

  const row = await db.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<ReviewRecord>();
  return c.json({ success: true, data: row }, 201);
});

// GET /api/reviews — paginated list
reviewsRouter.get('/', async(c) => {
  const db = c.env.AURA_DB;
  const tenantRes = resolveReviewTenant(c as unknown as Parameters<typeof resolveReviewTenant>[0]);
  if (!tenantRes.ok) {
    return c.json({ success: false, error: tenantRes.error }, tenantRes.status);
  }
  const tenantId = tenantRes.tenantId;
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20', 10)), 100);
  const ratingFilter = c.req.query('rating');
  let parsedRating: number | undefined;
  if (ratingFilter !== undefined && ratingFilter !== '') {
    const n = Number(ratingFilter);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return c.json({ success: false, error: 'Rating phải là số nguyên từ 1 đến 5' }, 400);
    }
    parsedRating = n;
  }
  const offset = (page - 1) * limit;

  try {
    let joinQuery = 'SELECT r.*, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE 1=1';
    const params: unknown[] = [];
    if (parsedRating !== undefined) {
      joinQuery += ' AND r.rating = ?';
      params.push(parsedRating);
    }
    joinQuery += " AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), NULLIF(TRIM(r.tenant_id), ''), 'default') = ?)";
    params.push(tenantId, tenantId);
    joinQuery += ' ORDER BY r.created_at DESC LIMIT 1000';
    let results: Array<ReviewRecord & { order_tenant_id?: string | null }> | undefined;
    try {
      const res = await db.prepare(joinQuery).bind(...params).all<ReviewRecord & { order_tenant_id?: string | null }>();
      results = res.results;
    } catch {
      let fallbackJoinQuery = 'SELECT r.*, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE 1=1';
      const fallbackParams: unknown[] = [];
      if (parsedRating !== undefined) {
        fallbackJoinQuery += ' AND r.rating = ?';
        fallbackParams.push(parsedRating);
      }
      fallbackJoinQuery += " AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)";
      fallbackParams.push(tenantId, tenantId);
      fallbackJoinQuery += ' ORDER BY r.created_at DESC LIMIT 1000';
      const res = await db
        .prepare(fallbackJoinQuery)
        .bind(...fallbackParams)
        .all<ReviewRecord & { order_tenant_id?: string | null }>()
        .catch(async () => {
          if (tenantId !== 'default' && tenantId !== '*') {
            return { results: [] as Array<ReviewRecord & { order_tenant_id?: string | null }> };
          }
          let legacyJoinQuery = 'SELECT r.*, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE 1=1';
          const legacyParams: unknown[] = [];
          if (parsedRating !== undefined) {
            legacyJoinQuery += ' AND r.rating = ?';
            legacyParams.push(parsedRating);
          }
          legacyJoinQuery += ' ORDER BY r.created_at DESC LIMIT 1000';
          return db.prepare(legacyJoinQuery).bind(...legacyParams).all<ReviewRecord & { order_tenant_id?: string | null }>();
        });
      results = res.results;
    }
    const filtered = (results || [])
      .filter((r) => matchesTenantRow(r, tenantId))
      .map(({ order_tenant_id: _ignored, ...rest }) => rest);
    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);
    return c.json({
      success: true,
      data: paged,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch {
    try {
      let countQuery = 'SELECT COUNT(*) as total FROM reviews WHERE 1=1';
      let dataQuery = 'SELECT * FROM reviews WHERE 1=1';
      const params: unknown[] = [];

      if (parsedRating !== undefined) {
        countQuery += ' AND rating = ?';
        dataQuery += ' AND rating = ?';
        params.push(parsedRating);
      }

      countQuery += " AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
      dataQuery += " AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
      params.push(tenantId, tenantId);
      dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

      const { results: countResults } = await db.prepare(countQuery).bind(...params).all<{ total: number }>();
      const total = countResults?.[0]?.total || 0;

      const { results } = await db.prepare(dataQuery).bind(...params, limit, offset).all<ReviewRecord>();
      const filtered = (results || []).filter((r) => !('tenant_id' in r) || matchesTenantRow(r, tenantId));

      return c.json({
        success: true,
        data: filtered,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch {
      if (tenantId !== 'default' && tenantId !== '*') {
        return c.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        });
      }
      let countQuery = 'SELECT COUNT(*) as total FROM reviews WHERE 1=1';
      let dataQuery = 'SELECT * FROM reviews WHERE 1=1';
      const params: unknown[] = [];

      if (ratingFilter) {
        countQuery += ' AND rating = ?';
        dataQuery += ' AND rating = ?';
        params.push(parseInt(ratingFilter, 10));
      }

      dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

      const { results: countResults } = await db.prepare(countQuery).bind(...params).all<{ total: number }>();
      const total = countResults?.[0]?.total || 0;

      const { results } = await db.prepare(dataQuery).bind(...params, limit, offset).all<ReviewRecord>();
      const filtered = (results || []).filter((r) => matchesTenantRow(r, tenantId));

      return c.json({
        success: true,
        data: filtered,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }
  }
});

// GET /api/reviews/stats — aggregate statistics
reviewsRouter.get('/stats', async(c) => {
  const db = c.env.AURA_DB;
  const tenantRes = resolveReviewTenant(c as unknown as Parameters<typeof resolveReviewTenant>[0]);
  if (!tenantRes.ok) {
    return c.json({ success: false, error: tenantRes.error }, tenantRes.status);
  }
  const tenantId = tenantRes.tenantId;
  try {
    let results: Array<{ rating: number; tenant_id?: string | null; order_tenant_id?: string | null }> | undefined;
    try {
      const res = await db
        .prepare(
          "SELECT r.rating, r.tenant_id, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), NULLIF(TRIM(r.tenant_id), ''), 'default') = ?) LIMIT 1000"
        )
        .bind(tenantId, tenantId)
        .all<{ rating: number; tenant_id?: string | null; order_tenant_id?: string | null }>();
      results = res.results;
    } catch {
      try {
        const res = await db
          .prepare(
            "SELECT r.rating, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) LIMIT 1000"
          )
          .bind(tenantId, tenantId)
          .all<{ rating: number; order_tenant_id?: string | null }>();
        results = res.results;
      } catch {
        if (tenantId === 'default' || tenantId === '*') {
          const res = await db
            .prepare('SELECT r.rating, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id LIMIT 1000')
            .all<{ rating: number; order_tenant_id?: string | null }>();
          results = res.results;
        } else {
          throw new Error('reviews_stats_fallback_required');
        }
      }
    }
    const filtered = (results || []).filter((r) => matchesTenantRow(r, tenantId));
    const totalReviews = filtered.length;
    const avg = totalReviews > 0
      ? filtered.reduce((acc, r) => acc + Number(r.rating || 0), 0) / totalReviews
      : 0;
    return c.json({
      success: true,
      data: {
        total_reviews: totalReviews,
        average_rating: Math.round(avg * 10) / 10
      }
    });
  } catch {
    try {
      const row = await db.prepare(
        "SELECT COUNT(*) as total_reviews, COALESCE(AVG(rating), 0) as average_rating FROM reviews WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(tenantId, tenantId).first<{ total_reviews: number; average_rating: number }>();

      return c.json({
        success: true,
        data: {
          total_reviews: row?.total_reviews || 0,
          average_rating: row ? Math.round(row.average_rating * 10) / 10 : 0
        }
      });
    } catch {
      if (tenantId !== 'default' && tenantId !== '*') {
        return c.json({
          success: true,
          data: {
            total_reviews: 0,
            average_rating: 0
          }
        });
      }
      const row = await db.prepare(
        'SELECT COUNT(*) as total_reviews, COALESCE(AVG(rating), 0) as average_rating FROM reviews'
      ).first<{ total_reviews: number; average_rating: number }>();

      return c.json({
        success: true,
        data: {
          total_reviews: row?.total_reviews || 0,
          average_rating: row ? Math.round(row.average_rating * 10) / 10 : 0
        }
      });
    }
  }
});
