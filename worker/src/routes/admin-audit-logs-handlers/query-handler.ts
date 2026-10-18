import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { AuditLogger } from '../../lib/audit-logger';
import { createLogger } from '../../middleware/logger';
import { type PaginatedResponse } from './types';

const log = createLogger({ route: 'admin-audit-logs:query' });

export function registerQueryHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/admin/audit-logs — query audit logs with filters and pagination
  router.get('/', async (c) => {
    try {
      // Create AuditLogger per-request (query only needs AURA_DB)
      const auditLogger = new AuditLogger(c.executionCtx, c.env.AURA_DB);
      const actorId = c.req.query('actor_id');
      const action = c.req.query('action');
      const resourceType = c.req.query('resource_type');
      const dateFrom = c.req.query('date_from');
      const dateTo = c.req.query('date_to');
      const pageRaw = c.req.query('page');
      const pageSizeRaw = c.req.query('page_size');

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

      let result = await auditLogger.query({
        actorId: actorId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize
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
          const offset = (page - 1) * pageSize;
          const countRow = await c.env.AURA_DB.prepare(
            `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
          ).bind(...params).first<{ total: number }>();
          const { results } = await c.env.AURA_DB.prepare(
            `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...params, pageSize, offset).all<typeof result.rows[number]>();
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
