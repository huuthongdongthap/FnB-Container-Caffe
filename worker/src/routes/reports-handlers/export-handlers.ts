import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { authenticateRequest } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import {
  VALID_REVENUE_ORDER_ALIAS_SQL,
  VALID_REVENUE_ORDER_SQL,
  buildTenantClause,
  isStrictHQReportAdmin,
  validateDateRangeWindow,
} from './analytics-handlers';
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

const ICT_OFFSET_MS = 7 * 3600_000;

export const VALID_EXPORT_ORDER_SQL = VALID_REVENUE_ORDER_SQL;

export function registerExportHandlers(app: Hono<{ Bindings: Env }>) {
  const EXPORT_ALLOWED_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);
  const VALID_JOINED_ORDER_SQL = VALID_REVENUE_ORDER_ALIAS_SQL;
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
    const from = c.req.query('from') || new Date(Date.now() + ICT_OFFSET_MS - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date(Date.now() + ICT_OFFSET_MS).toISOString().slice(0, 10);
    const rangeErr = validateDateRangeWindow(from, to);
    const daySpan = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
    if (rangeErr || !Number.isFinite(daySpan) || daySpan < 0 || !(daySpan <= 366)) {
      return c.json({ success: false, error: 'Invalid date range' }, 400);
    }
    const type = c.req.query('type') || 'orders';
    if (role === 'supervisor' && type === 'customers') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const maskPii = role === 'supervisor' || c.req.query('mask_pii') === '1' || c.req.query('mask_pii') === 'true';
    const maskPhone = (val: string | null | undefined) => {
      if (!maskPii) return val || '';
      const s = String(val || '').trim();
      return s.length >= 6 ? `${s.slice(0, 3)}****${s.slice(-3)}` : s ? '***' : '';
    };
    const maskEmail = (val: string | null | undefined) => {
      if (!maskPii) return val || '';
      const s = String(val || '').trim();
      const at = s.indexOf('@');
      return at > 1 ? `${s[0]}***${s.slice(at)}` : s ? '***' : '';
    };
    const recordExportAudit = async (rowCount: number) => {
      try {
        const actorId = String(user?.id || 'unknown');
        await db
          ?.prepare(
            `INSERT INTO audit_logs (actor, actor_id, action, resource_type, resource_id, details, tenant_id, status, created_at)
             VALUES (?, ?, 'export_csv', ?, ?, ?, ?, 'success', datetime('now'))`
          )
          .bind(
            actorId,
            actorId,
            type,
            `${from}..${to}`,
            JSON.stringify({ route: 'reports.export', actor_role: role, type, from, to, row_count: rowCount, mask_pii: maskPii }),
            tenantId || 'default'
          )
          .run();
      } catch {
        // Best-effort audit persistence for minimal test mocks
      }
    };

    if (type === 'orders') {
      const { and: oTenantClause, binds: oTenantBinds } = buildTenantClause(tenantId, 'o');
      const { and: pTenantClause, binds: pTenantBinds } = buildTenantClause(tenantId);
      let results: OrderExportRow[] = [];
      try {
        const res = await db.prepare(
          `SELECT o.id, o.customer_name, o.customer_phone,
                  COALESCE(o.shipping_fee, 0) as shipping_fee,
                  COALESCE(o.service_fee, 0) as service_fee,
                  COALESCE(o.tip_amount, 0) as tip_amount,
                  o.total,
                  COALESCE(p.refund_amount, 0) as refund_amount,
                  o.status, o.payment_method,
                  DATE(datetime(o.created_at, '+7 hours')) as ict_date, o.created_at
           FROM orders o
           LEFT JOIN (
             SELECT order_id, SUM(COALESCE(refund_amount, 0)) as refund_amount
             FROM payments
             WHERE 1=1${pTenantClause}
             GROUP BY order_id
           ) p ON p.order_id = o.id
           WHERE DATE(datetime(o.created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_JOINED_ORDER_SQL}${oTenantClause} ORDER BY o.created_at LIMIT 5000`
        ).bind(...pTenantBinds, from, to, ...oTenantBinds).all<OrderExportRow & { ict_date?: string }>();
        results = res.results || [];
      } catch {
        const res = await db.prepare(
          `SELECT id, customer_name, customer_phone, total, status, payment_method, created_at
           FROM orders WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_EXPORT_ORDER_SQL}${tenantClause} ORDER BY created_at LIMIT 5000`
        ).bind(from, to, ...tenantBinds).all<OrderExportRow>();
        results = res.results || [];
      }

      const headers = [
        'id',
        'customer_name',
        'customer_phone',
        'shipping_fee',
        'service_fee',
        'tip',
        'total',
        'refund_amount',
        'status',
        'payment_method',
        'created_at',
      ];
      const rows = (results || []).map((r) => [
        r.id || '',
        maskPii && r.customer_name ? `${r.customer_name.slice(0, 1)}***` : (r.customer_name || ''),
        maskPhone(r.customer_phone),
        r.shipping_fee ?? 0,
        r.service_fee ?? 0,
        r.tip_amount ?? 0,
        r.total ?? 0,
        r.refund_amount ?? 0,
        r.status || '',
        r.payment_method || '',
        (r as OrderExportRow & { ict_date?: string }).ict_date || (r.created_at || '').slice(0, 10)
      ]);
      await recordExportAudit(rows.length);

      return createCsvResponse(
        `${headers.join(',')}\n${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`,
        `orders-report-${from}-${to}.csv`
      );
    }

    if (type === 'revenue' || type === 'sales') {
      let results: RevenueExportRow[] = [];
      try {
        const res = await db.prepare(
          `SELECT DATE(datetime(created_at, '+7 hours')) as date,
                  COUNT(*) as orders,
                  COALESCE(SUM(total), 0) as revenue,
                  CASE WHEN COUNT(*) > 0 THEN ROUND(CAST(COALESCE(SUM(total), 0) AS REAL) / COUNT(*)) ELSE 0 END as avg_order_value
           FROM orders
           WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_EXPORT_ORDER_SQL}${tenantClause}
           GROUP BY DATE(datetime(created_at, '+7 hours')) ORDER BY date LIMIT 5000`
        ).bind(from, to, ...tenantBinds).all<RevenueExportRow>();
        results = res.results || [];
      } catch {
        const res = await db.prepare(
          `SELECT DATE(created_at) as date,
                  COUNT(*) as orders,
                  COALESCE(SUM(total), 0) as revenue,
                  CASE WHEN COUNT(*) > 0 THEN ROUND(CAST(COALESCE(SUM(total), 0) AS REAL) / COUNT(*)) ELSE 0 END as avg_order_value
           FROM orders
           WHERE DATE(created_at) BETWEEN ? AND ? AND ${VALID_EXPORT_ORDER_SQL}${tenantClause}
           GROUP BY DATE(created_at) ORDER BY date LIMIT 5000`
        ).bind(from, to, ...tenantBinds).all<RevenueExportRow>();
        results = res.results || [];
      }

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
          `SELECT DATE(datetime(t.created_at, '+7 hours')) as date, COALESCE(SUM(t.reward_amount), 0) as amount
           FROM checkins t${custJoin}
           WHERE DATE(datetime(t.created_at, '+7 hours')) BETWEEN ? AND ? AND t.status = 'approved'${custClause}
           GROUP BY DATE(datetime(t.created_at, '+7 hours'))`
        ).bind(from, to, ...tenantBinds).all<{ date: string; amount: number }>();
        cashbackResults = res.results || [];
      } catch {
        try {
          const res = await db.prepare(
            `SELECT DATE(datetime(t.created_at, '+7 hours')) as date, COALESCE(SUM(t.amount), 0) as amount
             FROM cashback_transactions t${custJoin}
             WHERE DATE(datetime(t.created_at, '+7 hours')) BETWEEN ? AND ? AND t.type = 'earn'${custClause}
             GROUP BY DATE(datetime(t.created_at, '+7 hours'))`
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
      await recordExportAudit(rows.length);

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
        ? " AND (c.created_at IS NULL OR DATE(datetime(c.created_at, '+7 hours')) BETWEEN ? AND ?)"
        : " WHERE (c.created_at IS NULL OR DATE(datetime(c.created_at, '+7 hours')) BETWEEN ? AND ?)";
      const datedBinds = [...custBinds, from, to];
      let results: CustomerExportRow[] = [];
      try {
        const res = await db.prepare(
          `SELECT c.id, c.name, c.email, c.phone, c.loyalty_tier, c.created_at,
                  DATE(datetime(c.created_at, '+7 hours')) as ict_date,
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
                  DATE(datetime(c.created_at, '+7 hours')) as ict_date,
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
        maskPii && r.name ? `${r.name.slice(0, 1)}***` : (r.name || ''),
        maskEmail(r.email),
        maskPhone(r.phone),
        r.total_spent ?? 0,
        r.order_count ?? 0,
        r.loyalty_tier || '',
        (r as CustomerExportRow & { ict_date?: string }).ict_date || (r.created_at || '').slice(0, 10)
      ]);
      await recordExportAudit(rows.length);

      return createCsvResponse(
        `${headers.join(',')}\n${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`,
        `customers-report-${from}-${to}.csv`
      );
    }

    return c.json({ success: false, error: `Invalid export type: ${type}. Use orders, revenue, or customers.` }, 400);
  });
}
