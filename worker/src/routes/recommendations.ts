/**
 * AI Recommendations Router
 * Frequently bought together, trending item velocity, and personalized suggestions.
 */

import { Hono, type Context } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { getTenantId, resolvePilotStore, resolvePublicTenantId as resolveRecommendationsTenantId } from '../middleware/tenant';

export const recommendationsRouter = new Hono<{ Bindings: Env }>();

recommendationsRouter.use('/*', async (c, next) => {
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    return optionalAuth()(c, next);
  }
  return next();
});

const FALLBACK_PAIRINGS = [
  { id: 'croissant_bo', name: 'Bánh sừng bò bơ Pháp', category: 'pastry', reason: 'Món ăn kèm hoàn hảo với cà phê' },
  { id: 'banh_mi_hoa_hong', name: 'Bánh mì hoa hồng Sa Đéc', category: 'pastry', reason: 'Đặc sản làng hoa nướng giòn' },
  { id: 'tra_sen_dong_thap', name: 'Trà sen Tháp Mười', category: 'tea', reason: 'Thanh nhiệt sảng khoái' },
  { id: 'cafe_muoi_sadec', name: 'Cà phê muối Sa Đéc', category: 'coffee', reason: 'Signature AURA được yêu thích nhất' }
];

interface OrderItem {
  id?: string;
  product_id?: string;
  name?: string;
  quantity?: number;
}

async function handleFrequentlyBoughtTogether(c: Context<{ Bindings: Env }>) {
  const itemId = c.req.query('item_id');
  if (!itemId) {
    return c.json({ success: false, error: 'item_id query parameter is required' }, 400);
  }

  const rawLimit = parseInt(c.req.query('limit') || '4', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(10, Math.max(1, rawLimit)) : 4;
  const tenantId = resolveRecommendationsTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const { results: affinities } = await db.prepare(`
    SELECT item_b AS id, co_occurrence_count, affinity_score
    FROM ai_product_affinities
    WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND item_a = ?
    ORDER BY affinity_score DESC, co_occurrence_count DESC
    LIMIT ?
  `).bind(tenantId, tenantId, itemId, limit).all<{ id: string; co_occurrence_count: number; affinity_score: number }>().catch(() => ({ results: [] }));

  if (affinities && affinities.length > 0) {
    const data = affinities.map(a => ({
      id: a.id,
      name: a.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      reason: `Thường được khách gọi cùng (${Math.round(a.affinity_score * 100)}% độ phù hợp)`,
      score: a.affinity_score
    }));
    return c.json({ success: true, data });
  }

  // Fallback if not yet mined
  const fallbacks = FALLBACK_PAIRINGS
    .filter(p => p.id !== itemId)
    .slice(0, limit)
    .map(p => ({ id: p.id, name: p.name, reason: p.reason, score: 0.75 }));

  return c.json({ success: true, data: fallbacks });
}

async function handleTrending(c: Context<{ Bindings: Env }>) {
  const range = c.req.query('range') === '24h' ? 24 : 168; // 24h or 7d
  const rawLimit = parseInt(c.req.query('limit') || '5', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(10, Math.max(1, rawLimit)) : 5;
  const tenantId = resolveRecommendationsTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const hoursAgo = new Date(Date.now() - range * 3600000).toISOString();
  let orders: { items: string; status?: string }[] = [];
  try {
    const res = await db.prepare(`
      SELECT items FROM orders
      WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
        AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired')
        AND created_at >= ?
      ORDER BY created_at DESC LIMIT 200
    `).bind(tenantId, tenantId, hoursAgo).all<{ items: string; status?: string }>();
    orders = res.results || [];
  } catch {
    const res = await db.prepare(`
      SELECT items FROM orders
      WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND status != 'cancelled' AND created_at >= ?
      ORDER BY created_at DESC LIMIT 200
    `).bind(tenantId, tenantId, hoursAgo).all<{ items: string; status?: string }>().catch(() => ({ results: [] }));
    orders = res.results || [];
  }

  const counts = new Map<string, { count: number; name: string }>();
  for (const o of orders || []) {
    const status = typeof o.status === 'string' ? o.status.trim().toLowerCase() : '';
    if (status && ['cancelled', 'failed', 'rejected', 'expired'].includes(status)) continue;
    try {
      const items = (typeof o.items === 'string' ? JSON.parse(o.items) : o.items) as OrderItem[];
      for (const item of items) {
        const id = item.product_id || item.id;
        if (!id) continue;
        const current = counts.get(id) || { count: 0, name: item.name || id };
        current.count += Math.max(1, Number(item.quantity) || 1);
        counts.set(id, current);
      }
    } catch { /* skip malformed */ }
  }

  const sorted = Array.from(counts.entries())
    .map(([id, info]) => ({ id, name: info.name, orders_count: info.count, reason: 'Xu hướng bán chạy tại Sa Đéc' }))
    .sort((a, b) => b.orders_count - a.orders_count)
    .slice(0, limit);

  const finalTrending = sorted.length > 0 ? sorted : FALLBACK_PAIRINGS.slice(0, limit).map(p => ({
    id: p.id, name: p.name, orders_count: 10, reason: 'Món đặc trưng được ưa chuộng'
  }));

  return c.json({ success: true, data: finalTrending });
}

// GET /api/recommendations
recommendationsRouter.get('/', async (c) => {
  if (c.req.query('item_id')) {
    return handleFrequentlyBoughtTogether(c);
  }
  return handleTrending(c);
});

// GET /api/recommendations/frequently-bought-together
recommendationsRouter.get('/frequently-bought-together', handleFrequentlyBoughtTogether);

// GET /api/recommendations/trending
recommendationsRouter.get('/trending', handleTrending);

// POST /api/recommendations/mine-affinities (Owner/Manager/Supervisor/Admin)
recommendationsRouter.post('/mine-affinities', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async (c) => {
  const user = c.get('user' as never) as { role?: string } | undefined;
  if (user?.role && !['owner', 'admin', 'manager', 'supervisor'].includes(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const rawTenant = getTenantId(c);
  const explicitTarget = (
    c.req.query('tenant_id') ||
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    resolvePilotStore(c.env)
  ).trim();
  const targetTenant = rawTenant === '*'
    ? (!explicitTarget || explicitTarget === '*' ? 'default' : explicitTarget)
    : rawTenant;
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  let orders: { items: string; status?: string; tenant_id?: string | null }[] = [];
  try {
    const res = await db.prepare(`
      SELECT items FROM orders
      WHERE LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired')
        AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
      ORDER BY created_at DESC LIMIT 500
    `).bind(targetTenant).all<{ items: string; status?: string; tenant_id?: string | null }>();
    orders = res.results || [];
  } catch {
    try {
      const res = await db.prepare(`
        SELECT items FROM orders
        WHERE status != 'cancelled' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
        ORDER BY created_at DESC LIMIT 500
      `).bind(targetTenant).all<{ items: string; status?: string; tenant_id?: string | null }>();
      orders = res.results || [];
    } catch {
      if (targetTenant === 'default') {
        const res = await db.prepare(`
          SELECT items FROM orders
          WHERE LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'failed', 'rejected', 'expired')
          ORDER BY created_at DESC LIMIT 500
        `).all<{ items: string; status?: string }>().catch(() =>
          db.prepare(`
            SELECT items FROM orders
            WHERE status != 'cancelled'
            ORDER BY created_at DESC LIMIT 500
          `).all<{ items: string; status?: string }>().catch(() => ({ results: [] }))
        );
        orders = res.results || [];
      } else {
        orders = [];
      }
    }
  }

  const coOccur = new Map<string, Map<string, number>>();
  const itemCounts = new Map<string, number>();

  for (const o of orders || []) {
    const status = typeof o.status === 'string' ? o.status.trim().toLowerCase() : '';
    if (status && ['cancelled', 'failed', 'rejected', 'expired'].includes(status)) continue;
    if ('tenant_id' in o && o.tenant_id !== undefined) {
      const rowTenant = String(o.tenant_id || '').trim() || 'default';
      if (rowTenant !== targetTenant) continue;
    }
    try {
      const raw = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      const ids = Array.from(new Set((raw as OrderItem[]).map(i => i.product_id || i.id).filter(Boolean))) as string[];
      for (const id of ids) {
        itemCounts.set(id, (itemCounts.get(id) || 0) + 1);
        if (!coOccur.has(id)) coOccur.set(id, new Map());
        const neighbors = coOccur.get(id)!;
        for (const other of ids) {
          if (other !== id) neighbors.set(other, (neighbors.get(other) || 0) + 1);
        }
      }
    } catch { /* skip */ }
  }

  const statements: import('@cloudflare/workers-types').D1PreparedStatement[] = [];
  let minedPairs = 0;

  for (const [itemA, neighbors] of coOccur.entries()) {
    const totalA = itemCounts.get(itemA) || 1;
    for (const [itemB, count] of neighbors.entries()) {
      const score = Math.round((count / totalA) * 100) / 100;
      const id = `${targetTenant}_${itemA}_${itemB}`;
      statements.push(db.prepare(`
        INSERT INTO ai_product_affinities (id, tenant_id, item_a, item_b, co_occurrence_count, affinity_score, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          co_occurrence_count = excluded.co_occurrence_count,
          affinity_score = excluded.affinity_score,
          updated_at = excluded.updated_at
      `).bind(id, targetTenant, itemA, itemB, count, score));
      minedPairs++;
    }
  }

  if (statements.length > 0) {
    // Execute in chunks of 50
    for (let i = 0; i < statements.length; i += 50) {
      await db.batch(statements.slice(i, i + 50));
    }
  }

  return c.json({ success: true, message: `Mined ${minedPairs} affinity pairs`, mined_pairs: minedPairs });
});
