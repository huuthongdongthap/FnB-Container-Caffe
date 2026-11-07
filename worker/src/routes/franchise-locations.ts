/**
 * Franchise Locations & Multi-Container Management Router
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../middleware/tenant';
import { matchesTenantRow } from '../lib/db';
import { createLogger } from '../middleware/logger';
import type { FranchiseLocation } from '../types/api';

const log = createLogger({ route: 'franchise-locations' });

export const franchiseRouter = new Hono<{ Bindings: Env }>();

const createLocationSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(2).max(100),
  tenant_id: z.string().min(1).max(50).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional().default('Sa Đéc'),
  phone: z.string().max(20).optional(),
  royalty_percentage: z.number().min(0).max(100).optional().default(5.0),
  status: z.enum(['active', 'suspended', 'closed']).optional().default('active'),
});

const ISO_DATE_FILTER_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isValidDateFilter(value: string): boolean {
  return ISO_DATE_FILTER_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function extractFranchiseTenantCandidates(c: any): string[] {
  return [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

function resolveFranchiseRequestedTenant(c: any): string {
  return extractFranchiseTenantCandidates(c)[0] || '';
}

function resolveFranchiseTargetTenant(c: any, user: any): string {
  const reqTenant = resolveFranchiseRequestedTenant(c);
  if (isHQSuperAdmin(user)) {
    const candidate = reqTenant || getTenantId(c).trim() || '*';
    return candidate.toLowerCase() === 'hq' ? '*' : candidate;
  }
  const boundTenant = String(user?.tenantId || user?.tenant_id || '').trim() || getTenantId(c).trim() || 'default';
  return boundTenant.toLowerCase() === 'hq' ? 'default' : boundTenant;
}

franchiseRouter.use('/*', requireAuth(['owner', 'admin', 'staff', 'manager', 'supervisor']));
franchiseRouter.use('/*', async (c, next) => {
  const candidates = extractFranchiseTenantCandidates(c);
  if (new Set(candidates).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user && !isHQSuperAdmin(user)) {
    const boundTenant = (user.tenantId || user.tenant_id || '').trim() || 'default';
    const reqTenant = candidates[0] || '';
    const resolvedTenant = getTenantId(c).trim() || 'default';
    if (
      boundTenant === '*' ||
      boundTenant.toLowerCase() === 'hq' ||
      resolvedTenant === '*' ||
      resolvedTenant.toLowerCase() === 'hq' ||
      resolvedTenant !== boundTenant ||
      (reqTenant && (reqTenant === '*' || reqTenant.toLowerCase() === 'hq' || reqTenant !== boundTenant))
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  }
  return next();
});

// GET /api/franchise/locations
franchiseRouter.get('/locations', async (c) => {
  const user = c.get('user');
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const targetTenant = resolveFranchiseTargetTenant(c, user);

  let sql = 'SELECT * FROM franchise_locations WHERE 1=1';
  const params: unknown[] = [];
  if (targetTenant !== '*') {
    sql += targetTenant === 'default'
      ? " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      : ' AND tenant_id = ?';
    params.push(targetTenant);
  }
  sql += ' ORDER BY code ASC';

  const { results } = await db.prepare(sql).bind(...params).all<FranchiseLocation>();
  const filtered = (results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, targetTenant));
  return c.json({ success: true, data: filtered });
});

// POST /api/franchise/locations (Owner/Admin only)
franchiseRouter.post('/locations', requireAuth(['owner', 'admin']), async (c) => {
  const user = c.get('user');
  if (!isHQSuperAdmin(user)) {
    return c.json({ success: false, error: 'Only HQ administrators can register franchise locations' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = createLocationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid data' }, 400);
  }

  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const data = parsed.data;
  const normalizedTenantId = (data.tenant_id || '').trim();
  if (
    !normalizedTenantId ||
    normalizedTenantId === 'default' ||
    normalizedTenantId === '*' ||
    normalizedTenantId.toLowerCase() === 'hq' ||
    !/^[A-Za-z0-9_-]{2,50}$/.test(normalizedTenantId)
  ) {
    return c.json(
      { success: false, error: 'Explicit non-default store tenant_id is required when registering a franchise location' },
      400
    );
  }
  const normalizedCode = data.code.trim().toUpperCase();
  const existingByCode = await db
    .prepare('SELECT id FROM franchise_locations WHERE lower(code) = lower(?)')
    .bind(normalizedCode)
    .first()
    .catch(() => null);
  if (existingByCode) {
    return c.json({ success: false, error: 'Franchise location code already exists' }, 409);
  }
  const locId = `loc_${normalizedCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;

  try {
    await db.prepare(`
      INSERT INTO franchise_locations (
        id, tenant_id, code, name, address, city, phone, royalty_percentage, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      locId, normalizedTenantId, normalizedCode, data.name,
      data.address || null, data.city, data.phone || null,
      data.royalty_percentage, data.status
    ).run();

    const created = await db.prepare('SELECT * FROM franchise_locations WHERE id = ?').bind(locId).first<FranchiseLocation>();
    return c.json({ success: true, data: created }, 201);
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (/unique constraint|duplicate/i.test(msg)) {
      return c.json({ success: false, error: 'Franchise location code already exists' }, 409);
    }
    log.error('Failed to register franchise location:', { message: msg });
    return c.json({ success: false, error: 'Failed to register franchise location' }, 500);
  }
});

// GET /api/franchise/locations/:id
franchiseRouter.get('/locations/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const targetTenant = resolveFranchiseTargetTenant(c, user);

  let location = await db
    .prepare(
      "SELECT * FROM franchise_locations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
    )
    .bind(id, targetTenant, targetTenant)
    .first<FranchiseLocation>()
    .catch(() => null);
  if (!location) {
    const rawLocation = await db.prepare('SELECT * FROM franchise_locations WHERE id = ?').bind(id).first<FranchiseLocation>();
    if (!rawLocation) {
      return c.json({ success: false, error: 'Location not found' }, 404);
    }
    const rawRec = rawLocation as unknown as Record<string, unknown>;
    if (
      (targetTenant !== 'default' && targetTenant !== '*' && !('tenant_id' in rawRec)) ||
      !matchesTenantRow(rawRec, targetTenant)
    ) {
      return c.json({ success: false, error: 'Access denied to this franchise location' }, 403);
    }
    location = rawLocation;
  }

  if (!matchesTenantRow(location as unknown as Record<string, unknown>, targetTenant)) {
    return c.json({ success: false, error: 'Access denied to this franchise location' }, 403);
  }

  return c.json({ success: true, data: location });
});

// GET /api/franchise/locations/:id/metrics
franchiseRouter.get('/locations/:id/metrics', requireAuth(['owner', 'admin', 'manager', 'supervisor']), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  if ((startDate && !isValidDateFilter(startDate)) || (endDate && !isValidDateFilter(endDate))) {
    return c.json({ success: false, error: 'Invalid date filter' }, 400);
  }

  const targetTenant = resolveFranchiseTargetTenant(c, user);

  let location = await db
    .prepare(
      "SELECT * FROM franchise_locations WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
    )
    .bind(id, targetTenant, targetTenant)
    .first<FranchiseLocation>()
    .catch(() => null);
  if (!location) {
    const rawLocation = await db.prepare('SELECT * FROM franchise_locations WHERE id = ?').bind(id).first<FranchiseLocation>();
    if (!rawLocation) {
      return c.json({ success: false, error: 'Location not found' }, 404);
    }
    const rawRec = rawLocation as unknown as Record<string, unknown>;
    if (
      (targetTenant !== 'default' && targetTenant !== '*' && !('tenant_id' in rawRec)) ||
      !matchesTenantRow(rawRec, targetTenant)
    ) {
      return c.json({ success: false, error: 'Access denied to this franchise location' }, 403);
    }
    location = rawLocation;
  }

  if (!matchesTenantRow(location as unknown as Record<string, unknown>, targetTenant)) {
    return c.json({ success: false, error: 'Access denied to this franchise location' }, 403);
  }

  const rawLocTenant = (typeof location.tenant_id === 'string' && location.tenant_id.trim()) || 'default';
  const locTenant = rawLocTenant === '*' || rawLocTenant.toLowerCase() === 'hq' ? 'default' : rawLocTenant;
  const normalizedEndDate = endDate && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(endDate)
    ? `${endDate}T23:59:59.999Z`
    : endDate;

  let dateClause = '';
  const dateParams: unknown[] = [];
  if (startDate) {
    dateClause += ' AND created_at >= ?';
    dateParams.push(startDate);
  }
  if (normalizedEndDate) {
    dateClause += ' AND created_at <= ?';
    dateParams.push(normalizedEndDate);
  }

  const primaryQuery = `
    SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as gross_sales
    FROM orders
    WHERE (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?1)
      AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
      AND LOWER(COALESCE(payment_status, '')) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')${dateClause}
  `;
  const statusOnlyScopedQuery = `
    SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as gross_sales
    FROM orders
    WHERE (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?1)
      AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')${dateClause}
  `;
  const unscopedFallbackQuery = `
    SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as gross_sales
    FROM orders
    WHERE LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')${dateClause}
  `;

  let stats: { order_count: number; gross_sales: number } | null = null;
  try {
    stats = await db.prepare(primaryQuery).bind(locTenant, ...dateParams).first<{ order_count: number; gross_sales: number }>();
  } catch {
    try {
      stats = await db.prepare(statusOnlyScopedQuery).bind(locTenant, ...dateParams).first<{ order_count: number; gross_sales: number }>();
    } catch {
      if (locTenant === 'default') {
        stats = await db.prepare(unscopedFallbackQuery).bind(...dateParams).first<{ order_count: number; gross_sales: number }>().catch(() => null);
      } else {
        stats = { order_count: 0, gross_sales: 0 };
      }
    }
  }
  const grossSales = Number(stats?.gross_sales || 0);
  const orderCount = Number(stats?.order_count || 0);
  const royaltyPercentage = Number(location.royalty_percentage || 5.0);
  const royaltyAmount = Math.round((grossSales * royaltyPercentage) / 100);
  const netFranchiseePayout = grossSales - royaltyAmount;

  return c.json({
    success: true,
    data: {
      location_id: location.id,
      code: location.code,
      name: location.name,
      tenant_id: location.tenant_id,
      order_count: orderCount,
      gross_sales: grossSales,
      royalty_percentage: royaltyPercentage,
      royalty_amount: royaltyAmount,
      net_franchisee_payout: netFranchiseePayout
    }
  });
});
