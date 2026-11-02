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
  tenant_id: z.string().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/).optional().default('default'),
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

franchiseRouter.use('/*', requireAuth(['owner', 'admin', 'staff', 'manager', 'supervisor']));

// GET /api/franchise/locations
franchiseRouter.get('/locations', async (c) => {
  const user = c.get('user');
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const isHQ = isHQSuperAdmin(user);
  const queryTenant = (c.req.query('tenant_id') || c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id') || '').trim();
  const targetTenant = isHQ ? (queryTenant || '*') : getTenantId(c);

  let sql = 'SELECT * FROM franchise_locations WHERE 1=1';
  const params: unknown[] = [];
  if (targetTenant !== '*') {
    if (targetTenant === 'default') {
      sql += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
    } else {
      sql += ' AND tenant_id = ?';
    }
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
  const locId = `loc_${data.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;

  try {
    await db.prepare(`
      INSERT INTO franchise_locations (
        id, tenant_id, code, name, address, city, phone, royalty_percentage, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      locId, data.tenant_id, data.code, data.name,
      data.address || null, data.city, data.phone || null,
      data.royalty_percentage, data.status
    ).run();

    const created = await db.prepare('SELECT * FROM franchise_locations WHERE id = ?').bind(locId).first<FranchiseLocation>();
    return c.json({ success: true, data: created }, 201);
  } catch (err) {
    log.error('Failed to register franchise location:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Failed to register franchise location' }, 500);
  }
});

// GET /api/franchise/locations/:id
franchiseRouter.get('/locations/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const location = await db.prepare('SELECT * FROM franchise_locations WHERE id = ?').bind(id).first<FranchiseLocation>();
  if (!location) {
    return c.json({ success: false, error: 'Location not found' }, 404);
  }

  const queryTenant = (c.req.query('tenant_id') || c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id') || '').trim();
  const targetTenant = isHQSuperAdmin(user) ? (queryTenant || '*') : getTenantId(c);
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

  const location = await db.prepare('SELECT * FROM franchise_locations WHERE id = ?').bind(id).first<FranchiseLocation>();
  if (!location) {
    return c.json({ success: false, error: 'Location not found' }, 404);
  }

  const queryTenant = (c.req.query('tenant_id') || c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id') || '').trim();
  const targetTenant = isHQSuperAdmin(user) ? (queryTenant || '*') : getTenantId(c);
  if (!matchesTenantRow(location as unknown as Record<string, unknown>, targetTenant)) {
    return c.json({ success: false, error: 'Access denied to this franchise location' }, 403);
  }

  let query = `
    SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as gross_sales
    FROM orders
    WHERE (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?1) AND status != 'cancelled'
  `;
  const params: unknown[] = [location.tenant_id || 'default'];

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  const stats = await db.prepare(query).bind(...params).first<{ order_count: number; gross_sales: number }>();
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
