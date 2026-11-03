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
import { optionalAuth } from '../middleware/auth';
import { getTenantId as getCanonicalTenantId, matchesTenantRow } from '../lib/db';
import type { Env } from '../types/env';
import { createLogger } from '../utils/logger.js';

function getTenantId(c: any): string {
  const user = c.get('user') as { tenantId?: string; role?: string } | undefined;
  if (user) {
    return getCanonicalTenantId(c);
  }
  // Public signage endpoints resolve tenant from the deployment-bound pilot store only.
  // Never trust X-Tenant-ID or query params from unauthenticated requests.
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

function matchesCategoryTenant(row: SignageDbRow, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if (!('category_tenant_id' in row) || row.category_tenant_id === undefined) return true;
  const catTenant = typeof row.category_tenant_id === 'string' && row.category_tenant_id.trim() !== ''
    ? row.category_tenant_id.trim()
    : 'default';
  return catTenant === tenantId;
}

function isPromoWithinUsageLimits(row: Record<string, unknown>): boolean {
  const used = Number(row.used_count ?? row.current_uses ?? row.usage_count ?? 0);
  if (row.max_uses !== undefined && row.max_uses !== null) {
    const maxUses = Number(row.max_uses);
    if (Number.isFinite(maxUses) && maxUses > 0 && used >= maxUses) {
      return false;
    }
  }
  if (row.usage_limit !== undefined && row.usage_limit !== null) {
    const usageLimit = Number(row.usage_limit);
    if (Number.isFinite(usageLimit) && usageLimit > 0 && used >= usageLimit) {
      return false;
    }
  }
  return true;
}

function normalizeSignagePromo(row: Record<string, unknown>): SignagePromo {
  return {
    code: String(row.code ?? ''),
    percent: Number(row.percent ?? row.discount_value ?? row.value ?? 0),
    max_discount: Number(row.max_discount ?? row.max_discount_value ?? 0),
    min_order: Number(row.min_order ?? row.min_order_value ?? 0),
    expires_at: (row.expires_at ?? row.valid_to ?? row.end_date ?? null) as unknown as string,
  };
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
  category_tenant_id?: string | null;
}

const log = createLogger({ route: 'signage' });

export const signageRouter = new Hono<{ Bindings: Env }>();
signageRouter.use('*', async(c, next) => {
  if (!c.get('user' as any) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});

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
          c.sort_order AS category_sort_order,
          c.tenant_id AS category_tenant_id
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = 1
        ORDER BY c.sort_order ASC, p.name ASC
      `).all<SignageDbRow>();
      rows = (results || []).filter((r) => matchesTenantRow(r, tenantId) && matchesCategoryTenant(r, tenantId));
    } catch {
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
        rows = (results || []).filter((r) => matchesTenantRow(r, tenantId) && matchesCategoryTenant(r, tenantId));
      } catch {
        if (tenantId === 'default' || tenantId === '*') {
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
      }
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
    let rawResults: Array<Record<string, unknown>> | undefined;
    try {
      const res = await db.prepare(
        `SELECT
           code,
           COALESCE(percent, discount_value, value, 0) AS percent,
           COALESCE(max_discount, max_discount_value, 0) AS max_discount,
           COALESCE(min_order, min_order_value, 0) AS min_order,
           COALESCE(expires_at, valid_to, end_date) AS expires_at,
           tenant_id,
           max_uses,
           usage_limit,
           used_count
         FROM promotions
         WHERE is_active = 1
           AND (starts_at IS NULL OR starts_at <= datetime('now'))
           AND (expires_at IS NULL OR expires_at >= datetime('now'))
           AND (valid_from IS NULL OR valid_from <= datetime('now'))
           AND (valid_to IS NULL OR valid_to >= datetime('now'))
           AND (max_uses IS NULL OR max_uses <= (0) OR COALESCE(used_count, 0) < max_uses)
           AND (usage_limit IS NULL OR usage_limit <= (0) OR COALESCE(used_count, 0) < usage_limit)`
      ).all<Record<string, unknown>>();
      rawResults = res.results;
    } catch {
      try {
        const res = await db.prepare(
          `SELECT
             *,
             COALESCE(discount_value, 0) AS percent,
             COALESCE(max_discount_value, 0) AS max_discount,
             COALESCE(min_order_value, 0) AS min_order,
             valid_to AS expires_at
           FROM promotions
           WHERE is_active = 1
             AND (valid_from IS NULL OR valid_from <= datetime('now'))
             AND (valid_to IS NULL OR valid_to >= datetime('now'))
             AND (max_uses IS NULL OR max_uses <= (0) OR COALESCE(current_uses, 0) < max_uses)`
        ).all<Record<string, unknown>>();
        rawResults = res.results;
      } catch {
        try {
          const res = await db.prepare(
            `SELECT *
             FROM promotions
             WHERE is_active = 1
               AND (starts_at IS NULL OR starts_at <= datetime('now'))
               AND (expires_at IS NULL OR expires_at >= datetime('now'))`
          ).all<Record<string, unknown>>();
          rawResults = res.results;
        } catch {
          const now = new Date().toISOString();
          const res = await db.prepare(
            `SELECT *, value AS percent, end_date AS expires_at
             FROM promotions
             WHERE is_active = 1
               AND (start_date IS NULL OR datetime(start_date) <= datetime(?))
               AND (end_date IS NULL OR datetime(end_date) > datetime(?))
             ORDER BY value DESC`
          ).bind(now, now).all<Record<string, unknown>>();
          rawResults = res.results;
        }
      }
    }

    const filtered = (rawResults || [])
      .filter((r) => matchesTenantRow(r, tenantId) && isPromoWithinUsageLimits(r))
      .map(normalizeSignagePromo);

    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ success: true, data: filtered });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('signage_promos_failed', { error: msg });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});
