/**
 * Admin Audit Log Routes — /api/admin/audit-logs
 * Truy vấn và xuất CSV log kiểm tra hành động admin
 * Query and export admin action audit logs.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth.js';
import { AuditLogger } from '../lib/audit-logger';
import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'admin-audit-logs' });

// ── Types ──

interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Query param mapping ──

const VALID_SORT_DIRECTIONS = ['asc', 'desc'] as const;

// ── Route Registration ──

/**
 * Đăng ký routes audit log vào app Hono chính
 * Register audit log routes on the main Hono app.
 *
 * Routes được mount tại /api/admin/audit-logs
 * Yêu cầu token owner hoặc staff.
 */
export function registerAuditLogRoutes(
  app: Hono<{ Bindings: Env }>
): void {
  // ── Khởi tạo sub-router ──
  const router = new Hono<{ Bindings: Env }>();

  // Tất cả routes yêu cầu auth owner/staff
  router.use('*', requireAuth(['owner', 'staff']));

  // ── GET /api/admin/audit-logs ──
  // Truy vấn audit logs với bộ lọc và phân trang
  // Query audit logs with filters and pagination.
  router.get('/', async(c) => {
    try {
      // Tạo AuditLogger per-request (query chỉ cần AURA_DB)
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

      const result = await auditLogger.query({
        actorId: actorId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize
      });

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

  // ── GET /api/admin/audit-logs/export ──
  // Xuất CSV audit logs với bộ lọc
  // Export audit logs as CSV with filters.
  router.get('/export', async(c) => {
    try {
      // Tạo AuditLogger per-request (query chỉ cần AURA_DB)
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

      // Lấy tất cả (pageSize lớn) để xuất CSV — không giới hạn
      const result = await auditLogger.query({
        actorId: actorId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: 1,
        pageSize: 10000
      });

      // Bilingual CSV headers (VN + EN)
      // Tiêu đề song ngữ để client không rành kỹ thuật cũng hiểu
      const headers = [
        'ID Người dùng / Actor ID',
        'Tên người dùng / Actor Name',
        'Hành động / Action',
        'Loại tài nguyên / Resource Type',
        'ID tài nguyên / Resource ID',
        'Chi tiết / Details',
        'Địa chỉ IP / IP Address',
        'Thời gian / Created At'
      ];

      const csvRows: string[] = [headers.join(',')];

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
      return c.body(`﻿${csvRows.join('\n')}`); // BOM cho Excel hiển thị UTF-8 đúng
    } catch (err) {
      log.error('Audit log export failed', { error: String(err) });
      return c.json({
        error: 'Lỗi máy chủ khi xuất audit logs / Server error while exporting audit logs'
      }, 500);
    }
  });

  // Mount sub-router vào app chính
  app.route('/api/admin/audit-logs', router);
}

// ── Helpers ──

/**
 * Escape giá trị CSV: bọc double-quote và nhân đôi quote bên trong
 * Escape CSV value: wrap in double-quotes and double inner quotes.
 */
function escapeCsv(value: string): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // Luôn bọc quote để tránh lỗi parse với dấu phẩy / xuống dòng
  return `"${str.replace(/"/g, '""')}"`;
}
