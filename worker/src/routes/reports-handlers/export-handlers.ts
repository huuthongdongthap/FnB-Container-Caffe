import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { buildTenantClause, isStrictHQReportAdmin } from './analytics-handlers';
import type {
  OrderExportRow,
  RevenueExportRow,
  CustomerExportRow
} from './types';

// Helper: escape CSV cell per RFC 4180 and neutralize spreadsheet formula prefixes
function escapeCsvCell(val: unknown): string {
  const rawStr = String(val ?? '');
  const sanitizedMultiline =
    typeof val === 'string'
      ? rawStr.replace(/([\r\n]+)(\s*[=+\-@|])/g, "$1'$2")
      : rawStr;
  const str =
    typeof val === 'string' &&
    (/^[\t\r\n ]*[=+\-@]/.test(sanitizedMultiline) || /^[\t\r\n ]*\|/.test(sanitizedMultiline))
      ? `'${sanitizedMultiline}`
      : sanitizedMultiline;
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
  const EXPORT_ALLOWED_ROLES = new Set(['owner', 'manager', 'admin']);
  const VALID_EXPORT_ORDER_SQL =
    "LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired') AND LOWER(COALESCE(payment_status, '')) NOT IN ('refunded', 'failed')";
  const VALID_JOINED_ORDER_SQL =
    "LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired') AND LOWER(COALESCE(o.payment_status, '')) NOT IN ('refunded', 'failed')";
  const VALID_CUSTOMER_EXPORT_PHONE_SQL =
    "TRIM(COALESCE(c.phone, '')) NOT IN ('', '0', '000000000', '0000000000', '00000000000', 'guest', 'walk-in', 'pos')";

  // GET /api/reports/export — CSV export for orders, revenue, or customers
  app.get('/export', async (c) => {
    let user = (c as unknown as { get: (k: string) => { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined }).get('user');
    if (!user && c.req?.raw && c.env?.JWT_SECRET && (c.req.header('Authorization') || c.req.header('authorization'))) {
      const session = await authenticateRequest(c.req.raw, c.env, { optional: true }).catch(() => null);
      if (session && 'payload' in session) {
        user = {
          id: session.payload.id,
          role: session.payload.role,
          tenantId: session.payload.tenantId,
        };
        (c as unknown as { set?: (k: string, v: unknown) => void }).set?.('user', user);
      }
    }
    const role = user?.role ? String(user.role).toLowerCase() : '';
    if (!user || !role) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    if (!EXPORT_ALLOWED_ROLES.has(role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }

    const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
    const hqAdmin = isStrictHQReportAdmin(role, userTenant);
    const boundTenant = userTenant || 'default';
    const reqCandidates = [
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
    if (new Set(reqCandidates).size > 1) {
      return c.json({ success: false, error: 'Cross-tenant export access denied' }, 403);
    }
    const reqTenant = reqCandidates[0] || '';
    const ctxTenant =
      ((c as unknown as { get: (k: string) => string | undefined }).get('tenantId') || '').trim();
    const resolvedTenant = getTenantId(c).trim() || 'default';

    if (!hqAdmin) {
      if (
        boundTenant === '*' ||
        boundTenant.toLowerCase() === 'hq' ||
        reqTenant === '*' ||
        reqTenant.toLowerCase() === 'hq' ||
        (reqTenant && reqTenant !== boundTenant) ||
        (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) ||
        resolvedTenant !== boundTenant
      ) {
        return c.json({ success: false, error: 'Cross-tenant export access denied' }, 403);
      }
    }
    const rawTarget = reqTenant || ctxTenant || resolvedTenant || '*';
    const tenantId = hqAdmin ? (rawTarget.toLowerCase() === 'hq' ? '*' : rawTarget) : boundTenant;

    const db = c.env.AURA_DB;
    const { and: tenantClause, binds: tenantBinds } = buildTenantClause(tenantId);
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date range' }, 400);
    }
    const startMs = Date.parse(`${from}T00:00:00.000Z`);
    const endMs = Date.parse(`${to}T00:00:00.000Z`);
    const daySpan = Math.floor((endMs - startMs) / 86400000);
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      new Date(startMs).toISOString().slice(0, 10) !== from ||
      new Date(endMs).toISOString().slice(0, 10) !== to ||
      !(daySpan >= 0 && daySpan <= 366)
    ) {
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
         WHERE DATE(created_at) BETWEEN ? AND ? AND ${VALID_EXPORT_ORDER_SQL}${tenantClause}
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
      const { where: custWhere, binds: custBinds } = buildTenantClause(tenantId, 'c');
      const orderTenantJoin =
        " AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')";
      const dateFilter = custWhere
        ? ' AND (c.created_at IS NULL OR DATE(c.created_at) BETWEEN ? AND ?)'
        : ' WHERE (c.created_at IS NULL OR DATE(c.created_at) BETWEEN ? AND ?)';
      const datedBinds = [...custBinds, from, to];
      let results: CustomerExportRow[] = [];
      try {
        const res = await db.prepare(
          `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier, c.created_at,
                  COALESCE(SUM(o.total), 0) as total_spent,
                  COUNT(o.id) as order_count
           FROM customers c
           LEFT JOIN orders o ON (o.customer_id = c.id OR (o.customer_id IS NULL AND ${VALID_CUSTOMER_EXPORT_PHONE_SQL} AND o.customer_phone = c.phone)) AND ${VALID_JOINED_ORDER_SQL}${orderTenantJoin}${custWhere}${dateFilter}
           GROUP BY c.id ORDER BY c.created_at LIMIT 5000`
        ).bind(...datedBinds).all<CustomerExportRow>();
        results = res.results || [];
      } catch {
        const stmt = db.prepare(
          `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier, c.created_at,
                  COALESCE(SUM(o.total), 0) as total_spent,
                  COUNT(o.id) as order_count
           FROM customers c
           LEFT JOIN orders o ON (o.customer_id = c.id OR (o.customer_id IS NULL AND ${VALID_CUSTOMER_EXPORT_PHONE_SQL} AND o.customer_phone = c.phone)) AND ${VALID_JOINED_ORDER_SQL}${orderTenantJoin}${custWhere}
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
