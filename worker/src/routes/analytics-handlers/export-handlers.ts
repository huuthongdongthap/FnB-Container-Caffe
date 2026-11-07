import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { authenticateRequest } from '../../middleware/auth';
import { getOrdersInRange, formatCsvRows } from '../../tree/analytics/csv-export';
import { resolveAnalyticsTenant } from '../../tree/analytics/summary';
import { exportSchema } from './helpers';

const EXPORT_ALLOWED_ROLES = new Set(['owner', 'manager', 'admin']);
const MAX_EXPORT_RANGE_DAYS = 366;

export function registerExportHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/analytics/export?start=YYYY-MM-DD&end=YYYY-MM-DD
  router.get('/export', async (c) => {
    let user = (c as unknown as { get?: (k: string) => { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined }).get?.('user');
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

    const { start, end } = parsed.data;
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

    const rows = await getOrdersInRange(c.env.AURA_DB, start, end, tenantId);
    const csv = formatCsvRows(rows);

    return c.newResponse(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-export-${start}-to-${end}.csv"`,
    });
  });
}
