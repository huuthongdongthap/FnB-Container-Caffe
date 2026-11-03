import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { AuditLogger } from '../../lib/audit-logger';
import { createLogger } from '../../middleware/logger';
import { getTenantId } from '../../middleware/tenant';
import { CSV_HEADERS } from './types';
import { escapeCsv } from './csv-helper';
import { filterAuditRowsByTenant } from './query-handler';

const log = createLogger({ route: 'admin-audit-logs:export' });

const AUDIT_EXPORT_ALLOWED_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

export function registerExportHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/admin/audit-logs/export — export audit logs as CSV with filters
  router.get('/export', async (c) => {
    const user = c.get('user' as never) as { role?: string } | undefined;
    if (user?.role && !AUDIT_EXPORT_ALLOWED_ROLES.includes(String(user.role).toLowerCase())) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    try {
      let execCtx: any;
      try { execCtx = c.executionCtx; } catch { execCtx = undefined; }
      const auditLogger = new AuditLogger(execCtx, c.env.AURA_DB);
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

      const tenantId = getTenantId(c as any);
      const exportRows = tenantId === '*'
        ? result.rows
        : await filterAuditRowsByTenant(c.env.AURA_DB, result.rows as any[], tenantId);

      const csvRows: string[] = [CSV_HEADERS.join(',')];

      for (const row of exportRows) {
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
