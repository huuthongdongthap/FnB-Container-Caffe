/**
 * Signage Routes — Xibo digital signage widget endpoints
 *
 * Public endpoints for local network Xibo players.
 * No auth required, CORS handled by parent router.
 * Cache-Control: public, max-age=300 (5 min).
 *
 * GET /api/signage/menu  — categories with available products
 * GET /api/signage/promos — active promotions
 */

import { Hono } from 'hono';
import { resolvePilotStore } from '../lib/pilot-store';
import type { Env } from '../types/env';
import { createLogger } from '../utils/logger.js';

function getTenantId(c: {
  env: Env;
  req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): string {
  const user = c.get('user') as { tenantId?: string } | undefined;
  if (user?.tenantId && user.tenantId.trim()) return user.tenantId.trim();
  const requested = c.req.header('X-Tenant-ID') || c.req.query('tenant_id');
  if (requested && requested.trim()) return requested.trim();
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

function matchesTenantRow(row: unknown, tenantId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  if (r.tenant_id === undefined) {
    return tenantId === 'default';
  }
  const rowTenant = typeof r.tenant_id === 'string' && r.tenant_id.trim() ? r.tenant_id.trim() : 'default';
  return rowTenant === tenantId;
}

interface SignageProduct {
  name: string;
  price: number;
  image: string;
  description: string;
}

interface SignageCategory {
  id: number;
  name: string;
  sort_order: number;
  products: SignageProduct[];
}

interface SignagePromo {
  code: string;
  percent: number;
  max_discount: number;
  min_order: number;
  expires_at: string;
}

interface SignageDbRow {
  product_name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  category_id: number;
  category_name: string;
  category_sort_order: number;
  tenant_id?: string | null;
}

const log = createLogger({ route: 'signage' });

export const signageRouter = new Hono<{ Bindings: Env }>();

// ── GET /api/signage/menu ──────────────────────────────────────────
signageRouter.get('/menu', async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  try {
    let rows: SignageDbRow[] = [];
    try {
      const { results } = await db.prepare(`
        SELECT
          p.name AS product_name,
          p.price,
          p.image_url,
          p.description,
          p.category_id,
          p.tenant_id,
          c.id AS category_id,
          c.name AS category_name,
          c.sort_order AS category_sort_order
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = 1
        ORDER BY c.sort_order ASC, p.name ASC
      `).all<SignageDbRow>();
      rows = (results || []).filter((r) => matchesTenantRow(r, tenantId));
    } catch {
      const { results } = await db.prepare(`
        SELECT
          p.name AS product_name,
          p.price,
          p.image_url,
          p.description,
          p.category_id,
          c.id AS category_id,
          c.name AS category_name,
          c.sort_order AS category_sort_order
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = 1
        ORDER BY c.sort_order ASC, p.name ASC
      `).all<SignageDbRow>();
      rows = (results || []).filter((r) => matchesTenantRow(r, tenantId));
    }

    // Group products by category
    const categoryMap = new Map<number, SignageCategory>();
    for (const row of rows) {
      const catId = row.category_id;
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: row.category_name,
          sort_order: row.category_sort_order,
          products: []
        });
      }
      categoryMap.get(catId)!.products.push({
        name: row.product_name,
        price: row.price,
        image: row.image_url || '',
        description: row.description || ''
      });
    }

    const data = Array.from(categoryMap.values())
      .sort((a, b) => a.sort_order - b.sort_order);

    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ success: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('signage_menu_failed', { error: msg });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── GET /api/signage/promos ─────────────────────────────────────────
signageRouter.get('/promos', async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  try {
    let rawResults: Array<SignagePromo & { tenant_id?: string | null }> | undefined;
    try {
      const res = await db.prepare(
        `SELECT code, percent, max_discount, min_order, expires_at, tenant_id
         FROM promotions
         WHERE is_active = 1
           AND (starts_at IS NULL OR starts_at <= datetime('now'))
           AND (expires_at IS NULL OR expires_at >= datetime('now'))`
      ).all<SignagePromo & { tenant_id?: string | null }>();
      rawResults = res.results;
    } catch {
      try {
        const res = await db.prepare(
          `SELECT code, percent, max_discount, min_order, expires_at
           FROM promotions
           WHERE is_active = 1
             AND (starts_at IS NULL OR starts_at <= datetime('now'))
             AND (expires_at IS NULL OR expires_at >= datetime('now'))`
        ).all<SignagePromo>();
        rawResults = res.results;
      } catch {
        const now = new Date().toISOString();
        const res = await db.prepare(
          `SELECT code, value AS percent, max_discount, min_order, end_date AS expires_at
           FROM promotions
           WHERE is_active = 1
             AND (start_date IS NULL OR datetime(start_date) <= datetime(?))
             AND (end_date IS NULL OR datetime(end_date) > datetime(?))
           ORDER BY value DESC`
        ).bind(now, now).all<SignagePromo>();
        rawResults = res.results;
      }
    }

    const filtered = (rawResults || [])
      .filter((r) => matchesTenantRow(r, tenantId))
      .map(({ code, percent, max_discount, min_order, expires_at }) => ({
        code,
        percent,
        max_discount,
        min_order,
        expires_at
      }));

    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ success: true, data: filtered });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('signage_promos_failed', { error: msg });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});
