import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import type {
  OrderExportRow,
  RevenueExportRow,
  CustomerExportRow
} from './types';

// Helper: create CSV response with UTF-8 BOM bytes for Excel compatibility
function createCsvResponse(csvString: string, filename: string): Response {
  const encoder = new TextEncoder();
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
  const encoded = encoder.encode(csvString);
  const body = new Uint8Array(bom.length + encoded.length);
  body.set(bom);
  body.set(encoded, bom.length);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

export function registerExportHandlers(app: Hono<{ Bindings: Env }>) {
  // GET /api/reports/export — CSV export for orders, revenue, or customers
  app.get('/export', async (c) => {
    const db = c.env.AURA_DB;
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    const type = c.req.query('type') || 'orders';

    if (type === 'orders') {
      const { results } = await db.prepare(
        `SELECT id, customer_name, customer_phone, total, status, payment_method, created_at
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ? ORDER BY created_at`
      ).bind(from, to).all<OrderExportRow>();

      const headers = ['id', 'customer_name', 'customer_phone', 'total', 'status', 'payment_method', 'created_at'];
      const rows = (results || []).map((r) => [
        r.id || '',
        r.customer_name || '',
        r.customer_phone || '',
        r.total ?? 0,
        r.status || '',
        r.payment_method || '',
        (r.created_at || '').slice(0, 10)
      ]);

      return createCsvResponse(
        `${headers.join(',')}\n${rows.map(r => r.join(',')).join('\n')}`,
        `orders-report-${from}-${to}.csv`
      );
    }

    if (type === 'revenue') {
      const { results } = await db.prepare(
        `SELECT DATE(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total), 0) as revenue,
                CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total), 0) / COUNT(*) ELSE 0 END as avg_order_value
         FROM orders
         WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
         GROUP BY DATE(created_at) ORDER BY date`
      ).bind(from, to).all<RevenueExportRow>();

      // Get cashback earned per day separately
      const { results: cashbackResults } = await db.prepare(
        `SELECT DATE(created_at) as date, COALESCE(SUM(reward_amount), 0) as amount
         FROM checkins WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'approved'
         GROUP BY DATE(created_at)`
      ).bind(from, to).all<{ date: string; amount: number }>();

      const cashbackMap = new Map((cashbackResults || []).map(c => [c.date, c.amount]));

      const headers = ['date', 'orders', 'revenue', 'avg_order_value', 'cashback_earned'];
      const rows = (results || []).map((r) => [
        r.date || '',
        r.orders ?? 0,
        r.revenue ?? 0,
        r.avg_order_value ?? 0,
        cashbackMap.get(r.date) || 0
      ]);

      return createCsvResponse(
        `${headers.join(',')}\n${rows.map(r => r.join(',')).join('\n')}`,
        `revenue-report-${from}-${to}.csv`
      );
    }

    if (type === 'customers') {
      const { results } = await db.prepare(
        `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier, c.created_at,
                COALESCE(SUM(o.total), 0) as total_spent,
                COUNT(o.id) as order_count
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelled'
         GROUP BY c.id ORDER BY c.created_at`
      ).all<CustomerExportRow>();

      const headers = ['id', 'name', 'email', 'phone', 'total_spent', 'order_count', 'loyalty_tier', 'created_at'];
      const rows = (results || []).map((r) => [
        r.id || '',
        r.name || '',
        r.email || '',
        r.phone || '',
        r.total_spent ?? 0,
        r.order_count ?? 0,
        r.loyalty_tier || '',
        (r.created_at || '').slice(0, 10)
      ]);

      return createCsvResponse(
        `${headers.join(',')}\n${rows.map(r => r.join(',')).join('\n')}`,
        `customers-report-${from}-${to}.csv`
      );
    }

    return c.json({ success: false, error: `Invalid export type: ${type}. Use orders, revenue, or customers.` }, 400);
  });
}
