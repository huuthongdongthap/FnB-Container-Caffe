import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { StaffRoutes } from '../../schemas/staff';
import { extractRequestedShiftTenant, shiftScope, ShiftContractError } from '../../../../packages/domain/shift/commands/shift-access';
import { getShift, listShifts } from '../../../../packages/domain/shift/commands/shift-repository';
import { createSchedule, updateSchedule } from '../../../../packages/domain/shift/commands/schedules';
import { shiftDto } from '../../../../packages/domain/shift/model/shift-types';

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

export function registerShiftHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(StaffRoutes.shifts.list as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c)), query = c.req.valid('query');
    const locId = query.locationId ? String(query.locationId).trim() : '';
    if (locId && (scope.tenantId !== '*' ? locId !== scope.tenantId : false)) {
      throw new ShiftContractError('Location does not match store', 403);
    }
    const normalizedLoc = locId === '*' || locId.toLowerCase() === 'hq' ? '*' : locId;
    const effectiveScope = normalizedLoc && scope.tenantId === '*' ? { ...scope, tenantId: normalizedLoc } : scope;
    const { rows, meta } = await listShifts(effectiveScope, { ...query, from: query.dateFrom, to: query.dateTo });
    return c.json({ success: true, data: { shifts: rows.map(shiftDto), meta } });
  });
  app.openapi(StaffRoutes.shifts.get as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c));
    return c.json({ success: true, data: shiftDto(await getShift(scope, c.req.valid('param').id)) });
  });
  app.openapi(StaffRoutes.shifts.create as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c));
    return c.json({ success: true, data: shiftDto(await createSchedule(scope, c.req.valid('json'))) }, 201);
  });
  app.openapi(StaffRoutes.shifts.update as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c));
    return c.json({ success: true, data: shiftDto(await updateSchedule(scope, c.req.valid('param').id, c.req.valid('json'))) });
  });
  app.openapi(StaffRoutes.shifts.delete as any, async (c: any) => {
    const scope = await shiftScope(c.env, c.get('user'), resolveRequestedShiftTenant(c));
    if (!scope.canManage) throw new ShiftContractError('Owner or manager required', 403);
    const id = c.req.valid('param').id;
    const current = await getShift(scope, id);
    if (current.attendance_state === 'cancelled') {
      return c.json({ success: true, data: { success: true, idempotent: true } });
    }
    // Preserve the row and its identity: cancellation only applies before work starts.
    await updateSchedule(scope, id, { status: 'cancelled' });
    return c.json({ success: true, data: { success: true } });
  });
}
