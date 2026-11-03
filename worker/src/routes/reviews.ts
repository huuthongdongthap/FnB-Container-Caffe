/**
 * Reviews Routes — /api/reviews
 */

import { Hono } from 'hono';
import { resolvePilotStore } from '../lib/pilot-store';
import { createReviewSchema } from '../lib/validators';
import { optionalAuth } from '../middleware/auth';
import { getTenantId as getCanonicalTenantId } from '../middleware/tenant';
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
    return getCanonicalTenantId(c as Parameters<typeof getCanonicalTenantId>[0]);
  }
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

function matchesTenantRow(row: unknown, tenantId: string): boolean {
  if (tenantId === '*') return true;
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
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
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
      if (
        orderRow.status &&
        ['cancelled', 'failed', 'pending'].includes(String(orderRow.status).trim().toLowerCase())
      ) {
        return c.json({ success: false, error: 'Order cannot be reviewed in its current status' }, 400);
      }
      if (orderRow.customer_id && !isStaff && (!auth?.id || orderRow.customer_id !== auth.id)) {
        return c.json({ success: false, error: 'Forbidden: not your order' }, 403);
      }
      if (!orderRow.customer_id && !isStaff && !auth?.id && orderRow.customer_phone) {
        const suppliedPhone = String((body.customer_phone ?? body.phone ?? '') || '').replace(/\s+/g, '');
        const orderPhone = String(orderRow.customer_phone).replace(/\s+/g, '');
        if (suppliedPhone && suppliedPhone !== orderPhone) {
          return c.json({ success: false, error: 'Forbidden: not your order' }, 403);
        }
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
      usedUnscopedReviewFallback = true;
      existingReview = await db
        .prepare('SELECT id, order_id FROM reviews WHERE order_id = ? LIMIT 1')
        .bind(data.order_id)
        .first<{ id: string; order_id?: string; tenant_id?: string | null }>()
        .catch(() => null);
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
  const effectiveTenant = tenantId && tenantId.trim() && tenantId.trim() !== '*' ? tenantId.trim() : 'default';

  try {
    await db.prepare(
      'INSERT INTO reviews (id, order_id, rating, comment, customer_name, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, data.order_id, rating, data.comment || '', data.customer_name || 'Anonymous', effectiveTenant, now).run();
  } catch {
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
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20', 10)), 100);
  const ratingFilter = c.req.query('rating');
  const offset = (page - 1) * limit;

  try {
    let joinQuery = 'SELECT r.*, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE 1=1';
    const params: unknown[] = [];
    if (ratingFilter) {
      joinQuery += ' AND r.rating = ?';
      params.push(parseInt(ratingFilter, 10));
    }
    joinQuery += " AND (? = '*' OR COALESCE(NULLIF(TRIM(COALESCE(o.tenant_id, r.tenant_id)), ''), 'default') = ?)";
    params.push(tenantId, tenantId);
    joinQuery += ' ORDER BY r.created_at DESC';
    let results: Array<ReviewRecord & { order_tenant_id?: string | null }> | undefined;
    try {
      const res = await db.prepare(joinQuery).bind(...params).all<ReviewRecord & { order_tenant_id?: string | null }>();
      results = res.results;
    } catch {
      let fallbackJoinQuery = 'SELECT r.*, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE 1=1';
      const fallbackParams: unknown[] = [];
      if (ratingFilter) {
        fallbackJoinQuery += ' AND r.rating = ?';
        fallbackParams.push(parseInt(ratingFilter, 10));
      }
      fallbackJoinQuery += ' ORDER BY r.created_at DESC';
      const res = await db.prepare(fallbackJoinQuery).bind(...fallbackParams).all<ReviewRecord & { order_tenant_id?: string | null }>();
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

      if (ratingFilter) {
        countQuery += ' AND rating = ?';
        dataQuery += ' AND rating = ?';
        params.push(parseInt(ratingFilter, 10));
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
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  try {
    let results: Array<{ rating: number; tenant_id?: string | null; order_tenant_id?: string | null }> | undefined;
    try {
      const res = await db
        .prepare(
          "SELECT r.rating, r.tenant_id, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id WHERE (? = '*' OR COALESCE(NULLIF(TRIM(COALESCE(o.tenant_id, r.tenant_id)), ''), 'default') = ?)"
        )
        .bind(tenantId, tenantId)
        .all<{ rating: number; tenant_id?: string | null; order_tenant_id?: string | null }>();
      results = res.results;
    } catch {
      try {
        const res = await db
          .prepare('SELECT r.rating, r.tenant_id, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id')
          .all<{ rating: number; tenant_id?: string | null; order_tenant_id?: string | null }>();
        results = res.results;
      } catch {
        const res = await db
          .prepare('SELECT r.rating, o.tenant_id as order_tenant_id FROM reviews r LEFT JOIN orders o ON o.id = r.order_id')
          .all<{ rating: number; order_tenant_id?: string | null }>();
        results = res.results;
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
