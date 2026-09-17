import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getOrdersInRange, formatCsvRows } from '../../tree/analytics/csv-export';
import { exportSchema } from './helpers';

export function registerExportHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/analytics/export?start=YYYY-MM-DD&end=YYYY-MM-DD
  router.get('/export', async (c) => {
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
    const rows = await getOrdersInRange(c.env.AURA_DB, start, end);
    const csv = formatCsvRows(rows);

    return c.newResponse(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-export-${start}-to-${end}.csv"`,
    });
  });
}
