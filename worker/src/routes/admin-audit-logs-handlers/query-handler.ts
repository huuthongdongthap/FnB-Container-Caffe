import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { AuditLogger } from '../../lib/audit-logger';
import { createLogger } from '../../middleware/logger';
import { getTenantId } from '../../middleware/tenant';
import { type PaginatedResponse } from './types';

const log = createLogger({ route: 'admin-audit-logs:query' });

export async function filterAuditRowsByTenant<T extends Record<string, any>>(
  db: any,
  rows: T[],
  tenantId: string
): Promise<T[]> {
  if (tenantId === '*' || rows.length === 0) return rows;
  const actorTenantCache = new Map<string, string | null>();
  const filtered: T[] = [];

  for (const row of rows) {
    if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
      if (String(row.tenant_id).trim() === tenantId) {
        filtered.push(row);
      }
      continue;
    }

    const rawDetails = String(row.details || row.metadata || '');
    let matchedFromMeta: boolean | null = null;
    if (rawDetails.includes('tenant_id')) {
      try {
        const parsed = JSON.parse(rawDetails);
        if (parsed && typeof parsed.tenant_id === 'string' && parsed.tenant_id.trim()) {
          matchedFromMeta = parsed.tenant_id.trim() === tenantId;
        }
      } catch {
        // Ignore non-JSON details
      }
    }
    if (matchedFromMeta !== null) {
      if (matchedFromMeta) filtered.push(row);
      continue;
    }

    const actorId = String(row.actor_id || row.user_id || '');
    if (actorId && db && typeof db.prepare === 'function') {
      let actorTenant = actorTenantCache.get(actorId);
      if (actorTenant === undefined) {
        const userRow = (await db
          .prepare('SELECT id, tenant_id FROM users WHERE id = ?')
          .bind(actorId)
          .first()
          .catch(() => null)) as Record<string, unknown> | null;
        if (userRow && 'tenant_id' in userRow && userRow.tenant_id !== undefined) {
          const trimmedActorTenant = typeof userRow.tenant_id === 'string' ? userRow.tenant_id.trim() : '';
          actorTenant = trimmedActorTenant || 'default';
        } else {
          actorTenant = null;
        }
        actorTenantCache.set(actorId, actorTenant);
      }
      if (actorTenant !== null) {
        if (actorTenant === tenantId) filtered.push(row);
        continue;
      }
    }

    if (tenantId === 'default') {
      filtered.push(row);
    }
  }

  return filtered;
}

const AUDIT_LOG_ALLOWED_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

export function registerQueryHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/admin/audit-logs — query audit logs with filters and pagination
  router.get('/', async (c) => {
    const user = c.get('user' as never) as { role?: string } | undefined;
    if (user?.role && !AUDIT_LOG_ALLOWED_ROLES.includes(String(user.role).toLowerCase())) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    try {
      // Create AuditLogger per-request (query only needs AURA_DB)
      let execCtx: any;
      try { execCtx = c.executionCtx; } catch { execCtx = undefined; }
      const auditLogger = new AuditLogger(execCtx, c.env.AURA_DB);
      const actorId = c.req.query('actor_id');
      const action = c.req.query('action');
      const resourceType = c.req.query('resource_type');
      const dateFrom = c.req.query('date_from');
      const dateTo = c.req.query('date_to');
      const pageRaw = c.req.query('page');
      const pageSizeRaw = c.req.query('page_size') ?? c.req.query('pageSize');

      // Validate page / pageSize
      const page = pageRaw ? parseInt(pageRaw, 10) : 1;
      const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 20;

      if (pageRaw && (!Number.isInteger(page) || page < 1)) {
        return c.json({
          error: 'Tham số page không hợp lệ. Phải là số nguyên >= 1 / Invalid page parameter. Must be an integer >= 1'
        }, 400);
      }

      if (pageSizeRaw && (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)) {
        return c.json({
          error: 'Tham số page_size không hợp lệ. Phải từ 1 đến 100 / Invalid page_size parameter. Must be between 1 and 100'
        }, 400);
      }

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

      const tenantId = getTenantId(c as any);
      const isScoped = tenantId !== '*';
      const batchSize = isScoped ? Math.max(page * pageSize * 5, 500) : pageSize;
      const queryPage = isScoped ? 1 : page;

      let result = await auditLogger.query({
        actorId: actorId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: queryPage,
        pageSize: batchSize
      });

      // Fallback for case-insensitive / prefix / CRUD verb action filters (e.g. CREATE -> %.post)
      if (action && result.rows.length === 0) {
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
          if (dateTo) {
            conditions.push('created_at <= ?');
            params.push(dateTo);
          }

          const upper = action.trim().toUpperCase();
          const verbMethodMap: Record<string, string[]> = {
            CREATE: ['%.post', '%create%'],
            UPDATE: ['%.put', '%.patch', '%update%'],
            DELETE: ['%.delete', '%delete%'],
            LOGIN: ['%login%', '%auth%'],
            EXPORT: ['%export%'],
          };
          const patterns = verbMethodMap[upper] ?? [`%${action.trim().toLowerCase()}%`];
          const actionOrClauses = ['LOWER(action) = LOWER(?)', ...patterns.map(() => 'LOWER(action) LIKE ?')];
          conditions.push(`(${actionOrClauses.join(' OR ')})`);
          params.push(action.trim(), ...patterns);

          const whereClause = `WHERE ${conditions.join(' AND ')}`;
          const offset = (queryPage - 1) * batchSize;
          const countRow = await c.env.AURA_DB.prepare(
            `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
          ).bind(...params).first<{ total: number }>();
          const { results } = await c.env.AURA_DB.prepare(
            `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, batchSize, offset).all<typeof result.rows[number]>();
          if (results && results.length > 0) {
            result = {
              rows: results,
              total: countRow?.total ?? results.length,
            };
          }
        } catch {
          // Keep original result on fallback query error
        }
      }

      if (isScoped && result.rows.length > 0) {
        const filteredAll = await filterAuditRowsByTenant(c.env.AURA_DB, result.rows as any[], tenantId);
        const startIdx = (page - 1) * pageSize;
        result = {
          rows: filteredAll.slice(startIdx, startIdx + pageSize) as any,
          total: result.rows.length < batchSize
            ? filteredAll.length
            : Math.max(filteredAll.length, result.total - (result.rows.length - filteredAll.length)),
        };
      }

      const response: PaginatedResponse<typeof result.rows[number]> = {
        rows: result.rows,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.ceil(result.total / pageSize) || 0
      };

      return c.json(response);
    } catch (err) {
      log.error('Audit log query failed', { error: String(err) });
      return c.json({
        error: 'Lỗi máy chủ khi truy vấn audit logs / Server error while querying audit logs'
      }, 500);
    }
  });
}
