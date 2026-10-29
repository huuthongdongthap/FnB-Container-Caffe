import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { shiftScope, ShiftContractError } from '../../../../packages/domain/shift/commands/shift-access';
import { getShift, listShifts } from '../../../../packages/domain/shift/commands/shift-repository';
import { createSchedule, updateSchedule } from '../../../../packages/domain/shift/commands/schedules';
import { shiftDto } from '../../../../packages/domain/shift/model/shift-types';

export function registerShiftHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(StaffRoutes.shifts.list as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user')), query = c.req.valid('query');
    if (query.locationId && query.locationId !== scope.tenantId) throw new ShiftContractError('Location does not match store', 403);
    const { rows, meta } = await listShifts(scope, { ...query, from: query.dateFrom, to: query.dateTo });
    return c.json({ success: true, data: { shifts: rows.map(shiftDto), meta } });
  });
  app.openapi(StaffRoutes.shifts.get as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'));
    return c.json({ success: true, data: shiftDto(await getShift(scope, c.req.valid('param').id)) });
  });
  app.openapi(StaffRoutes.shifts.create as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'));
    return c.json({ success: true, data: shiftDto(await createSchedule(scope, c.req.valid('json'))) }, 201);
  });
  app.openapi(StaffRoutes.shifts.update as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'));
    return c.json({ success: true, data: shiftDto(await updateSchedule(scope, c.req.valid('param').id, c.req.valid('json'))) });
  });
  app.openapi(StaffRoutes.shifts.delete as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'));
    // Preserve the row and its identity: cancellation only applies before work starts.
    await updateSchedule(scope, c.req.valid('param').id, { status: 'cancelled' });
    return c.json({ success: true, data: { success: true } });
  });
}
