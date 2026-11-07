import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { AuditLogger } from '../../lib/audit-logger';
import { createLogger } from '../../middleware/logger';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
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
    if (rawDetails.includes('tenant_id') || rawDetails.includes('tenantId')) {
      try {
        const parsed = JSON.parse(rawDetails);
        const rawMetaTenant =
          parsed?.tenant_id ??
          parsed?.tenantId ??
          parsed?.metadata?.tenant_id ??
          parsed?.metadata?.tenantId;
        if (typeof rawMetaTenant === 'string' && rawMetaTenant.trim()) {
          matchedFromMeta = rawMetaTenant.trim() === tenantId;
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
    const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
    if (!user?.role) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    if (!AUDIT_LOG_ALLOWED_ROLES.includes(String(user.role).toLowerCase())) {
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
      // Create AuditLogger per-request (query only needs AURA_DB)
      let execCtx: any;
      try { execCtx = c.executionCtx; } catch { execCtx = undefined; }
      const auditLogger = new AuditLogger(execCtx, c.env.AURA_DB);
      const actorId = c.req.query('actor_id');
      const action = c.req.query('action');
      const resourceType = c.req.query('resource_type');
      const dateFrom = c.req.query('date_from') ?? c.req.query('dateFrom');
      const dateTo = c.req.query('date_to') ?? c.req.query('dateTo');
      const pageRaw = c.req.query('page');
      const pageSizeRaw = c.req.query('page_size') ?? c.req.query('pageSize') ?? c.req.query('limit');

      // Validate page / pageSize
      const parsedPage = pageRaw ? parseInt(pageRaw, 10) : 1;
      const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 20;

      if (pageRaw && (!Number.isInteger(parsedPage) || parsedPage < 1)) {
        return c.json({
          error: 'Tham số page không hợp lệ. Phải là số nguyên >= 1 / Invalid page parameter. Must be an integer >= 1'
        }, 400);
      }

      if (pageSizeRaw && (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)) {
        return c.json({
          error: 'Tham số page_size không hợp lệ. Phải từ 1 đến 100 / Invalid page_size parameter. Must be between 1 and 100'
        }, 400);
      }

      const page = Math.min(Math.max(Number(parsedPage) || 1, 1), 1000);

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

      const isScoped = tenantId !== '*';
      const batchSize = isScoped ? Math.min(Math.max(page * pageSize * 5, 500), 2500) : pageSize;
      const queryPage = isScoped ? 1 : page;

      let result = await auditLogger.query({
        actorId: actorId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: normalizedDateTo,
        page: queryPage,
        pageSize: batchSize,
        maxPageSize: isScoped ? Math.min(Math.max(batchSize, 1000), 2500) : 100,
        tenantId,
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
          if (normalizedDateTo) {
            conditions.push('created_at <= ?');
            params.push(normalizedDateTo);
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

          const offset = (queryPage - 1) * batchSize;
          let countRow: { total: number } | null = null;
          let results: Array<typeof result.rows[number]> | undefined;

          try {
            const scopedConditions = [
              ...conditions,
              "(? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)",
            ];
            const scopedParams = [...params, tenantId, tenantId];
            const scopedWhere = `WHERE ${scopedConditions.join(' AND ')}`;
            countRow = await c.env.AURA_DB.prepare(
              `SELECT COUNT(*) as total FROM audit_logs ${scopedWhere}`
            ).bind(...scopedParams).first<{ total: number }>();
            const scopedRes = await c.env.AURA_DB.prepare(
              `SELECT * FROM audit_logs ${scopedWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
            ).bind(...scopedParams, batchSize, offset).all<typeof result.rows[number]>();
            results = scopedRes.results;
          } catch {
            if (tenantId === 'default' || tenantId === '*') {
              const whereClause = `WHERE ${conditions.join(' AND ')}`;
              countRow = await c.env.AURA_DB.prepare(
                `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
              ).bind(...params).first<{ total: number }>();
              const unscopedRes = await c.env.AURA_DB.prepare(
                `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
              ).bind(...params, batchSize, offset).all<typeof result.rows[number]>();
              results = unscopedRes.results;
            }
          }

          if (results && results.length > 0) {
            const totalVal = countRow?.total ?? results.length;
            result = Object.assign([...results], {
              rows: results,
              total: totalVal,
            });
          }
        } catch {
          // Keep original result on fallback query error
        }
      }

      if (isScoped && result.rows.length > 0) {
        const filteredAll = await filterAuditRowsByTenant(c.env.AURA_DB, result.rows as any[], tenantId);
        const startIdx = (page - 1) * pageSize;
        const pagedRows = filteredAll.slice(startIdx, startIdx + pageSize) as any[];
        const pagedTotal = result.rows.length < batchSize
          ? filteredAll.length
          : Math.max(filteredAll.length, result.total - (result.rows.length - filteredAll.length));
        result = Object.assign([...pagedRows], {
          rows: pagedRows,
          total: pagedTotal,
        });
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
