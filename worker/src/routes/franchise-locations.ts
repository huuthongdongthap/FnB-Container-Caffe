/**
 * Franchise Locations & Multi-Container Management Router
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { isHQSuperAdmin } from '../middleware/tenant';
import type { FranchiseLocation } from '../types/api';

export const franchiseRouter = new Hono<{ Bindings: Env }>();

const createLocationSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(100),
  tenant_id: z.string().min(2).max(50).optional().default('default'),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional().default('Sa Đéc'),
  phone: z.string().max(20).optional(),
  royalty_percentage: z.number().min(0).max(100).optional().default(5.0),
  status: z.enum(['active', 'suspended', 'closed']).optional().default('active'),
});

franchiseRouter.use('/*', requireAuth(['owner', 'staff', 'manager']));

// GET /api/franchise/locations
franchiseRouter.get('/locations', async (c) => {
  const user = c.get('user');
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const isHQ = isHQSuperAdmin(user);
  const queryTenant = c.req.query('tenant_id');

  let query = 'SELECT * FROM franchise_locations WHERE 1=1';
  const params: unknown[] = [];

  if (isHQ) {
    if (queryTenant && queryTenant !== '*') {
      query += ' AND tenant_id = ?';
      params.push(queryTenant);
    }
  } else {
    query += ' AND tenant_id = ?';
    params.push(user?.tenantId ?? 'default');
  }

  query += ' ORDER BY code ASC';
  const { results } = await db.prepare(query).bind(...params).all<FranchiseLocation>();
  return c.json({ success: true, data: results });
});

// POST /api/franchise/locations (Owner only)
franchiseRouter.post('/locations', requireAuth(['owner']), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500);
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

  if (!isHQSuperAdmin(user) && location.tenant_id !== (user?.tenantId ?? 'default')) {
    return c.json({ success: false, error: 'Access denied to this franchise location' }, 403);
  }

  return c.json({ success: true, data: location });
});

// GET /api/franchise/locations/:id/metrics
franchiseRouter.get('/locations/:id/metrics', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const location = await db.prepare('SELECT * FROM franchise_locations WHERE id = ?').bind(id).first<FranchiseLocation>();
  if (!location) {
    return c.json({ success: false, error: 'Location not found' }, 404);
  }

  if (!isHQSuperAdmin(user) && location.tenant_id !== (user?.tenantId ?? 'default')) {
    return c.json({ success: false, error: 'Access denied to this franchise location' }, 403);
  }

  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');

  let query = `
    SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as gross_sales
    FROM orders
    WHERE tenant_id = ? AND status != 'cancelled'
  `;
  const params: unknown[] = [location.tenant_id];

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
