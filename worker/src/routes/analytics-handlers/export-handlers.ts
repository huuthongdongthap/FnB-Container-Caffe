import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getAuthToken } from '../../lib/jwt';
import { authenticateRequest } from '../../middleware/auth';
import {
  getOrdersInRange,
  formatCsvRows,
  maskPhoneForCsv,
  getDailyRevenueInRange,
  formatDailyRevenueCsvRows,
} from '../../tree/analytics/csv-export';
import { resolveAnalyticsTenant } from '../../tree/analytics/summary';
import { exportSchema } from './helpers';

const EXPORT_ALLOWED_ROLES = new Set(['owner', 'manager', 'admin']);
const MAX_EXPORT_RANGE_DAYS = 366;

export function registerExportHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/analytics/export?start=YYYY-MM-DD&end=YYYY-MM-DD
  router.get('/export', async (c) => {
    let user = (c as unknown as { get?: (k: string) => { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined }).get?.('user');
    if (!user && c.req?.raw && c.env?.JWT_SECRET && getAuthToken(c.req.raw)) {
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
    if (!role) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    if (!EXPORT_ALLOWED_ROLES.has(role)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }

    const { tenantId, forbidden } = resolveAnalyticsTenant(c);
    if (forbidden) {
      return c.json({ success: false, error: 'Cross-tenant export access denied' }, 403);
    }

    const parsed = exportSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid query parameters',
        },
        400
      );
    }

    const { start, end, type } = parsed.data;
    const startMs = Date.parse(`${start}T00:00:00.000Z`);
    const endMs = Date.parse(`${end}T00:00:00.000Z`);
    const startIso = Number.isFinite(startMs) ? new Date(startMs).toISOString().slice(0, 10) : '';
    const endIso = Number.isFinite(endMs) ? new Date(endMs).toISOString().slice(0, 10) : '';
    if (startIso !== start || endIso !== end || startMs > endMs) {
      return c.json({ success: false, error: 'Invalid date range' }, 400);
    }
    const daySpan = Math.floor((endMs - startMs) / 86_400_000) + 1;
    if (daySpan > MAX_EXPORT_RANGE_DAYS) {
      return c.json({ success: false, error: 'Date range cannot exceed 366 days' }, 400);
    }

    const exportType = type === 'revenue' ? 'revenue' : 'orders';
    const maskPii = c.req.query('mask_pii') === '1' || c.req.query('mask_pii') === 'true';
    const effectiveTenantId = tenantId || 'default';
    const recordExportAudit = async (rowCount: number) => {
      const actorId = String(user?.id || 'unknown');
      const auditDetails = JSON.stringify({
        route: 'analytics.export',
        actor_role: role,
        type: exportType,
        start,
        end,
        row_count: rowCount,
        mask_pii: maskPii,
        tenant_id: effectiveTenantId,
      });
      try {
        await c.env.AURA_DB?.prepare(
          `INSERT INTO audit_logs (actor, actor_id, action, resource_type, resource_id, details, tenant_id, status, created_at)
           VALUES (?, ?, 'export_csv', ?, ?, ?, ?, 'success', datetime('now'))`
        )
          .bind(actorId, actorId, exportType, `${start}..${end}`, auditDetails, effectiveTenantId)
          .run()
          .catch(() =>
            c.env.AURA_DB?.prepare(
              `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, details, tenant_id, created_at)
               VALUES (?, 'export_csv', ?, ?, ?, ?, datetime('now'))`
            )
              .bind(actorId, exportType, `${start}..${end}`, auditDetails, effectiveTenantId)
              .run()
          );
      } catch {
        // Best-effort audit persistence for minimal test mocks
      }
    };

    if (type === 'revenue') {
      const revenueRows = await getDailyRevenueInRange(c.env.AURA_DB, start, end, tenantId);
      const revenueCsv = formatDailyRevenueCsvRows(revenueRows);
      await recordExportAudit(revenueRows.length);
      return c.newResponse(revenueCsv, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="revenue-export-${start}-to-${end}.csv"`,
      });
    }

    const rawRows = await getOrdersInRange(c.env.AURA_DB, start, end, tenantId, { alignIct: true, maskPii });
    const rows = maskPii
      ? rawRows.map((row) => ({
          ...row,
          customer_name: row.customer_name ? `${row.customer_name.slice(0, 1)}***` : '',
          customer_phone: maskPhoneForCsv(row.customer_phone),
        }))
      : rawRows;
    const csv = formatCsvRows(rows);
    await recordExportAudit(rows.length);

    return c.newResponse(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-export-${start}-to-${end}.csv"`,
    });
  });
}
