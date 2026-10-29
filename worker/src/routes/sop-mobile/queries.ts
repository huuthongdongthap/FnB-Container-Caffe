/**
 * Read handlers for `/api/sop` — the checklist an operator sees on their phone.
 *
 * Every handler takes its tenant and actor from the session via `sopScope`.
 * Nothing here accepts a tenant id or a staff id from the query string: a caller
 * that could name another staff member would read another store's compliance
 * evidence.
 */

import { errorResponse, jsonResponse } from '../../middleware/cors';
import {
  businessDate,
  deriveShiftType,
  findOpenShift,
  findRun,
  findViolation,
  listRunsForStaffDay,
  listTemplates,
  sopForShift,
  sopScope,
  storeHour,
  SOP_ROLES,
} from '@aura/domain-sop';
import type { Context } from 'hono';
import type { Env } from '../../types/env';

/**
 * GET /api/sop/templates
 * Active templates the caller may run, in declared shift order.
 */
export async function getSopTemplates(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const templates = await listTemplates(scope);
    return jsonResponse({ success: true, templates, data: { items: templates } });
  } catch (err) {
    return sopError(c, err);
  }
}

/**
 * GET /api/sop/runs/today
 * The checklist to run now plus everything already started today, so the app
 * resumes an open run instead of starting a duplicate.
 */
export async function getSopRunsToday(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const now = new Date();
    const templates = await listTemplates(scope);
    const runs = await listRunsForStaffDay(scope, scope.actorId, businessDate(now));

    // The caller's own open shift, resolved server-side. Its clock-in is the
    // authority on which shift this is: a member who clocks in at 07:00 is on
    // Ca A even if the clock later reads into another window.
    const openShift = await findOpenShift(scope);

    // The store's hour, not the runtime's: a Worker runs UTC and would read a
    // 07:00 opening shift as the small hours of Ca C. Before a clock-in there is
    // no shift to read, so the hour has to come from the store's clock.
    const shiftHour = openShift ? storeHour(new Date(openShift.clockIn)) : storeHour(now);
    const match = sopForShift({
      templates,
      shiftType: deriveShiftType(shiftHour),
      role: scope.actorRole,
      date: now,
    });

    // A monthly duty (deep clean, stocktake) is whole-store and does not depend
    // on being clocked in; a shift-bound checklist does, because there is no
    // shift to record it against.
    const needsShift = match.reason === 'shift_template' || match.reason === 'none_applicable';
    const suppressed = !openShift && needsShift;

    return jsonResponse({
      success: true,
      suggested: suppressed ? null : match.template,
      reason: suppressed ? 'not_clocked_in' : match.reason,
      shift: openShift
        ? { id: openShift.id, clockIn: openShift.clockIn, shiftType: deriveShiftType(shiftHour) }
        : null,
      runs,
      data: { items: runs },
    });
  } catch (err) {
    return sopError(c, err);
  }
}

/**
 * GET /api/sop/runs/:id
 * One run with its items and the rules it is judged against.
 */
export async function getSopRunDetail(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const runId = c.req.param('id') ?? '';
    const run = await findRun(scope, runId);
    if (!run) return errorResponse('Checklist not found', 404);

    // Another member's open run belongs to them: only a manager may read it.
    if (run.staffId !== scope.actorId && !scope.canManage) {
      return errorResponse('You may only work on your own checklist', 403);
    }

    return jsonResponse({ success: true, run, data: { item: run } });
  } catch (err) {
    return sopError(c, err);
  }
}

/**
 * GET /api/sop/violations/:id
 * One conduct file — the actor's own, so they can read what they are answering.
 *
 * There is deliberately no list route: a staff member can see a record they were
 * sent to by id, not browse other people's discipline files. The ownership check
 * is the whole gate, so it runs before anything is returned.
 */
export async function getMyViolation(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const violationId = c.req.param('id') ?? '';
    const violation = await findViolation(scope, violationId);
    if (!violation) return errorResponse('Violation not found', 404);

    // An unknown id and someone else's file are both refused here: telling them
    // apart would confirm that the id exists.
    if (violation.staffId !== scope.actorId) {
      return errorResponse('You may only view your own record', 403);
    }

    return jsonResponse({ success: true, violation, data: { item: violation } });
  } catch (err) {
    return sopError(c, err);
  }
}

/** Shared error mapping so a policy rejection and a missing binding read alike. */
function sopError(c: Context<{ Bindings: Env }>, err: unknown) {
  const status = typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status: unknown }).status)
    : 500;
  const message = err instanceof Error ? err.message : 'Checklist action rejected';
  return errorResponse(message, (status >= 400 && status <= 599 ? status : 500) as 400 | 401 | 403 | 404 | 409 | 503);
}
