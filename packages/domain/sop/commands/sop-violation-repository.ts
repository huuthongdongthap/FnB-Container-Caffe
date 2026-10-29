/**
 * Write side of the violation ladder — record, confirm, apply, appeal, close.
 *
 * Every transition is authorised by `violation-policy` before any statement is
 * prepared. The policy owns the authority matrix (manager confirms, owner
 * terminates, the employee appeals); this file only persists what the policy
 * already approved, so a future route cannot bypass the ladder by hand-writing
 * an UPDATE.
 */

import type {
  SopDisciplineStep,
  SopViolation,
  SopViolationCategory,
} from '../model/sop-types';
import type { SopViolationRow } from '../src/model/sop-row-mapper';
import { toViolation } from '../src/model/sop-row-mapper';
import { isSeriousCategory, nextDisciplineStep } from '../src/policies/violation-policy';
import { countConfirmedInMonth } from './sop-violation-reads';
import { assertViolationRole, sopDatabase, sopViolationColumns } from './sop-violation-columns';
import { SopAccessError, type SopScope } from './sop-access';

/** Fresh local id: a violation is created before any downstream reference to it. */
function newId(): string {
  return `viol_${crypto.randomUUID()}`;
}

/** Reads one violation, tenant-scoped — an unknown id and a foreign id look identical. */
export async function findViolation(scope: SopScope, violationId: string): Promise<SopViolation | null> {
  const row = await sopDatabase(scope)
    .prepare(`SELECT ${sopViolationColumns('')} FROM sop_violations WHERE tenant_id = ? AND id = ?`)
    .bind(scope.tenantId, violationId)
    .first<SopViolationRow>();
  return row ? toViolation(row) : null;
}

export interface RecordViolationInput {
  staffId: string;
  category: SopViolationCategory;
  note: string;
  occurredAt?: string;
}

/**
 * Records a breach and resolves its ladder step from prior confirmed offences.
 *
 * Seriousness is derived from the category, not accepted from the caller: the
 * groups SOP 09 §2 marks as dismissible skip the ladder whatever the recorder
 * wanted, so there is no input here a caller could use to file a dismissal as a
 * lateness. The step is computed server-side for the same reason.
 */
export async function recordViolation(
  scope: SopScope,
  input: RecordViolationInput
): Promise<SopViolation> {
  assertViolationRole(scope);
  const staffId = String(input.staffId ?? '').trim();
  if (!staffId) throw new SopAccessError('A staff member is required', 400);
  const note = String(input.note ?? '').trim();
  if (note.length === 0) throw new SopAccessError('A description is required', 400);

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const month = occurredAt.slice(0, 7);
  const isSerious = isSeriousCategory(input.category);
  const priorCount = await countConfirmedInMonth(scope, staffId, month);
  const step: SopDisciplineStep = nextDisciplineStep({
    priorCountInMonth: priorCount,
    isSerious,
  });

  const id = newId();
  const now = new Date().toISOString();
  await sopDatabase(scope)
    .prepare(
      `INSERT INTO sop_violations (id, tenant_id, staff_id, category, is_serious, description,
         occurred_at, recorded_by, status, discipline_step, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?)`
    )
    .bind(
      id,
      scope.tenantId,
      staffId,
      input.category,
      isSerious ? 1 : 0,
      note,
      occurredAt,
      scope.actorId,
      step,
      now,
      now
    )
    .run();

  const created = await findViolation(scope, id);
  if (!created) throw new SopAccessError('Violation could not be read back', 409);
  return created;
}
