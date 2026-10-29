/**
 * Write handlers for `/api/sop` — start a checklist, tick an item, close it out.
 *
 * The actor comes from the session, never from a body: `sopScope` is built from
 * `c.get('user')` and every write path passes `scope.actorId` as the staff
 * member, so a request that supplies `checkedBy` or `staffId` is ignored rather
 * than trusted. Each successful write is mirrored into `audit_logs`, because a
 * completed checklist is the compliance evidence this feature exists to produce.
 */

import { errorResponse, jsonResponse } from '../../middleware/cors';
import { auditActor, auditSopAction } from '../openapi-sop-handlers/sop-audit';
import {
  abandonRunForStaff,
  appealOwnViolation,
  completeRunForStaff,
  linkRunToOpenShift,
  setItemChecked,
  sopScope,
  startRunForStaff,
} from '@aura/domain-sop';
import type { Context } from 'hono';
import type { Env } from '../../types/env';

/**
 * POST /api/sop/runs
 * Starts a run, snapshotting the template version it began against.
 *
 * The shift is not taken from the body: `findOpenShift` below resolves the run's
 * own clocked-in shift from the session, so a request naming someone else's
 * shift id attaches the checklist to a shift that is not theirs.
 */
export async function postStartSopRun(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const body = await c.req.json().catch(() => ({}));
    const templateId = readString(body, 'templateId');
    if (!templateId) return errorResponse('templateId is required', 400);

    const { run, template } = await startRunForStaff(scope, { templateId });
    // The shift is the caller's own open one, so it is resolved after the run
    // exists rather than accepted from the body. The link is best-effort: the
    // run is already valid without it, and failing the request here would lose
    // the checklist the member just started.
    const shiftId = await linkRunToOpenShift(scope, run.id) ?? run.shiftId;
    await auditSopAction({
      db: c.env.AURA_DB,
      actor: auditActor(c),
      action: 'sop_run.started',
      resourceId: run.id,
      metadata: {
        templateId: run.templateId,
        templateVersion: run.templateVersion,
        shiftType: template.shiftType,
        ...(shiftId ? { shiftId } : {}),
      },
    });
    return jsonResponse({
      success: true,
      run: shiftId ? { ...run, shiftId } : run,
      template,
      data: { item: shiftId ? { ...run, shiftId } : run },
    });
    return jsonResponse({ success: true, run, template, data: { item: run } });
  } catch (err) {
    return sopError(err);
  }
}

/**
 * POST /api/sop/runs/:id/items/:itemId
 * Ticks or unticks one item, recording its measurement or note if required.
 */
export async function postCheckSopItem(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const runId = c.req.param('id') ?? '';
    const itemId = c.req.param('itemId') ?? '';
    const body = await c.req.json().catch(() => ({}));
    const isChecked = readBoolean(body, 'isChecked');

    const run = await setItemChecked(scope, runId, itemId, {
      isChecked,
      note: readOptionalString(body, 'note'),
      value: readOptionalNumber(body, 'value'),
    });
    await auditSopAction({
      db: c.env.AURA_DB,
      actor: auditActor(c),
      action: 'sop_run.item_checked',
      resourceId: runId,
      metadata: { templateItemId: itemId, isChecked },
    });
    return jsonResponse({ success: true, run, data: { item: run } });
  } catch (err) {
    return sopError(err);
  }
}

/** POST /api/sop/runs/:id/complete — blocked while a critical item is unticked. */
export async function postCompleteSopRun(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const run = await completeRunForStaff(scope, c.req.param('id') ?? '');
    await auditSopAction({
      db: c.env.AURA_DB,
      actor: auditActor(c),
      action: 'sop_run.completed',
      resourceId: run.id,
      metadata: { templateId: run.templateId, templateVersion: run.templateVersion },
    });
    return jsonResponse({ success: true, run, data: { item: run } });
  } catch (err) {
    return sopError(err);
  }
}

/** POST /api/sop/runs/:id/abandon — a reason is required, for the audit trail. */
export async function postAbandonSopRun(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const body = await c.req.json().catch(() => ({}));
    const reason = readString(body, 'reason');
    if (!reason) return errorResponse('A reason is required to abandon a checklist', 400);

    const run = await abandonRunForStaff(scope, c.req.param('id') ?? '', { reason });
    await auditSopAction({
      db: c.env.AURA_DB,
      actor: auditActor(c),
      action: 'sop_run.abandoned',
      resourceId: run.id,
      metadata: { reason },
    });
    return jsonResponse({ success: true, run, data: { item: run } });
  } catch (err) {
    return sopError(err);
  }
}

/**
 * POST /api/sop/violations/:id/appeal
 * The employee's own right of reply, recorded before the file is closed.
 *
 * Deliberately its own function rather than the admin `appealViolation`: that
 * one carries the manager-only role gate, which would delete the very right this
 * exercises. `appealOwnViolation` checks that the record belongs to the actor
 * instead, so a staff member may answer for themselves and nobody may answer on
 * someone else's behalf.
 */
export async function postAppealMyViolation(c: Context<{ Bindings: Env }>) {
  try {
    const scope = sopScope(c.env, c.get('user'));
    const violationId = c.req.param('id') ?? '';
    const body = await c.req.json().catch(() => ({}));
    const explanation = readOptionalString(body, 'appealExplanation');
    if (typeof explanation !== 'string' || explanation.trim().length === 0) {
      return errorResponse('An explanation is required to appeal', 400);
    }

    const violation = await appealOwnViolation(scope, violationId, explanation.trim());
    await auditSopAction({
      db: c.env.AURA_DB,
      actor: auditActor(c),
      action: 'sop_violation.appealed',
      resourceId: violation.id,
      // Only the fact of the appeal, never its text: the explanation is the
      // staff member's own words and belongs to the violation row, not the log.
      metadata: { staffId: violation.staffId },
    });
    return jsonResponse({ success: true, data: violation });
  } catch (err) {
    return sopError(err);
  }
}

/**
 * Maps a domain failure onto the status it already carries. `SopAccessError`
 * holds the right HTTP status, so the handler does not re-decide policy.
 */
function sopError(err: unknown) {
  const status = typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status: unknown }).status)
    : 500;
  const message = err instanceof Error ? err.message : 'Checklist action rejected';
  return errorResponse(message, (status >= 400 && status <= 599 ? status : 500) as 400 | 401 | 403 | 404 | 409 | 503);
}

// The body is unvalidated JSON, so each reader narrows explicitly rather than
// trusting a `as` cast that would let a string reach a numeric column.
function readString(body: unknown, key: string): string {
  const value = (body as Record<string, unknown> | null)?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalString(body: unknown, key: string): string | null | undefined {
  const value = (body as Record<string, unknown> | null)?.[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' ? value : null;
}

function readBoolean(body: unknown, key: string): boolean {
  return (body as Record<string, unknown> | null)?.[key] === true;
}

function readOptionalNumber(body: unknown, key: string): number | null | undefined {
  const value = (body as Record<string, unknown> | null)?.[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
