/** Staff attendance API, backed exclusively by tenant-owned staff_shifts rows. */
import { Hono } from 'hono';
import { clockInSchema, clockOutSchema } from 'worker/src/lib/validators';
import type { Env } from 'worker/src/types/env';
import { requireAuth } from 'worker/src/middleware/auth';
import { staffSessionErrorResponse, STAFF_SESSION_ROLES } from 'worker/src/lib/staff-session';
import { shiftDto } from '../model/shift-types';
import { extractRequestedShiftTenant, shiftScope, ShiftContractError } from './shift-access';
import { getSuggestedOpeningCash, listShifts } from './shift-repository';
import { clockIn, clockOut } from './attendance';

function reqTenant(c: { req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined } }): string | undefined {
  return extractRequestedShiftTenant(c) || undefined;
}

export const shiftsRouter = new Hono<{ Bindings: Env }>();
const baseShiftsAuth = requireAuth(STAFF_SESSION_ROLES);
shiftsRouter.use('*', async (c, next) => {
  const existingUser = c.get('user' as never) as { role?: string } | undefined;
  if (
    existingUser?.role &&
    (STAFF_SESSION_ROLES as readonly string[]).includes(existingUser.role) &&
    !c.req.header('Authorization')
  ) {
    return next();
  }
  return baseShiftsAuth(c, next);
});
shiftsRouter.onError((error, c) => {
  if (error instanceof ShiftContractError) {
    return c.json(
      {
        success: false,
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.details ? { details: error.details } : {}),
      },
      error.status,
    );
  }
  if ('status' in error && error.status === 503) return c.json({ success: false, error: error.message }, 503);
  return staffSessionErrorResponse(error) || c.json({ success: false, error: 'Attendance unavailable' }, 500);
});
shiftsRouter.post('/clock-in', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const rawBody = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const hasOpeningCashSnake = Boolean(rawBody && 'opening_cash' in rawBody && rawBody.opening_cash !== undefined);
  const hasOpeningCashCamel = Boolean(rawBody && 'openingCash' in rawBody && rawBody.openingCash !== undefined);
  const hasOpeningCash = hasOpeningCashSnake || hasOpeningCashCamel;
  const rawOpeningCash = hasOpeningCashSnake ? rawBody!.opening_cash : hasOpeningCashCamel ? rawBody!.openingCash : undefined;
  if (hasOpeningCash && (typeof rawOpeningCash !== 'number' || !Number.isFinite(rawOpeningCash) || rawOpeningCash < 0)) {
    return c.json({ success: false, error: 'Invalid opening_cash' }, 400);
  }
  const openingCash: number | undefined = typeof rawOpeningCash === 'number' ? rawOpeningCash : undefined;
  const rawScheduledId = rawBody?.scheduled_shift_id ?? rawBody?.shift_id ?? rawBody?.shiftId;
  if (rawScheduledId !== undefined && rawScheduledId !== null && typeof rawScheduledId !== 'string' && typeof rawScheduledId !== 'number') {
    return c.json({ success: false, error: 'Invalid scheduled_shift_id' }, 400);
  }
  const scheduledShiftId = rawScheduledId !== undefined && rawScheduledId !== null && String(rawScheduledId).trim() !== ''
    ? String(rawScheduledId).trim()
    : undefined;
  const parsed = clockInSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const scope = await shiftScope(c.env, c.get('user'), reqTenant(c));
  return c.json({ success: true, data: shiftDto(await clockIn(scope, parsed.data.staff_id, parsed.data.notes, scheduledShiftId, openingCash)) }, 201);
});
shiftsRouter.post('/clock-out', async (c) => {
  const rawBody = await c.req.json().catch(() => null);
  const rawNotes = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>).notes : undefined;
  if (rawNotes !== undefined && (typeof rawNotes !== 'string' || rawNotes.length > 500)) {
    return c.json({ success: false, error: 'Invalid notes' }, 400);
  }
  const rawAttendanceId = rawBody && typeof rawBody === 'object'
    ? ((rawBody as Record<string, unknown>).shift_id ?? (rawBody as Record<string, unknown>).attendance_id)
    : undefined;
  if (rawAttendanceId !== undefined && rawAttendanceId !== null && typeof rawAttendanceId !== 'string' && typeof rawAttendanceId !== 'number') {
    return c.json({ success: false, error: 'Invalid shift_id' }, 400);
  }
  const parsed = clockOutSchema.safeParse(rawBody);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const attendanceId = rawAttendanceId !== undefined && rawAttendanceId !== null && String(rawAttendanceId).trim() !== ''
    ? String(rawAttendanceId).trim()
    : undefined;
  const scope = await shiftScope(c.env, c.get('user'), reqTenant(c));
  const row = attendanceId
    ? await clockOut(scope, parsed.data.staff_id, attendanceId, rawNotes)
    : await clockOut(scope, parsed.data.staff_id, undefined, rawNotes);
  return c.json({ success: true, data: shiftDto(row) });
});
shiftsRouter.get('/today', async (c) => {
  const scope = await shiftScope(c.env, c.get('user'), reqTenant(c));
  const [{ rows }, suggestion] = await Promise.all([
    listShifts(scope, { today: true }),
    getSuggestedOpeningCash(scope),
  ]);
  return c.json({ success: true, data: rows.map(shiftDto), meta: suggestion });
});
shiftsRouter.get('/', async (c) => {
  const scope = await shiftScope(c.env, c.get('user'), reqTenant(c));
  const rawLimit = c.req.query('limit');
  const rawPage = c.req.query('page');
  const parsedLimit = rawLimit !== undefined && rawLimit !== '' ? Number(rawLimit) : undefined;
  const parsedPage = rawPage !== undefined && rawPage !== '' ? Number(rawPage) : undefined;
  if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
    return c.json({ success: false, error: 'Invalid limit parameter' }, 400);
  }
  if (parsedPage !== undefined && (!Number.isInteger(parsedPage) || parsedPage < 1)) {
    return c.json({ success: false, error: 'Invalid page parameter' }, 400);
  }
  const rawStatus = c.req.query('status')?.trim();
  if (rawStatus && !['scheduled', 'active', 'in_progress', 'completed', 'cancelled'].includes(rawStatus)) {
    return c.json({ success: false, error: 'Invalid status parameter' }, 400);
  }
  const rawOrder = c.req.query('order')?.trim().toLowerCase();
  if (rawOrder && rawOrder !== 'asc' && rawOrder !== 'desc') {
    return c.json({ success: false, error: 'Invalid order parameter' }, 400);
  }
  const { rows, meta } = await listShifts(scope, {
    from: c.req.query('from'),
    to: c.req.query('to'),
    staffId: c.req.query('staff_id') || c.req.query('staffId'),
    status: rawStatus,
    limit: parsedLimit,
    page: parsedPage,
    sort: c.req.query('sort'),
    order: rawOrder,
  });
  return c.json({ success: true, data: rows.map(shiftDto), meta });
});
