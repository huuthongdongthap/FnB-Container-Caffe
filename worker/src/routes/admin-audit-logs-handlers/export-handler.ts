import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { AuditLogger } from '../../lib/audit-logger';
import { createLogger } from '../../middleware/logger';
import { CSV_HEADERS } from './types';
import { escapeCsv } from './csv-helper';

const log = createLogger({ route: 'admin-audit-logs:export' });

export function registerExportHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/admin/audit-logs/export — export audit logs as CSV with filters
  router.get('/export', async (c) => {
    try {
      const auditLogger = new AuditLogger(c.executionCtx, c.env.AURA_DB);
      const actorId = c.req.query('actor_id');
      const action = c.req.query('action');
      const resourceType = c.req.query('resource_type');
      const dateFrom = c.req.query('date_from');
      const dateTo = c.req.query('date_to');

      // Validate date format if provided
      if (dateFrom && isNaN(Date.parse(dateFrom))) {
        return c.json({
          error: 'Tham số date_from không hợp lệ. Định dạng ISO 8601 / Invalid date_from parameter. Use ISO 8601 format'
        }, 400);
      }

      if (dateTo && isNaN(Date.parse(dateTo))) {
        return c.json({
          error: 'Tham số date_to không hợp lệ. Định dạng ISO 8601 / Invalid date_to parameter. Use ISO 8601 format'
        }, 400);
      }

      // Fetch all logs (large pageSize) for CSV export
      const result = await auditLogger.query({
        actorId: actorId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: 1,
        pageSize: 10000
      });

      const csvRows: string[] = [CSV_HEADERS.join(',')];

      for (const row of result.rows) {
        csvRows.push([
          escapeCsv(row.actor_id),
          escapeCsv(row.actor_name),
          escapeCsv(row.action),
          escapeCsv(row.resource_type),
          escapeCsv(row.resource_id ?? ''),
          escapeCsv(row.details ?? ''),
          escapeCsv(row.ip_address ?? ''),
          escapeCsv(row.created_at)
        ].join(','));
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="audit-log-${dateStr}.csv"`);
      return c.body(`﻿${csvRows.join('\n')}`); // BOM for Excel UTF-8 display
    } catch (err) {
      log.error('Audit log export failed', { error: String(err) });
      return c.json({
        error: 'Lỗi máy chủ khi xuất audit logs / Server error while exporting audit logs'
      }, 500);
    }
  });
}