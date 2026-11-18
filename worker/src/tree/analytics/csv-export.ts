/**
 * CSV Export — D1 query for orders in date range + CSV formatting
 *
 * GET /api/analytics/export?start=YYYY-MM-DD&end=YYYY-MM-DD
 */

export interface OrderExportRow {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  status: string;
  payment_method: string | null;
  items: string; // JSON string
  created_at: string;
}

export interface OrderExportOptions {
  alignIct?: boolean;
  maskPii?: boolean;
}

export function maskPhoneForCsv(phone: string | null | undefined): string {
  const raw = String(phone || '').trim();
  if (!raw || raw.length < 6) return raw ? '***' : '';
  return `${raw.slice(0, 3)}****${raw.slice(-3)}`;
}

/**
 * Get all orders (non-cancelled) within a date range.
 */
export async function getOrdersInRange(
  db: import('@cloudflare/workers-types').D1Database,
  start: string,
  end: string,
  tenantId?: string,
  options?: OrderExportOptions
): Promise<OrderExportRow[]> {
  const hasTenant = Boolean(tenantId && tenantId !== '*');
  const tenantClause = !hasTenant
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND TRIM(tenant_id) = ?';
  const binds = hasTenant && tenantId ? [start, end, tenantId] : [start, end];
  const datePredicate = options?.alignIct
    ? `DATE(datetime(created_at, '+7 hours')) >= ?
      AND DATE(datetime(created_at, '+7 hours')) <= ?`
    : `substr(created_at, 1, 10) >= ?
      AND substr(created_at, 1, 10) <= ?`;
  const baseSql = `
    SELECT id, customer_name, customer_phone, total, status, payment_method, items, created_at
    FROM orders
    WHERE LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
      AND LOWER(COALESCE(TRIM(payment_status), '')) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')
      AND NOT (COALESCE(TRIM(notes), '') = 'Khách QR - cho don mon' AND COALESCE(TRIM(items), '[]') IN ('', '[]'))
      AND ${datePredicate}${tenantClause}
    ORDER BY created_at ASC
    LIMIT 10000
  `;
  try {
    const { results } = await db.prepare(baseSql).bind(...binds).all<OrderExportRow>();
    return results || [];
  } catch {
    try {
      const noNotesSql = `
        SELECT id, customer_name, customer_phone, total, status, payment_method, items, created_at
        FROM orders
        WHERE LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
          AND LOWER(COALESCE(TRIM(payment_status), '')) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')
          AND ${datePredicate}${tenantClause}
        ORDER BY created_at ASC
        LIMIT 10000
      `;
      const { results } = await db.prepare(noNotesSql).bind(...binds).all<OrderExportRow>();
      return results || [];
    } catch {
      const fallbackSql = `
        SELECT id, customer_name, customer_phone, total, status, payment_method, items, created_at
        FROM orders
        WHERE LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
          AND ${datePredicate}${tenantClause}
        ORDER BY created_at ASC
        LIMIT 10000
      `;
      const { results } = await db.prepare(fallbackSql).bind(...binds).all<OrderExportRow>();
      return results || [];
    }
  }
}

/**
 * Format export rows as CSV string with BOM for Excel compatibility
 * and proper CSV escaping.
 */
export function formatCsvRows(rows: OrderExportRow[]): string {
  const headers = [
    'Order ID',
    'Customer Name',
    'Phone',
    'Total',
    'Status',
    'Payment Method',
    'Items',
    'Created At'
  ];

  const lines: string[] = [headers.map(escapeCsvField).join(',')];

  for (const row of rows) {
    // Parse items JSON to extract item names
    let itemNames = '';
    try {
      const parsed = JSON.parse(row.items || '[]');
      if (Array.isArray(parsed)) {
        itemNames = parsed
          .map((item: { name?: string; product_name?: string }) => item.name || item.product_name || '')
          .filter(Boolean)
          .join('; ');
      }
    } catch {
      itemNames = row.items || '';
    }

    const fields = [
      row.id,
      row.customer_name || '',
      row.customer_phone || '',
      String(row.total ?? 0),
      row.status || '',
      row.payment_method || '',
      itemNames,
      row.created_at || ''
    ];
    lines.push(fields.map(escapeCsvField).join(','));
  }

  return '﻿' + lines.join('\n');
}

export interface DailyRevenueExportRow {
  date: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
}

/**
 * Aggregate daily revenue in Vietnam store timezone (UTC+7) within a date range.
 */
export async function getDailyRevenueInRange(
  db: import('@cloudflare/workers-types').D1Database,
  start: string,
  end: string,
  tenantId?: string
): Promise<DailyRevenueExportRow[]> {
  const hasTenant = Boolean(tenantId && tenantId !== '*');
  const tenantClause = !hasTenant
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND TRIM(tenant_id) = ?';
  const binds = hasTenant && tenantId ? [start, end, tenantId] : [start, end];
  const baseSql = `
    SELECT DATE(datetime(created_at, '+7 hours')) AS date,
           COUNT(*) AS orders,
           COALESCE(SUM(total), 0) AS revenue,
           CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(total), 0) * 1.0 / COUNT(*)) ELSE 0 END AS avg_order_value
    FROM orders
    WHERE LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
      AND LOWER(COALESCE(TRIM(payment_status), '')) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')
      AND NOT (COALESCE(TRIM(notes), '') = 'Khách QR - cho don mon' AND COALESCE(TRIM(items), '[]') IN ('', '[]'))
      AND DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ?${tenantClause}
    GROUP BY DATE(datetime(created_at, '+7 hours'))
    ORDER BY date ASC
    LIMIT 1000
  `;
  try {
    const { results } = await db.prepare(baseSql).bind(...binds).all<DailyRevenueExportRow>();
    return results || [];
  } catch {
    const fallbackSql = `
      SELECT DATE(datetime(created_at, '+7 hours')) AS date,
             COUNT(*) AS orders,
             COALESCE(SUM(total), 0) AS revenue,
             CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(total), 0) * 1.0 / COUNT(*)) ELSE 0 END AS avg_order_value
      FROM orders
      WHERE LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
        AND DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ?${tenantClause}
      GROUP BY DATE(datetime(created_at, '+7 hours'))
      ORDER BY date ASC
      LIMIT 1000
    `;
    const { results } = await db.prepare(fallbackSql).bind(...binds).all<DailyRevenueExportRow>();
    return results || [];
  }
}

export function formatDailyRevenueCsvRows(rows: DailyRevenueExportRow[]): string {
  const headers = ['Date (ICT)', 'Orders', 'Revenue (VND)', 'Avg Order Value (VND)'];
  const lines: string[] = [headers.map(escapeCsvField).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.date || '',
        String(row.orders ?? 0),
        String(row.revenue ?? 0),
        String(Math.round(Number(row.avg_order_value ?? 0))),
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }
  return '﻿' + lines.join('\n');
}

/**
 * Escape a CSV field: neutralize spreadsheet formula prefixes and wrap in quotes
 * if it contains comma, newline, semicolon, or double-quote.
 */
export function escapeCsvField(value: string): string {
  const multilineSanitized = value.replace(/([\r\n]+)(\s*[=+\-@|])/g, "$1'$2");
  const sanitized = /^(?:[\t\r\n ]*[=+\-@]|[\t\r\n ]*\|)/.test(multilineSanitized)
    ? `'${multilineSanitized}`
    : multilineSanitized;
  if (
    sanitized.includes(',') ||
    sanitized.includes('\n') ||
    sanitized.includes('\r') ||
    sanitized.includes('"') ||
    sanitized.includes(';')
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}
