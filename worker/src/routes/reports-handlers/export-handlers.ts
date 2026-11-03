import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import { buildTenantClause } from './analytics-handlers';
import type {
  OrderExportRow,
  RevenueExportRow,
  CustomerExportRow
} from './types';

// Helper: escape CSV cell per RFC 4180 and neutralize spreadsheet formula prefixes
function escapeCsvCell(val: unknown): string {
  const rawStr = String(val ?? '');
  const str = typeof val === 'string' && /^[\t\r\n ]*[=+\-@]/.test(rawStr) ? `'${rawStr}` : rawStr;
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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
  const EXPORT_ALLOWED_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);

  // GET /api/reports/export — CSV export for orders, revenue, or customers
  app.get('/export', async (c) => {
    const user = (c as unknown as { get: (k: string) => { role?: string } | undefined }).get('user');
    const role = user?.role ? String(user.role).toLowerCase() : '';
    if (role && !EXPORT_ALLOWED_ROLES.has(role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    if (!role && (c.req.header('Authorization') || c.env?.ENVIRONMENT === 'production')) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const { and: tenantClause, binds: tenantBinds } = buildTenantClause(tenantId);
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date range' }, 400);
    }
    const startMs = Date.parse(`${from}T00:00:00.000Z`);
    const endMs = Date.parse(`${to}T00:00:00.000Z`);
    const daySpan = Math.floor((endMs - startMs) / 86400000);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !(daySpan >= 0 && daySpan <= 366)) {
      return c.json({ success: false, error: 'Invalid date range' }, 400);
    }
    const type = c.req.query('type') || 'orders';

    if (type === 'orders') {
      const { results } = await db.prepare(
        `SELECT id, customer_name, customer_phone, total, status, payment_method, created_at
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ?${tenantClause} ORDER BY created_at LIMIT 5000`
      ).bind(from, to, ...tenantBinds).all<OrderExportRow>();

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
        `${headers.join(',')}\n${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`,
        `orders-report-${from}-${to}.csv`
      );
    }

    if (type === 'revenue' || type === 'sales') {
      const { results } = await db.prepare(
        `SELECT DATE(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total), 0) as revenue,
                CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total), 0) / COUNT(*) ELSE 0 END as avg_order_value
         FROM orders
         WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'${tenantClause}
         GROUP BY DATE(created_at) ORDER BY date LIMIT 5000`
      ).bind(from, to, ...tenantBinds).all<RevenueExportRow>();

      // Get cashback earned per day separately
      const custJoin = tenantId === '*'
        ? ''
        : tenantId === 'default'
          ? ' LEFT JOIN customers c ON c.id = t.customer_id'
          : ' JOIN customers c ON c.id = t.customer_id';
      const { and: custClause } = buildTenantClause(tenantId, 'c');
      let cashbackResults: { date: string; amount: number }[] = [];
      try {
        const res = await db.prepare(
          `SELECT DATE(t.created_at) as date, COALESCE(SUM(t.reward_amount), 0) as amount
           FROM checkins t${custJoin}
           WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.status = 'approved'${custClause}
           GROUP BY DATE(t.created_at)`
        ).bind(from, to, ...tenantBinds).all<{ date: string; amount: number }>();
        cashbackResults = res.results || [];
      } catch {
        try {
          const res = await db.prepare(
            `SELECT DATE(t.created_at) as date, COALESCE(SUM(t.amount), 0) as amount
             FROM cashback_transactions t${custJoin}
             WHERE DATE(t.created_at) BETWEEN ? AND ? AND t.type = 'earn'${custClause}
             GROUP BY DATE(t.created_at)`
          ).bind(from, to, ...tenantBinds).all<{ date: string; amount: number }>();
          cashbackResults = res.results || [];
        } catch {
          cashbackResults = [];
        }
      }

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
        `${headers.join(',')}\n${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`,
        `revenue-report-${from}-${to}.csv`
      );
    }

    if (type === 'customers') {
      const { where: custWhere } = buildTenantClause(tenantId, 'c');
      const { and: orderTenantJoin } = buildTenantClause(tenantId, 'o');
      const dateFilter = custWhere
        ? ' AND (c.created_at IS NULL OR DATE(c.created_at) BETWEEN ? AND ?)'
        : ' WHERE (c.created_at IS NULL OR DATE(c.created_at) BETWEEN ? AND ?)';
      const datedBinds = tenantId === '*' ? [from, to] : [tenantId, tenantId, from, to];
      let results: CustomerExportRow[] = [];
      try {
        const res = await db.prepare(
          `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier, c.created_at,
                  COALESCE(SUM(o.total), 0) as total_spent,
                  COUNT(o.id) as order_count
           FROM customers c
           LEFT JOIN orders o ON (o.customer_id = c.id OR (o.customer_id IS NULL AND o.customer_phone = c.phone)) AND o.status != 'cancelled'${orderTenantJoin}${custWhere}${dateFilter}
           GROUP BY c.id ORDER BY c.created_at LIMIT 5000`
        ).bind(...datedBinds).all<CustomerExportRow>();
        results = res.results || [];
      } catch {
        const custBinds = tenantId === '*' ? [] : [tenantId, tenantId];
        const stmt = db.prepare(
          `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier, c.created_at,
                  COALESCE(SUM(o.total), 0) as total_spent,
                  COUNT(o.id) as order_count
           FROM customers c
           LEFT JOIN orders o ON (o.customer_id = c.id OR (o.customer_id IS NULL AND o.customer_phone = c.phone)) AND o.status != 'cancelled'${orderTenantJoin}${custWhere}
           GROUP BY c.id ORDER BY c.created_at LIMIT 5000`
        );
        const res = custBinds.length > 0
          ? await stmt.bind(...custBinds).all<CustomerExportRow>()
          : await stmt.all<CustomerExportRow>();
        results = res.results || [];
      }

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
        `${headers.join(',')}\n${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`,
        `customers-report-${from}-${to}.csv`
      );
    }

    return c.json({ success: false, error: `Invalid export type: ${type}. Use orders, revenue, or customers.` }, 400);
  });
}
