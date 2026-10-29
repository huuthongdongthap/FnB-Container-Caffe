import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { shiftScope, ShiftContractError } from '../../../../packages/domain/shift/commands/shift-access';
import { getShift, listShifts } from '../../../../packages/domain/shift/commands/shift-repository';
import { clockIn, clockOut } from '../../../../packages/domain/shift/commands/attendance';
import { attendanceDto } from '../../../../packages/domain/shift/model/shift-types';

export function registerAttendanceHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(StaffRoutes.attendance.checkIn as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user')), body = c.req.valid('json');
    if (body.locationId && body.locationId !== scope.tenantId) throw new ShiftContractError('Location does not match store', 403);
    const scheduled = body.shiftId ? await getShift(scope, body.shiftId) : undefined;
    const row = await clockIn(scope, body.staffId || scheduled?.staff_id, body.notes, body.shiftId);
    return c.json({ success: true, data: attendanceDto(row) }, 201);
  });
  app.openapi(StaffRoutes.attendance.checkOut as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user')), body = c.req.valid('json');
    const existing = body.attendanceId ? await getShift(scope, body.attendanceId) : undefined;
    const row = await clockOut(scope, body.staffId || existing?.staff_id, body.attendanceId, body.notes);
    return c.json({ success: true, data: attendanceDto(row) });
  });
  app.openapi(StaffRoutes.attendance.list as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user')), query = c.req.valid('query');
    if (query.locationId && query.locationId !== scope.tenantId) throw new ShiftContractError('Location does not match store', 403);
    const { rows, meta } = await listShifts(scope, { ...query, from: query.dateFrom, to: query.dateTo, attendanceOnly: true });
    return c.json({ success: true, data: { attendance: rows.map(attendanceDto), meta } });
  });
}
