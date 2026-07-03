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

/**
 * Get all orders (non-cancelled) within a date range.
 */
export async function getOrdersInRange(
  db: import('@cloudflare/workers-types').D1Database,
  start: string,
  end: string,
): Promise<OrderExportRow[]> {
  const { results } = await db.prepare(`
    SELECT id, customer_name, customer_phone, total, status, payment_method, items, created_at
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= ? || ' 00:00:00'
      AND created_at <= ? || ' 23:59:59'
    ORDER BY created_at ASC
  `).bind(start, end).all<OrderExportRow>();

  return results || [];
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
    'Created At',
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
      row.created_at || '',
    ];
    lines.push(fields.map(escapeCsvField).join(','));
  }

  return lines.join('\n');
}

/**
 * Escape a CSV field: wrap in quotes if it contains comma, newline, or double-quote.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('\n') || value.includes('"') || value.includes(';')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
