import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { AuditLogger } from '../../lib/audit-logger';
import { createLogger } from '../../middleware/logger';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { CSV_HEADERS } from './types';
import { escapeCsv } from './csv-helper';
import { filterAuditRowsByTenant } from './query-handler';

const log = createLogger({ route: 'admin-audit-logs:export' });

const AUDIT_EXPORT_ALLOWED_ROLES = ['owner', 'manager', 'admin'];

const EXPORT_ACTION_VERB_MAP: Record<string, string[]> = {
  CREATE: ['%.post', '%create%'],
  UPDATE: ['%.put', '%.patch', '%update%'],
  DELETE: ['%.delete', '%delete%'],
  LOGIN: ['%login%', '%auth%'],
  LOGOUT: ['%logout%'],
  EXPORT: ['%export%'],
};

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function registerExportHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/admin/audit-logs/export — export audit logs as CSV with filters
  router.get('/export', async (c) => {
    const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
    if (!user?.role) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    const roleLower = String(user.role).toLowerCase();
    const hasAuthCredential = Boolean(
      c.req.header('Authorization') ||
      c.req.header('authorization') ||
      c.req.header('Cookie') ||
      c.req.header('cookie')
    );
    const isAuthenticatedSupervisor = roleLower === 'supervisor' && hasAuthCredential;
    if (!AUDIT_EXPORT_ALLOWED_ROLES.includes(roleLower) && !isAuthenticatedSupervisor) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const rawTenantId = getTenantId(c as any);
    const rawUserTenant = typeof (user.tenantId ?? user.tenant_id) === 'string' ? (user.tenantId ?? user.tenant_id)!.trim() : '';
    const userTenant = rawUserTenant && rawUserTenant !== '*' && rawUserTenant.toLowerCase() !== 'hq' ? rawUserTenant : 'default';
    const requestedTenant = (
      c.req.query('tenant_id') ||
      c.req.query('tenantId') ||
      c.req.query('store_id') ||
      c.req.query('storeId') ||
      c.req.header('x-tenant-id') ||
      c.req.header('X-Tenant-ID') ||
      c.req.header('x-store-id') ||
      c.req.header('X-Store-ID') ||
      ''
    ).trim();
    const isHq = isHQSuperAdmin(user as any);
    if (!isHq) {
      if (
        rawUserTenant === '*' ||
        rawUserTenant.toLowerCase() === 'hq' ||
        rawTenantId === '*' ||
        rawTenantId.toLowerCase() === 'hq' ||
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        userTenant !== rawTenantId ||
        (requestedTenant && requestedTenant !== userTenant)
      ) {
        return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
      }
    }
    const hqTarget = requestedTenant || rawTenantId || '*';
    const tenantId = isHq ? (hqTarget.toLowerCase() === 'hq' ? '*' : hqTarget) : userTenant;
    try {
      let execCtx: any;
      try { execCtx = c.executionCtx; } catch { execCtx = undefined; }
      const auditLogger = new AuditLogger(execCtx, c.env.AURA_DB);
      const actorId = c.req.query('actor_id');
      const action = c.req.query('action');
      const resourceType = c.req.query('resource_type');
      const dateFrom = c.req.query('date_from') ?? c.req.query('dateFrom');
      const dateTo = c.req.query('date_to') ?? c.req.query('dateTo');

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

      const normalizedDateTo = dateTo
        ? (/^\d{4}-\d{2}-\d{2}$/.test(dateTo.trim()) ? `${dateTo.trim()}T23:59:59.999Z` : dateTo.trim())
        : undefined;

      // Fetch all logs (large pageSize) for CSV export
      let result = await auditLogger.query({
        actorId: actorId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: normalizedDateTo,
        page: 1,
        pageSize: 10000,
        maxPageSize: 10000,
        tenantId,
      });

      // Fallback for case-insensitive / CRUD verb action filters (e.g. CREATE -> %.post)
      if (action && result.rows.length === 0 && c.env.AURA_DB) {
        try {
          const conditions: string[] = [];
          const params: unknown[] = [];
          if (actorId) {
            conditions.push('actor_id = ?');
            params.push(actorId);
          }
          if (resourceType) {
            conditions.push('resource_type = ?');
            params.push(resourceType);
          }
          if (dateFrom) {
            conditions.push('created_at >= ?');
            params.push(dateFrom);
          }
          if (normalizedDateTo) {
            conditions.push('created_at <= ?');
            params.push(normalizedDateTo);
          }

          const upper = action.trim().toUpperCase();
          const patterns = EXPORT_ACTION_VERB_MAP[upper] ?? [`%${escapeLikePattern(action.trim().toLowerCase())}%`];
          const actionOrClauses = ['LOWER(action) = LOWER(?)', ...patterns.map(() => "LOWER(action) LIKE ? ESCAPE '\\'")];
          conditions.push(`(${actionOrClauses.join(' OR ')})`);
          params.push(action.trim(), ...patterns);

          const baseConditions = [...conditions];
          const baseParams = [...params];
          if (tenantId !== '*') {
            conditions.push("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
            params.push(tenantId);
          }

          let fallbackRes: { results?: Record<string, unknown>[] };
          try {
            const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            fallbackRes = await c.env.AURA_DB.prepare(
              `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT 10000`
            ).bind(...params).all<Record<string, unknown>>();
          } catch {
            // Legacy schema fallback when audit_logs omits tenant_id column — only permitted for default/HQ scope
            if (tenantId === 'default' || tenantId === '*') {
              const legacyWhereSql = baseConditions.length > 0 ? `WHERE ${baseConditions.join(' AND ')}` : '';
              fallbackRes = await c.env.AURA_DB.prepare(
                `SELECT * FROM audit_logs ${legacyWhereSql} ORDER BY created_at DESC LIMIT 10000`
              ).bind(...baseParams).all<Record<string, unknown>>();
            } else {
              fallbackRes = { results: [] };
            }
          }
          if (Array.isArray(fallbackRes.results) && fallbackRes.results.length > 0) {
            result = {
              ...result,
              rows: fallbackRes.results as unknown as typeof result.rows,
              total: fallbackRes.results.length,
            };
          }
        } catch {
          // Keep original empty result if fallback query fails
        }
      }

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
