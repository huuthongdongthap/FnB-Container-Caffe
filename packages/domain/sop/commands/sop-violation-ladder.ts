/**
 * The violation ladder — confirm, apply, appeal, close.
 *
 * Apart from `sop-violation-repository.ts` (which records a breach) so each
 * file stays inside the size ceiling. Every transition is authorised by
 * `violation-policy` before any statement is prepared: the policy owns the
 * authority matrix, and this file only persists what it approved, so a future
 * route cannot bypass the ladder by hand-writing an UPDATE.
 */

import type { SopDisciplineStep, SopViolation } from '../model/sop-types';
import {
  appealViolation as appealPolicy,
  canApplyAction,
  closeViolation as closePolicy,
} from '../src/policies/violation-policy';
import { SopAccessError, type SopScope } from './sop-access';
import { assertViolationRole, role, sopDatabase } from './sop-violation-columns';
import { findViolation } from './sop-violation-repository';

/**
 * Guards a transition and returns the fetched record, or the policy's refusal.
 *
 * `apply` is deliberately not routed through this: it needs the requested step
 * known before the state check runs, so it guards inline instead. See
 * `applyViolation` for why the order matters there.
 */
async function loadForAction(
  scope: SopScope,
  violationId: string,
  action: 'confirm' | 'appeal' | 'close'
): Promise<SopViolation> {
  assertViolationRole(scope);
  const violation = await findViolation(scope, violationId);
  if (!violation) throw new SopAccessError('Violation not found', 404);
  if (!canApplyAction({ action, role: role(scope), violation })) {
    throw new SopAccessError('This violation cannot take that action', 409);
  }
  return violation;
}

/** Manager confirms the recorder's account. The recorder may not confirm their own record. */
export async function confirmViolation(scope: SopScope, violationId: string): Promise<SopViolation> {
  const violation = await loadForAction(scope, violationId, 'confirm');
  if (violation.recordedBy === scope.actorId) {
    throw new SopAccessError('You may not confirm a violation you recorded', 403);
  }
  const now = new Date().toISOString();
  await sopDatabase(scope)
    .prepare(
      `UPDATE sop_violations
       SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    )
    .bind(scope.actorId, now, now, scope.tenantId, violationId)
    .run();
  const updated = await findViolation(scope, violationId);
  if (!updated) throw new SopAccessError('Violation not found', 404);
  return updated;
}

export interface ApplyViolationInput {
  /** Omitted keeps the step the recorder's ladder resolved; owner-only for termination. */
  disciplineStep?: SopDisciplineStep;
  /** The applier's own note. Never touches the recorder's description. */
  sanctionNote?: string;
}

/**
 * Applies the discipline step. Termination stays owner-only inside the policy.
 *
 * Role is checked before state on purpose. Both a wrong role and a wrong state
 * are refusals, but they ask different things of the caller: 403 says this actor
 * may never take this step (hide the control), 409 says the step is available in
 * principle but not for this record right now (refresh and look again). Collapsing
 * them into one 409 leaves the caller unable to tell an owner-only decision from a
 * stale view, which is how a manager ends up retrying a dismissal forever.
 *
 * The recorder's `description` is never written here — the applier's note goes to
 * `sanction_note`, so the account of the conduct survives to be weighed at appeal.
 */
export async function applyViolation(
  scope: SopScope,
  violationId: string,
  input: ApplyViolationInput
): Promise<SopViolation> {
  assertViolationRole(scope);
  const violation = await findViolation(scope, violationId);
  if (!violation) throw new SopAccessError('Violation not found', 404);

  const step = input.disciplineStep ?? violation.disciplineStep;
  const target = step === violation.disciplineStep ? violation : { ...violation, disciplineStep: step };

  // Who may act on this step, decided before whether the record allows it.
  if (step === 'termination' && role(scope) !== 'owner') {
    throw new SopAccessError('Only the owner may dismiss a staff member', 403);
  }
  if (violation.status !== 'confirmed') {
    throw new SopAccessError('This violation cannot take that action', 409);
  }
  if (!canApplyAction({ action: 'apply', role: role(scope), violation: target })) {
    throw new SopAccessError('This violation cannot take that action', 409);
  }

  const sanctionNote = typeof input.sanctionNote === 'string' ? input.sanctionNote.trim() : '';
  const now = new Date().toISOString();
  await sopDatabase(scope)
    .prepare(
      `UPDATE sop_violations
       SET status = 'applied', discipline_step = ?, applied_by = ?, applied_at = ?,
           sanction_note = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    )
    .bind(step, scope.actorId, now, sanctionNote.length > 0 ? sanctionNote : null, now, scope.tenantId, violationId)
    .run();
  const updated = await findViolation(scope, violationId);
  if (!updated) throw new SopAccessError('Violation not found', 404);
  return updated;
}

/** The employee's right of reply, recorded on the file for the owner to weigh. */
export async function appealViolation(
  scope: SopScope,
  violationId: string,
  explanation: string
): Promise<SopViolation> {
  const violation = await loadForAction(scope, violationId, 'appeal');
  return persistAppeal(scope, violation, explanation);
}

/**
 * The employee's own reply — the right SOP 09 §5 grants before a sanction lands.
 *
 * Deliberately outside the manager-only gates: `appealViolation` above carries
 * the whole ladder's role check, and reusing it here would delete the very right
 * this function exists to exercise — a staff member could never reach the appeal
 * that is theirs by name. What stands in place of a role check is narrower and
 * stronger: the record must belong to the actor. Nobody may appeal on another
 * person's behalf, but a staff member may always answer for themselves.
 *
 * The policy and the persistence are shared with the manager path, so the two
 * cannot drift into writing different appeal states.
 */
export async function appealOwnViolation(
  scope: SopScope,
  violationId: string,
  explanation: string
): Promise<SopViolation> {
  const violation = await findViolation(scope, violationId);
  if (!violation) throw new SopAccessError('Violation not found', 404);
  if (violation.staffId !== scope.actorId) {
    throw new SopAccessError('You may only appeal your own record', 403);
  }
  return persistAppeal(scope, violation, explanation);
}

/** Validates the explanation and writes the `appealed` state, whichever door it came through. */
async function persistAppeal(
  scope: SopScope,
  violation: SopViolation,
  explanation: string
): Promise<SopViolation> {
  const result = appealPolicy(violation, explanation);
  if (!result.ok) throw new SopAccessError(result.error, 400);

  await sopDatabase(scope)
    .prepare(
      `UPDATE sop_violations SET status = 'appealed', appeal_explanation = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    )
    .bind(result.data.appealExplanation, new Date().toISOString(), scope.tenantId, violation.id)
    .run();
  const updated = await findViolation(scope, violation.id);
  if (!updated) throw new SopAccessError('Violation not found', 404);
  return updated;
}

/** Terminal. A closed violation is never deleted — it is compliance evidence. */
export async function closeViolation(scope: SopScope, violationId: string): Promise<SopViolation> {
  const violation = await loadForAction(scope, violationId, 'close');
  const result = closePolicy(violation, role(scope), new Date().toISOString());
  if (!result.ok) throw new SopAccessError(result.error, 409);

  await sopDatabase(scope)
    .prepare(
      `UPDATE sop_violations SET status = 'closed', closed_at = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    )
    .bind(result.data.closedAt, new Date().toISOString(), scope.tenantId, violationId)
    .run();
  const updated = await findViolation(scope, violationId);
  if (!updated) throw new SopAccessError('Violation not found', 404);
  return updated;
}
