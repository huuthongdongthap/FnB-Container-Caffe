/**
 * Admin Sales Routes — CSV export with bilingual VN+EN headers
 *
 * GET /api/admin/sales/csv?range=24h|7d|30d&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Auth: guarded by /api/admin/* requireAuth in index.ts
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { optionalAuth } from '../middleware/auth';
import { getTenantId, isHQSuperAdmin, matchesTenantRow } from '../middleware/tenant';

const VALID_RANGES = ['24h', '7d', '30d'] as const;
type Range = typeof VALID_RANGES[number];

const salesCsvSchema = z
  .object({
    range: z.enum(VALID_RANGES).optional(),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start must be YYYY-MM-DD').optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end must be YYYY-MM-DD').optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional()
  })
  .refine(
    (data) => !(data.range && (data.start || data.end || data.startDate || data.endDate)),
    { message: 'range cannot be combined with start/end' }
  );

interface SalesCsvRow {
  id: string;
  customer_name: string | null;
  items: string; // JSON string
  total: number;
  payment_method: string | null;
  status: string;
  created_at: string;
}

function getRangeHours(range: Range): number {
  switch (range) {
  case '24h': return 24;
  case '7d': return 168;
  case '30d': return 720;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Escape a CSV field per RFC 4180 and neutralize spreadsheet formula triggers.
 */
function escapeCsv(value: string): string {
  const str = String(value ?? '');
  const prefixed = (/^[\t\r\n ]*[=+\-@]/.test(str) || /^[=+\-@|]/.test(str.trimStart())) ? `'${str}` : str;
  const safe = prefixed.replace(/([\r\n]+)(\s*[=+\-@|])/g, "$1'$2");
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export const adminSalesRouter = new Hono<{ Bindings: Env }>();
adminSalesRouter.use('*', async(c, next) => {
  if (!c.get('user' as any) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});

const SALES_EXPORT_ALLOWED_ROLES = ['owner', 'manager', 'admin'];

adminSalesRouter.get('/csv', async(c) => {
  const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (!user?.role) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  const roleLower = String(user.role).toLowerCase();
  const isAuthBearerSupervisor = roleLower === 'supervisor' && Boolean(c.req.header('Authorization') || c.req.header('authorization'));
  if (!SALES_EXPORT_ALLOWED_ROLES.includes(roleLower) && !isAuthBearerSupervisor) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim() ? rawUserTenant.trim() : 'default';
  const normalizedUser = { ...user, role: roleLower, tenantId: userTenant };
  (c as unknown as { set?: (k: string, v: unknown) => void }).set?.('user', normalizedUser);
  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-store-id'),
    c.req.header('X-Store-ID'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
  }
  const rawTenantId = getTenantId(c);
  const requestedTenant = candidateOverrides[0] || '';
  const isHq = isHQSuperAdmin(normalizedUser as any);
  if (!isHq) {
    if (
      userTenant === '*' ||
      userTenant.toLowerCase() === 'hq' ||
      rawTenantId === '*' ||
      rawTenantId.toLowerCase() === 'hq' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      userTenant !== rawTenantId ||
      (requestedTenant && requestedTenant !== userTenant)
    ) {
      return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
    }
  }
  const hqTarget = requestedTenant || rawTenantId || '*';
  const effectiveTenant = isHq ? (hqTarget.toLowerCase() === 'hq' ? '*' : hqTarget) : userTenant;

  const parsed = salesCsvSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid query parameters'
    }, 400);
  }

  const { range, start: rawStart, end: rawEnd, startDate: rawStartDate, endDate: rawEndDate } = parsed.data;

  let startDate: string;
  let endDate: string;

  if (range) {
    const hours = getRangeHours(range);
    endDate = formatDate(new Date());
    startDate = formatDate(new Date(Date.now() - hours * 3600000));
  } else {
    // Default to last 30 days if neither range nor start/end provided
    startDate = rawStart || rawStartDate || formatDate(new Date(Date.now() - 720 * 3600000));
    endDate = rawEnd || rawEndDate || formatDate(new Date());
  }

  if (startDate && endDate) {
    const startMs = Date.parse(startDate);
    const endMs = Date.parse(endDate);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
      return c.json({ success: false, error: 'startDate must be on or before endDate' }, 400);
    }
    if ((endMs - startMs) / 86_400_000 > 366) {
      return c.json({ success: false, error: 'Date range cannot exceed 366 days' }, 400);
    }
  }

  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as D1Database;
  const normalizedEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T23:59:59.999Z` : endDate;

  let results: SalesCsvRow[] | undefined;
  try {
    const res = await db.prepare(`
      SELECT id, customer_name, items, total, payment_method, status, created_at
      FROM orders
      WHERE (? = '*' OR tenant_id = ? OR TRIM(tenant_id) = ?2 OR (? = 'default' AND (tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')))
        AND LOWER(TRIM(COALESCE(status, ''))) NOT IN ('cancelled', 'refunded', 'failed', 'expired')
        AND LOWER(TRIM(COALESCE(status, ''))) NOT IN ('canceled', 'rejected')
        AND LOWER(TRIM(COALESCE(payment_status, ''))) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')
        AND created_at >= ?
        AND created_at <= ?
      ORDER BY created_at ASC
      LIMIT 5000
    `).bind(effectiveTenant, effectiveTenant, effectiveTenant, startDate, normalizedEndDate).all<SalesCsvRow>();
    results = res.results;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (/no such column:\s*payment_status/i.test(errMsg)) {
      const res = await db.prepare(`
        SELECT id, customer_name, items, total, payment_method, status, created_at
        FROM orders
        WHERE (? = '*' OR tenant_id = ? OR TRIM(tenant_id) = ?2 OR (? = 'default' AND (tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')))
          AND LOWER(TRIM(COALESCE(status, ''))) NOT IN ('cancelled', 'refunded', 'failed', 'expired')
          AND LOWER(TRIM(COALESCE(status, ''))) NOT IN ('canceled', 'rejected')
          AND created_at >= ?
          AND created_at <= ?
        ORDER BY created_at ASC
        LIMIT 5000
      `).bind(effectiveTenant, effectiveTenant, effectiveTenant, startDate, normalizedEndDate).all<SalesCsvRow>();
      results = res.results;
    } else if (/no such column:\s*tenant_id/i.test(errMsg)) {
      if (effectiveTenant === 'default' || effectiveTenant === '*') {
        const res = await db.prepare(`
          SELECT id, customer_name, items, total, payment_method, status, created_at
          FROM orders
          WHERE LOWER(TRIM(COALESCE(status, ''))) NOT IN ('cancelled', 'refunded', 'failed', 'expired', 'canceled', 'rejected')
            AND created_at >= ?
            AND created_at <= ?
          ORDER BY created_at ASC
          LIMIT 5000
        `).bind(startDate, normalizedEndDate).all<SalesCsvRow>();
        results = res.results;
      } else {
        results = [];
      }
    } else {
      throw err;
    }
  }

  const nonRevenueStatuses = new Set(['cancelled', 'canceled', 'refunded', 'failed', 'expired', 'rejected']);
  const nonRevenuePaymentStatuses = new Set(['refunded', 'failed', 'cancelled', 'canceled']);
  const rows = (results || []).filter((r: SalesCsvRow & { payment_status?: string | null; tenant_id?: string | null }) => {
    if ('tenant_id' in r && r.tenant_id !== undefined && !matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)) {
      return false;
    }
    const st = String(r.status ?? '').trim().toLowerCase();
    const pst = String(r.payment_status ?? '').trim().toLowerCase();
    return !nonRevenueStatuses.has(st) && !nonRevenuePaymentStatuses.has(pst);
  });

  // Bilingual VN+EN headers
  const headers = [
    'Order ID',
    'Order Date (Ngay Dat)',
    'Customer (Khach Hang)',
    'Items (So Mon)',
    'Total (Tong Tien)',
    'Payment Method (Thanh Toan)',
    'Status (Trang Thai)'
  ];

  const lines: string[] = [headers.map(escapeCsv).join(',')];

  for (const row of rows) {
    // Parse items JSON to count number of items
    let itemCount = '0';
    let itemNames = '';
    try {
      const parsedItems = JSON.parse(row.items || '[]');
      if (Array.isArray(parsedItems)) {
        itemCount = String(parsedItems.length);
        itemNames = parsedItems
          .map((item: { name?: string; product_name?: string }) => item.name || item.product_name || '')
          .filter(Boolean)
          .join('; ');
      }
    } catch {
      itemCount = row.items || '0';
    }

    // Format order date
    const orderDate = row.created_at ? row.created_at.slice(0, 10) : '';

    const fields = [
      row.id,
      orderDate,
      row.customer_name || '',
      // Include both count and item names in the Items column
      itemCount + (itemNames ? `: ${itemNames}` : ''),
      String(row.total ?? 0),
      row.payment_method || '',
      row.status || ''
    ];

    lines.push(fields.map(escapeCsv).join(','));
  }

  const bom = '﻿';
  const csv = bom + lines.join('\n');
  const filename = `sales-report-${startDate}.csv`;

  return c.newResponse(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`
  });
});
