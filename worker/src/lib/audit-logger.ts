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
}

export interface AuditQueryResult {
  rows: AuditEntry[];
  total: number;
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
  constructor(
    private ctx: ExecutionContext,
    private db: D1Database
  ) {}

  /**
   * Ghi một bản ghi audit vào D1 (bất đồng bộ qua waitUntil)
   * Write an audit log entry to D1 (async via waitUntil).
   *
   * @param entry - Thông tin audit (không bao gồm created_at, được tự động gán)
   *                Audit details (created_at is auto-assigned)
   */
  async log(entry: Omit<AuditEntry, 'created_at'>): Promise<void> {
    this.ctx.waitUntil(
      (async() => {
        try {
          await this.db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, ip_address, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            entry.actor_id,
            entry.actor_name,
            entry.action,
            entry.resource_type,
            entry.resource_id ?? null,
            entry.details ?? '{}',
            entry.ip_address ?? null,
            new Date().toISOString()
          ).run();
        } catch {
          // Ghi log không quan trọng — không làm crash request
          // Audit logging is best-effort — never crash the request
        }
      })()
    );
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

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

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

    return {
      rows: (results ?? []) as AuditEntry[],
      total
    };
  }

  /**
   * Xoá các bản ghi audit cũ hơn retentionDays
   * Delete audit log entries older than retentionDays.
   *
   * @param retentionDays - Số ngày giữ lại (mặc định 90)
   *                        Retention period in days (default 90)
   * @returns Số bản ghi đã xoá / Number of deleted rows
   */
  async prune(retentionDays: number = 90): Promise<{ deleted: number }> {
    try {
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
    const auditLogger = new AuditLogger(c.executionCtx, c.env.AURA_DB);

    await next();

    try {
      const user = c.get('user') as { id?: string; name?: string } | undefined;
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

      const entry: Omit<AuditEntry, 'created_at'> = {
        actor_id: user.id!,
        actor_name: user.name ?? 'Unknown',
        action: `${actionPrefix}.${method.toLowerCase()}`,
        resource_type: resourceType,
        resource_id: c.req.param('id') ?? undefined,
        details: JSON.stringify({ path, method }),
        ip_address: c.req.header('cf-connecting-ip') ?? undefined
      };

      auditLogger.log(entry);
    } catch {
      // Middleware audit lỗi âm thầm — không ảnh hưởng response
      // Audit middleware failures silently — never affect the response
    }
  };
}
