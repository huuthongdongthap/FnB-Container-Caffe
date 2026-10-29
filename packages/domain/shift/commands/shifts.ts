/** Staff attendance API, backed exclusively by tenant-owned staff_shifts rows. */
import { Hono } from 'hono';
import { clockInSchema, clockOutSchema } from 'worker/src/lib/validators';
import type { Env } from 'worker/src/types/env';
import { requireAuth } from 'worker/src/middleware/auth';
import { staffSessionErrorResponse, STAFF_SESSION_ROLES } from 'worker/src/lib/staff-session';
import { shiftDto } from '../model/shift-types';
import { shiftScope, ShiftContractError } from './shift-access';
import { listShifts } from './shift-repository';
import { clockIn, clockOut } from './attendance';

export const shiftsRouter = new Hono<{ Bindings: Env }>();
shiftsRouter.use('*', requireAuth(STAFF_SESSION_ROLES));
shiftsRouter.onError((error, c) => {
  if (error instanceof ShiftContractError) return c.json({ success: false, error: error.message }, error.status);
  if ('status' in error && error.status === 503) return c.json({ success: false, error: error.message }, 503);
  return staffSessionErrorResponse(error) || c.json({ success: false, error: 'Attendance unavailable' }, 500);
});
shiftsRouter.post('/clock-in', async (c) => {
  const parsed = clockInSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const scope = await shiftScope(c.env, c.get('user'));
  return c.json({ success: true, data: shiftDto(await clockIn(scope, parsed.data.staff_id, parsed.data.notes)) }, 201);
});
shiftsRouter.post('/clock-out', async (c) => {
  const parsed = clockOutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const scope = await shiftScope(c.env, c.get('user'));
  return c.json({ success: true, data: shiftDto(await clockOut(scope, parsed.data.staff_id)) });
});
shiftsRouter.get('/today', async (c) => {
  const scope = await shiftScope(c.env, c.get('user'));
  const { rows } = await listShifts(scope, { today: true });
  return c.json({ success: true, data: rows.map(shiftDto) });
});
shiftsRouter.get('/', async (c) => {
  const scope = await shiftScope(c.env, c.get('user'));
  const { rows } = await listShifts(scope, { from: c.req.query('from'), to: c.req.query('to'), staffId: c.req.query('staff_id') });
  return c.json({ success: true, data: rows.map(shiftDto) });
});
