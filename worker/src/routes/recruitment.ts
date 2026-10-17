/**
 * Recruitment Routes
 * Endpoints for job applicant submission and staff administration.
 * POST   /api/recruitment/apply            — Submit candidate application (public)
 * GET    /api/recruitment/applications     — List candidates (owner, manager, staff)
 * PATCH  /api/recruitment/applications/:id — Update candidate status (owner, manager, staff)
 * DELETE /api/recruitment/applications/:id — Delete candidate record (owner, manager)
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireAuth } from '../middleware/auth';
import { rateLimitMiddleware, RECRUITMENT_RATE_LIMIT } from '../middleware/rate-limit';
import type { Env } from '../types/env';

const log = createLogger({ route: 'recruitment' });

const applySchema = z.object({
  fullName: z.string().min(1, 'Họ và tên không được để trống').max(100),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ').max(20),
  birthYear: z.string().max(10).optional().default(''),
  position: z.enum(['barista', 'service', 'other']).default('barista'),
  shifts: z.array(z.string()).default([]),
  experience: z.string().max(50).default('none'),
  note: z.string().max(1000).optional().default('')
});

const statusSchema = z.object({
  status: z.enum(['pending', 'contacted', 'interview', 'hired', 'rejected'])
});

export async function submitApplication(c: Context<{ Bindings: Env }>) {
  try {
    const raw = await c.req.json() as Record<string, unknown>;
    const parsed = applySchema.safeParse(raw);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }

    const data = parsed.data;
    const appId = `APP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const db = c.env.AURA_DB;

    await db.prepare(
      `INSERT INTO recruitment_applications (
        id, full_name, phone, birth_year, position, shifts, experience, note, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
    ).bind(
      appId,
      data.fullName.trim(),
      data.phone.trim(),
      data.birthYear?.trim() || null,
      data.position,
      JSON.stringify(data.shifts),
      data.experience,
      data.note?.trim() || null
    ).run();

    // Dual-record into contact_messages for notifications
    try {
      const summary = `[Ứng tuyển AURA CAFE] Vị trí: ${
        data.position === 'barista' ? 'Pha chế (Barista)' : 'Phục vụ & Thu ngân'
      } | Năm sinh: ${data.birthYear || 'Chưa rõ'} | Ca: ${data.shifts.join(', ')} | Kinh nghiệm: ${data.experience}`;
      await db.prepare(
        'INSERT INTO contact_messages (id, name, phone, email, category, content, status) VALUES (?, ?, ?, NULL, ?, ?, ?)'
      ).bind(appId, data.fullName.trim(), data.phone.trim(), 'recruitment', summary, 'unread').run();
    } catch {
      // Primary table is already committed
    }

    log.info('Application submitted successfully', { appId, position: data.position });

    return jsonResponse({
      success: true,
      message: 'Hồ sơ đã được gửi thành công. Quản lý AURA CAFE sẽ liên hệ sớm.',
      id: appId
    }, 201);
  } catch (error) {
    log.error('Application submit error', { message: (error as Error).message });
    return errorResponse('Lỗi hệ thống khi nộp hồ sơ, vui lòng thử lại sau', 500);
  }
}

export async function listApplications(c: Context<{ Bindings: Env }>) {
  try {
    const db = c.env.AURA_DB;
    const status = c.req.query('status');
    const position = c.req.query('position');
    const search = c.req.query('search');

    let query = 'SELECT id, full_name as fullName, phone, birth_year as birthYear, position, shifts, experience, note, status, created_at as createdAt, updated_at as updatedAt FROM recruitment_applications WHERE 1=1';
    const params: (string | number)[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (position) {
      query += ' AND position = ?';
      params.push(position);
    }
    if (search) {
      query += ' AND (full_name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const rows = await db.prepare(query).bind(...params).all();
    const applications = (rows.results || []).map((row: any) => {
      let parsedShifts: string[] = [];
      try {
        parsedShifts = typeof row.shifts === 'string' ? JSON.parse(row.shifts) : row.shifts || [];
      } catch {
        parsedShifts = [];
      }
      return {
        ...row,
        shifts: parsedShifts
      };
    });

    return jsonResponse({
      success: true,
      data: applications
    });
  } catch (error) {
    log.error('List applications error', { message: (error as Error).message });
    return errorResponse('Lỗi hệ thống khi tải danh sách ứng viên', 500);
  }
}

export async function updateApplicationStatus(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Trạng thái không hợp lệ', 400);
    }

    const db = c.env.AURA_DB;
    const result = await db.prepare(
      'UPDATE recruitment_applications SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(parsed.data.status, id).run();

    if (result.meta?.changes === 0) {
      return errorResponse('Không tìm thấy hồ sơ', 404);
    }

    return jsonResponse({
      success: true,
      message: 'Cập nhật trạng thái thành công'
    });
  } catch (error) {
    log.error('Update status error', { message: (error as Error).message });
    return errorResponse('Lỗi hệ thống khi cập nhật trạng thái hồ sơ', 500);
  }
}

export async function deleteApplication(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');
    const db = c.env.AURA_DB;

    await db.prepare('DELETE FROM recruitment_applications WHERE id = ?').bind(id).run();

    return jsonResponse({
      success: true,
      message: 'Đã xóa hồ sơ ứng viên'
    });
  } catch (error) {
    log.error('Delete application error', { message: (error as Error).message });
    return errorResponse('Lỗi hệ thống khi xóa hồ sơ ứng viên', 500);
  }
}

export const recruitmentRouter = new Hono<{ Bindings: Env }>();

// Public submission routes (rate-limited per IP)
recruitmentRouter.post('/apply', rateLimitMiddleware(RECRUITMENT_RATE_LIMIT), submitApplication);
recruitmentRouter.post('/', rateLimitMiddleware(RECRUITMENT_RATE_LIMIT), submitApplication);

// Protected staff/admin routes
recruitmentRouter.use('/applications/*', requireAuth(['owner', 'manager', 'staff']));
recruitmentRouter.use('/applications', requireAuth(['owner', 'manager', 'staff']));
recruitmentRouter.get('/applications', listApplications);
recruitmentRouter.patch('/applications/:id', updateApplicationStatus);
recruitmentRouter.delete('/applications/:id', requireAuth(['owner', 'manager']), deleteApplication);
