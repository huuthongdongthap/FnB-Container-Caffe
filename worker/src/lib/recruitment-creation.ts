import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { errorResponse, jsonResponse } from '../middleware/cors';
import { resolvePilotStore } from './pilot-store';
import { privacyError, privacyStore } from './pilot-privacy-access';
import { prepareResourceCreation, creationInsertGuard, commitResourceCreation } from './resource-creation';

const applySchema = z.object({
  fullName: z.string().trim().min(1, 'Họ và tên không được để trống').max(100),
  phone: z.string().trim().min(8, 'Số điện thoại không hợp lệ').max(20),
  birthYear: z.string().trim().max(10).default(''),
  position: z.enum(['barista', 'service', 'other']).default('barista'),
  shifts: z.array(z.string().max(50)).max(20).default([]),
  experience: z.string().max(50).default('none'),
  note: z.string().trim().max(1000).default(''),
});

/** Both public aliases ignore incidental JWT/body/header tenant selection. */
export async function createRecruitmentApplication(c: Context<{ Bindings: Env }>, admin = false) {
  try {
    const parsed = applySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }
    const tenant = admin ? privacyStore(c, ['owner', 'manager']) : resolvePilotStore(c.env);
    if (tenant instanceof Response) return tenant;
    const data = parsed.data;
    const db = c.env.AURA_DB;
    const intent = await prepareResourceCreation(c.req.raw, {
      resource: 'recruitment', tenantId: tenant, actorId: admin ? c.get('user').id : 'public', payload: data,
    });
    const guard = creationInsertGuard(intent);
    const insert = db.prepare(`INSERT INTO recruitment_applications
      (id, tenant_id, full_name, phone, birth_year, position, shifts, experience, note, status, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now')
      WHERE ${guard.sql} ON CONFLICT(id) DO NOTHING`)
      .bind(intent.id, tenant, data.fullName, data.phone, data.birthYear || null, data.position,
        JSON.stringify(data.shifts), data.experience, data.note || null, ...guard.binds);
    const result = await commitResourceCreation(db, intent, insert);
    const record = await db.prepare(`SELECT id, full_name AS fullName, phone, birth_year AS birthYear, position,
      shifts, experience, note, status, created_at AS createdAt, updated_at AS updatedAt
      FROM recruitment_applications WHERE id = ? AND tenant_id = ?`).bind(result.id, tenant).first<Record<string, unknown>>();
    if (!record) return errorResponse('Resource unavailable', 503);
    return jsonResponse({ success: true, id: result.id,
      data: { ...record, shifts: JSON.parse(String(record.shifts || '[]')) },
      message: 'Hồ sơ đã được gửi thành công. Quản lý AURA CAFE sẽ liên hệ sớm.' }, 201);
  } catch (error) {
    return privacyError(error) || errorResponse('Lỗi hệ thống khi nộp hồ sơ, vui lòng thử lại sau', 500);
  }
}
