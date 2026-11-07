import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { extractRequestedShiftTenant, shiftScope, ShiftContractError } from '../../../../packages/domain/shift/commands/shift-access';
import { getShift, listShifts } from '../../../../packages/domain/shift/commands/shift-repository';
import { clockIn, clockOut } from '../../../../packages/domain/shift/commands/attendance';
import { attendanceDto } from '../../../../packages/domain/shift/model/shift-types';

function resolveRequestedShiftTenant(c: any): string {
  const candidates = [
    c?.req?.query?.('tenant_id'),
    c?.req?.query?.('tenantId'),
    c?.req?.query?.('store_id'),
    c?.req?.query?.('storeId'),
    c?.req?.header?.('X-Tenant-ID'),
    c?.req?.header?.('x-tenant-id'),
    c?.req?.header?.('X-Store-ID'),
    c?.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return '__CONFLICT__';
  }
  return candidates[0] || extractRequestedShiftTenant(c);
}

export function registerAttendanceHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(StaffRoutes.attendance.checkIn as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c)), body = c.req.valid('json');
    const locId = body.locationId ? String(body.locationId).trim() : '';
    if (locId && (locId === '*' || locId.toLowerCase() === 'hq' || (scope.tenantId !== '*' && locId !== scope.tenantId))) {
      throw new ShiftContractError('Location does not match store', 403);
    }
    const effectiveScope = locId && scope.tenantId === '*' ? { ...scope, tenantId: locId } : scope;
    const scheduled = body.shiftId ? await getShift(effectiveScope, body.shiftId) : undefined;
    const row = await clockIn(effectiveScope, body.staffId || scheduled?.staff_id, body.notes, body.shiftId);
    return c.json({ success: true, data: attendanceDto(row) }, 201);
  });
  app.openapi(StaffRoutes.attendance.checkOut as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c)), body = c.req.valid('json');
    const existing = body.attendanceId ? await getShift(scope, body.attendanceId) : undefined;
    if (existing && body.staffId && String(body.staffId).trim() !== existing.staff_id) {
      throw new ShiftContractError('Attendance record does not match staff member', 409);
    }
    const row = await clockOut(scope, body.staffId || existing?.staff_id, body.attendanceId, body.notes);
    return c.json({ success: true, data: attendanceDto(row) });
  });
  app.openapi(StaffRoutes.attendance.list as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c)), query = c.req.valid('query');
    const locId = query.locationId ? String(query.locationId).trim() : '';
    if (locId && (scope.tenantId !== '*' ? locId !== scope.tenantId : false)) {
      throw new ShiftContractError('Location does not match store', 403);
    }
    const normalizedLoc = locId === '*' || locId.toLowerCase() === 'hq' ? '*' : locId;
    const effectiveScope = normalizedLoc && scope.tenantId === '*' ? { ...scope, tenantId: normalizedLoc } : scope;
    const { rows, meta } = await listShifts(effectiveScope, { ...query, from: query.dateFrom, to: query.dateTo, attendanceOnly: true });
    return c.json({ success: true, data: { attendance: rows.map(attendanceDto), meta } });
  });
}
