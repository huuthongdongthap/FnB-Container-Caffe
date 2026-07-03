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

const VALID_RANGES = ['24h', '7d', '30d'] as const;
type Range = typeof VALID_RANGES[number];

const salesCsvSchema = z
  .object({
    range: z.enum(VALID_RANGES).optional(),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start must be YYYY-MM-DD').optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end must be YYYY-MM-DD').optional(),
  })
  .refine(
    (data) => !(data.range && (data.start || data.end)),
    { message: 'range cannot be combined with start/end' },
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
 * Escape a CSV field per RFC 4180.
 */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const adminSalesRouter = new Hono<{ Bindings: Env }>();

adminSalesRouter.get('/csv', async (c) => {
  const parsed = salesCsvSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid query parameters',
    }, 400);
  }

  const { range, start: rawStart, end: rawEnd } = parsed.data;

  let startDate: string;
  let endDate: string;

  if (range) {
    const hours = getRangeHours(range);
    endDate = formatDate(new Date());
    startDate = formatDate(new Date(Date.now() - hours * 3600000));
  } else {
    // Default to last 30 days if neither range nor start/end provided
    startDate = rawStart || formatDate(new Date(Date.now() - 720 * 3600000));
    endDate = rawEnd || formatDate(new Date());
  }

  const db = c.env.AURA_DB;

  const { results } = await db.prepare(`
    SELECT id, customer_name, items, total, payment_method, status, created_at
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= ? || ' 00:00:00'
      AND created_at <= ? || ' 23:59:59'
    ORDER BY created_at ASC
  `).bind(startDate, endDate).all<SalesCsvRow>();

  const rows = results || [];

  // Bilingual VN+EN headers
  const headers = [
    'Order ID',
    'Order Date (Ngay Dat)',
    'Customer (Khach Hang)',
    'Items (So Mon)',
    'Total (Tong Tien)',
    'Payment Method (Thanh Toan)',
    'Status (Trang Thai)',
  ];

  const lines: string[] = [headers.map(escapeCsv).join(',')];

  for (const row of rows) {
    // Parse items JSON to count number of items
    let itemCount = '0';
    let itemNames = '';
    try {
      const parsed = JSON.parse(row.items || '[]');
      if (Array.isArray(parsed)) {
        itemCount = String(parsed.length);
        itemNames = parsed
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
      row.status || '',
    ];

    lines.push(fields.map(escapeCsv).join(','));
  }

  const bom = '﻿';
  const csv = bom + lines.join('\n');
  const filename = `sales-report-${startDate}.csv`;

  return c.newResponse(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
});
