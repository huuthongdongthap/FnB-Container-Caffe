/**
 * Audit Logger — ghi log hành động admin vào D1 để tuân thủ / bảo mật
 * Audit Logger — logs admin actions to D1 for compliance and security.
 *
 * Usage:
 *   const auditLogger = new AuditLogger(ctx.executionCtx, ctx.env.AURA_DB);
 *   ctx.executionCtx.waitUntil(auditLogger.log({ actor_id, actor_name, action, resource_type }));
 *
 *   const result = await auditLogger.query({ actorId: '...', page: 1, pageSize: 20 });
 */

import type { MiddlewareHandler } from 'hono';
import type { ExecutionContext } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { buildCanonicalAuditRecord } from '@aura/domain-audit';

// ── Types ──

/**
 * Bản ghi audit (khớp schema bảng audit_logs)
 * Audit log entry (matches audit_logs table schema)
 */
export interface AuditEntry {
  actor_id: string;
  actor_name: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: string;
  ip_address?: string;
  tenant_id?: string;
  created_at: string;
}

export interface AuditQueryFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  maxPageSize?: number;
  tenantId?: string;
}

export type AuditQueryResult = {
  rows: AuditEntry[];
  total: number;
} & AuditEntry[];

export function toAuditQueryResult(rows: AuditEntry[], total: number): AuditQueryResult {
  return Object.assign([...rows], { rows, total });
}

// ── AuditLogger Class ──

/**
 * AuditLogger — ghi và truy vấn audit logs không chặn request
 * AuditLogger — non-blocking audit log writer and querier.
 *
 * Tất cả INSERT được chạy qua ctx.waitUntil để không ảnh hưởng đến latency.
 * All INSERTs run via ctx.waitUntil so request latency is unaffected.
 */
export class AuditLogger {
  private ctx?: ExecutionContext;
  private db: D1Database;

  constructor(ctxOrDb: ExecutionContext | D1Database, maybeDb?: D1Database) {
    if (maybeDb) {
      this.ctx = ctxOrDb as ExecutionContext;
      this.db = maybeDb;
    } else if (ctxOrDb && typeof (ctxOrDb as D1Database).prepare === 'function') {
      this.ctx = undefined;
      this.db = ctxOrDb as D1Database;
    } else {
      this.ctx = ctxOrDb as ExecutionContext;
      this.db = maybeDb as unknown as D1Database;
    }
  }

  /**
   * Ghi một bản ghi audit vào D1 (bất đồng bộ qua waitUntil)
   * Write an audit log entry to D1 (async via waitUntil).
   *
   * @param entry - Thông tin audit (không bao gồm created_at, được tự động gán)
   *                Audit details (created_at is auto-assigned)
   */
  async log(entry: Omit<AuditEntry, 'created_at'>): Promise<void> {
    const task = (async() => {
      try {
        let parsedDetails: Record<string, unknown> | null = null;
        if (entry.details) {
          try {
            parsedDetails = JSON.parse(entry.details);
          } catch {
            parsedDetails = { raw: entry.details };
          }
        }
        const rawTenant =
          entry.tenant_id ??
          (typeof parsedDetails?.tenant_id === 'string' ? parsedDetails.tenant_id : undefined) ??
          (typeof parsedDetails?.tenantId === 'string' ? parsedDetails.tenantId : undefined);
        const resolvedTenant = (typeof rawTenant === 'string' && rawTenant.trim() ? rawTenant.trim() : 'default');

        const record = buildCanonicalAuditRecord({
          actor: { id: entry.actor_id, name: entry.actor_name, tenantId: resolvedTenant },
          action: entry.action,
          resourceType: entry.resource_type,
          resourceId: entry.resource_id,
          tenantId: resolvedTenant,
          metadata: parsedDetails || undefined,
          ipAddress: entry.ip_address,
        });

        try {
          await this.db.prepare(
            `INSERT INTO audit_logs (
              id, actor_id, actor_name, user_id, action,
              resource_type, resource_id, entity_type, entity_id,
              operating_unit_id, tenant_id, status, details, metadata,
              correlation_id, ip_address, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            record.id, record.actor_id, record.actor_name, record.user_id, record.action,
            record.resource_type, record.resource_id, record.entity_type, record.entity_id,
            record.operating_unit_id, record.tenant_id, record.status, record.details, record.metadata,
            record.correlation_id, record.ip_address, record.created_at
          ).run();
        } catch {
          try {
            await this.db.prepare(
              `INSERT INTO audit_logs (
                actor_id, actor_name, action, resource_type, resource_id, details, ip_address, tenant_id, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              entry.actor_id,
              entry.actor_name,
              entry.action,
              entry.resource_type,
              entry.resource_id ?? null,
              entry.details ?? record.details,
              entry.ip_address ?? null,
              resolvedTenant,
              record.created_at
            ).run();
          } catch {
            const fallbackDetails = `[tenant:${resolvedTenant}] ${entry.details || ''}`.trim();
            await this.db.prepare(
              `INSERT INTO audit_logs (
                actor_id, actor_name, action, resource_type, resource_id, details, ip_address, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              entry.actor_id,
              entry.actor_name,
              entry.action,
              entry.resource_type,
              entry.resource_id ?? null,
              fallbackDetails,
              entry.ip_address ?? null,
              record.created_at
            ).run();
          }
        }
      } catch {
        // Ghi log không quan trọng — không làm crash request
        // Audit logging is best-effort — never crash the request
      }
    })();

    try {
      if (this.ctx?.waitUntil) {
        this.ctx.waitUntil(task);
      } else {
        await task;
      }
    } catch {
      await task;
    }
  }

  /**
   * Truy vấn audit logs với bộ lọc động và phân trang
   * Query audit logs with dynamic filters and pagination.
   *
   * @param filters - Bộ lọc tìm kiếm (tất cả đều optional)
   *                  Search filters (all optional)
   * @returns Danh sách bản ghi + tổng số
   *          List of entries + total count
   */
  async query(filters: AuditQueryFilters): Promise<AuditQueryResult> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.actorId) {
      conditions.push('actor_id = ?');
      params.push(filters.actorId);
    }
    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }
    if (filters.resourceType) {
      conditions.push('resource_type = ?');
      params.push(filters.resourceType);
    }
    if (filters.dateFrom) {
      conditions.push('created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('created_at <= ?');
      params.push(filters.dateTo);
    }

    const page = Math.max(1, filters.page ?? 1);
    const maxPageSize = Math.max(1, filters.maxPageSize ?? 100);
    const pageSize = Math.min(maxPageSize, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const rawFilterTenant = typeof filters.tenantId === 'string' ? filters.tenantId.trim() : '';
    const cleanTenant = !rawFilterTenant
      ? 'default'
      : rawFilterTenant.toLowerCase() === 'hq'
        ? '*'
        : rawFilterTenant;
    if (cleanTenant && cleanTenant !== '*') {
      try {
        const scopedConditions = [
          ...conditions,
          "(COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR json_extract(details, '$.tenant_id') = ? OR json_extract(details, '$.tenantId') = ?)",
        ];
        const scopedParams = [...params, cleanTenant, cleanTenant, cleanTenant];
        const scopedWhere = `WHERE ${scopedConditions.join(' AND ')}`;
        const countRow = await this.db.prepare(
          `SELECT COUNT(*) as total FROM audit_logs ${scopedWhere}`
        ).bind(...scopedParams).first<{ total: number }>();
        const { results } = await this.db.prepare(
          `SELECT * FROM audit_logs ${scopedWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(...scopedParams, pageSize, offset).all<AuditEntry>();
        return toAuditQueryResult((results ?? []) as AuditEntry[], countRow?.total ?? 0);
      } catch {
        try {
          const scopedConditions = [
            ...conditions,
            "COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
          ];
          const scopedParams = [...params, cleanTenant];
          const scopedWhere = `WHERE ${scopedConditions.join(' AND ')}`;
          const countRow = await this.db.prepare(
            `SELECT COUNT(*) as total FROM audit_logs ${scopedWhere}`
          ).bind(...scopedParams).first<{ total: number }>();
          const { results } = await this.db.prepare(
            `SELECT * FROM audit_logs ${scopedWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...scopedParams, pageSize, offset).all<AuditEntry>();
          return toAuditQueryResult((results ?? []) as AuditEntry[], countRow?.total ?? 0);
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          if (cleanTenant !== 'default' || !/no such column:\s*tenant_id/i.test(msg)) {
            return toAuditQueryResult([], 0);
          }
        }
      }
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Tổng số — total count
    const countRow = await this.db.prepare(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
    ).bind(...params).first<{ total: number }>();
    const total = countRow?.total ?? 0;

    // Dữ liệu phân trang — paginated rows
    const dataParams = [...params, pageSize, offset];
    const { results } = await this.db.prepare(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...dataParams).all<AuditEntry>();

    return toAuditQueryResult((results ?? []) as AuditEntry[], total);
  }

  /**
   * Xoá các bản ghi audit cũ hơn retentionDays
   * Delete audit log entries older than retentionDays.
   *
   * @param retentionDays - Số ngày giữ lại (mặc định 90)
   *                        Retention period in days (default 90)
   * @returns Số bản ghi đã xoá / Number of deleted rows
   */
  async prune(retentionDays: number = 90, tenantId: string = 'default'): Promise<{ deleted: number }> {
    const rawTenant = typeof tenantId === 'string' ? tenantId.trim() : '';
    const cleanTenant = !rawTenant
      ? 'default'
      : rawTenant.toLowerCase() === 'hq'
        ? '*'
        : rawTenant;
    try {
      if (cleanTenant && cleanTenant !== '*') {
        try {
          const scopedResult = await this.db.prepare(
            "DELETE FROM audit_logs WHERE created_at < datetime('now', ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(`-${retentionDays} days`, cleanTenant).run();
          return { deleted: scopedResult.meta?.changes ?? 0 };
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          if (cleanTenant !== 'default' || !/no such column:\s*tenant_id/i.test(msg)) {
            return { deleted: 0 };
          }
        }
      }
      const result = await this.db.prepare(
        'DELETE FROM audit_logs WHERE created_at < datetime(\'now\', ?)'
      ).bind(`-${retentionDays} days`).run();
      return { deleted: result.meta?.changes ?? 0 };
    } catch {
      return { deleted: 0 };
    }
  }
}

// ── Middleware ──

/**
 * Tạo middleware Hono tự động ghi audit log cho các request admin
 * Create a Hono middleware that auto-logs admin requests based on path patterns.
 *
 * Tạo AuditLogger từ request context để mỗi request có ExecutionContext riêng.
 * Creates AuditLogger from request context so each request has its own ExecutionContext.
 *
 * Các pattern được log:
 *   /api/admin/*       -> admin.*
 *   /api/erpnext*      -> erpnext.*
 *   /api/broadcast/*   -> broadcast.*
 *   /api/test/*        -> test.*
 *   /api/mixpost/*     -> mixpost.*
 *   /api/mautic-bridge/* -> mautic-bridge.*
 *   /api/zalo/*        -> zalo.*
 *
 * Usage:
 *   app.use('/api/admin/*', createAuditMiddleware());
 *
 * Yêu cầu: middleware này phải chạy SAU requireAuth để có c.get('user').
 * Requirement: this middleware MUST run AFTER requireAuth so c.get('user') is populated.
 */
export function createAuditMiddleware(): MiddlewareHandler<{ Bindings: { AURA_DB: D1Database } & Record<string, unknown> }> {
  return async(c, next) => {
    // Tạo AuditLogger từ request context — mỗi request có ExecutionCtx riêng
    // Create AuditLogger from request context — each request gets its own ExecutionCtx
    let execCtx: ExecutionContext | undefined;
    try {
      execCtx = c.executionCtx;
    } catch {
      execCtx = undefined;
    }
    const auditLogger = new AuditLogger(execCtx as ExecutionContext, c.env.AURA_DB);

    await next();

    try {
      const user = c.get('user') as { id?: string; name?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
      if (!user?.id) {
        return;
      }

      const path = c.req.path;
      const method = c.req.method;

      // Map đường dẫn thành action prefix / Map path to action prefix
      let actionPrefix: string;
      if (path.startsWith('/api/admin/')) {
        actionPrefix = 'admin';
      } else if (path.startsWith('/api/erpnext')) {
        actionPrefix = 'erpnext';
      } else if (path.startsWith('/api/broadcast/')) {
        actionPrefix = 'broadcast';
      } else if (path.startsWith('/api/mixpost/')) {
        actionPrefix = 'mixpost';
      } else if (path.startsWith('/api/mautic-bridge/')) {
        actionPrefix = 'mautic-bridge';
      } else if (path.startsWith('/api/zalo/')) {
        actionPrefix = 'zalo';
      } else if (path.startsWith('/api/test/')) {
        actionPrefix = 'test';
      } else {
        return; // Không log — không thuộc pattern admin
      }

      // Rút gọn path thành resource type / Derive resource type from path
      const resourceType = path.replace(/^\/api\//, '').split('/')[0] || 'unknown';
      const ctxTenant = c.get('tenantId' as never) as string | undefined;
      const rawUserTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
      const isHqAdmin =
        (user.role === 'owner' || user.role === 'admin') &&
        (rawUserTenant.toLowerCase() === 'hq' || rawUserTenant === '*');
      const headerTenant =
        c.req.header('X-Tenant-ID') ||
        c.req.header('x-tenant-id') ||
        c.req.header('X-Store-ID') ||
        c.req.header('x-store-id') ||
        '';
      const rawTenant = isHqAdmin
        ? (
            (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : undefined) ||
            (headerTenant && headerTenant !== '*' && headerTenant.toLowerCase() !== 'hq' ? headerTenant : undefined) ||
            rawUserTenant ||
            'default'
          )
        : (
            (rawUserTenant && rawUserTenant !== '*' && rawUserTenant.toLowerCase() !== 'hq' ? rawUserTenant : undefined) ||
            (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : undefined) ||
            'default'
          );
      const resolvedTenant = String(rawTenant).trim() || 'default';

      const entry: Omit<AuditEntry, 'created_at'> = {
        actor_id: user.id!,
        actor_name: user.name ?? 'Unknown',
        action: `${actionPrefix}.${method.toLowerCase()}`,
        resource_type: resourceType,
        resource_id: c.req.param('id') ?? undefined,
        tenant_id: resolvedTenant,
        details: JSON.stringify({ path, method, tenant_id: resolvedTenant }),
        ip_address: c.req.header('cf-connecting-ip') ?? undefined
      };

      auditLogger.log(entry);
    } catch {
      // Middleware audit lỗi âm thầm — không ảnh hưởng response
      // Audit middleware failures silently — never affect the response
    }
  };
}
