/** Store owned recruitment. Public apply never mirrors applicant PII into chat. */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { requireAuth } from '../middleware/auth';
import { rateLimitMiddleware, RECRUITMENT_RATE_LIMIT } from '../middleware/rate-limit';
import { createRecruitmentApplication } from '../lib/recruitment-creation';
import { privacyError, privacyStore } from '../lib/pilot-privacy-access';
import type { Env } from '../types/env';

const statusSchema = z.object({ status: z.enum(['pending', 'contacted', 'interview', 'hired', 'rejected']) });
export const submitApplication = (c: Context<{ Bindings: Env }>) => createRecruitmentApplication(c);

export async function listApplications(c: Context<{ Bindings: Env }>) {
  try {
    const tenant = privacyStore(c, ['owner', 'manager']);
    if (tenant instanceof Response) return tenant;
    let query = `SELECT id, full_name AS fullName, phone, birth_year AS birthYear, position, shifts, experience,
      note, status, created_at AS createdAt, updated_at AS updatedAt FROM recruitment_applications WHERE tenant_id = ?`;
    const params: string[] = [tenant];
    for (const field of ['status', 'position'] as const) {
      const value = c.req.query(field);
      if (value && value !== 'all') { query += ` AND ${field} = ?`; params.push(value); }
    }
    const search = c.req.query('search');
    if (search) { query += ' AND (full_name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    const rows = await c.env.AURA_DB.prepare(`${query} ORDER BY created_at DESC LIMIT 100`).bind(...params).all();
    const applications = rows.results.map((row) => {
      let shifts: unknown = [];
      try { shifts = JSON.parse(String(row.shifts || '[]')); } catch { /* Invalid legacy shifts stay empty. */ }
      return { ...row, shifts: Array.isArray(shifts) ? shifts : [] };
    });
    return jsonResponse({ success: true, data: applications });
  } catch (error) { return privacyError(error) || errorResponse('Lỗi hệ thống khi tải danh sách ứng viên', 500); }
}
export async function updateApplicationStatus(c: Context<{ Bindings: Env }>) {
  try {
    const tenant = privacyStore(c, ['owner', 'manager']);
    if (tenant instanceof Response) return tenant;
    const parsed = statusSchema.safeParse(await c.req.json());
    if (!parsed.success) return errorResponse('Trạng thái không hợp lệ', 400);
    const result = await c.env.AURA_DB.prepare(`UPDATE recruitment_applications
      SET status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
      .bind(parsed.data.status, c.req.param('id'), tenant).run();
    if (!result.meta.changes) return errorResponse('Không tìm thấy hồ sơ', 404);
    return jsonResponse({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error) { return privacyError(error) || errorResponse('Lỗi hệ thống khi cập nhật trạng thái hồ sơ', 500); }
}
export async function deleteApplication(c: Context<{ Bindings: Env }>) {
  try {
    const tenant = privacyStore(c, ['owner', 'manager']);
    if (tenant instanceof Response) return tenant;
    const result = await c.env.AURA_DB.prepare('DELETE FROM recruitment_applications WHERE id = ? AND tenant_id = ?')
      .bind(c.req.param('id'), tenant).run();
    if (!result.meta.changes) return errorResponse('Không tìm thấy hồ sơ', 404);
    return jsonResponse({ success: true, message: 'Đã xóa hồ sơ ứng viên' });
  } catch (error) { return privacyError(error) || errorResponse('Lỗi hệ thống khi xóa hồ sơ ứng viên', 500); }
}
export const recruitmentRouter = new Hono<{ Bindings: Env }>();
recruitmentRouter.post('/apply', rateLimitMiddleware(RECRUITMENT_RATE_LIMIT), submitApplication);
recruitmentRouter.post('/', rateLimitMiddleware(RECRUITMENT_RATE_LIMIT), submitApplication);
recruitmentRouter.use('/applications/*', requireAuth(['owner', 'manager']));
recruitmentRouter.use('/applications', requireAuth(['owner', 'manager']));
recruitmentRouter.get('/applications', listApplications);
recruitmentRouter.post('/applications', (c) => createRecruitmentApplication(c, true));
recruitmentRouter.patch('/applications/:id', updateApplicationStatus);
recruitmentRouter.delete('/applications/:id', deleteApplication);
