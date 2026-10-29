/**
 * The caller's own open shift, read from `staff_shifts` (the attendance table).
 *
 * The open-shift predicate is `clock_in IS NOT NULL AND clock_out IS NULL` —
 * the same predicate `domain/shift` uses for attendance, kept as one constant so
 * a change to what "open" means cannot apply to one feature and not the other.
 *
 * Two boundaries hold here:
 *   - the tenant and the member both come from the SOP scope, which is built
 *     from the session. Nothing here accepts an id from a caller, so a request
 *     naming another member's shift reads nothing;
 *   - `staff_shifts.id` is INTEGER while `sop_runs.shift_id` is TEXT. The
 *     coercion happens on the way out of this module and nowhere else, so the
 *     rest of the feature deals in the string ids it already uses.
 */

import { sopDatabase } from './sop-violation-columns';
import { type SopScope } from './sop-access';

/** Mirrors `ACTIVE_ATTENDANCE_SQL` in packages/domain/shift/commands/shift-repository. */
const OPEN_SHIFT_SQL = 'clock_in IS NOT NULL AND clock_out IS NULL';

/** The shift a checklist is being recorded against. */
export interface OpenShift {
  /** String form of `staff_shifts.id`, matching `sop_runs.shift_id`. */
  id: string;
  /** ISO timestamp of the clock-in that opened this shift. */
  clockIn: string;
  /** The attendance row's own label ('attendance', 'scheduled', …). */
  shift: string;
}

/** The shift a checklist is being recorded against. */
export interface OpenShift {
  /** String form of `staff_shifts.id`, matching `sop_runs.shift_id`. */
  id: string;
  /** ISO timestamp of the clock-in that opened this shift. */
  clockIn: string;
  /** The attendance row's own label ('attendance', 'scheduled', …). */
  shift: string;
}

/** What was linked, so a caller cannot claim a write that the guard refused. */
export interface SopRunShift {
  runId: string;
  shiftId: string;
}

/**
 * The caller's currently open shift, or null when they have not clocked in.
 *
 * `sopScope` supplies the tenant from the session, so this cannot read another
 * store's attendance even if the caller names an id that exists there.
 */
export async function findOpenShift(scope: SopScope): Promise<OpenShift | null> {
  const row = await sopDatabase(scope)
    .prepare(
      `SELECT id, clock_in, shift FROM staff_shifts
       WHERE tenant_id = ? AND staff_id = ? AND ${OPEN_SHIFT_SQL}
       ORDER BY clock_in DESC LIMIT 1`
    )
    .bind(scope.tenantId, scope.actorId)
    .first<{ id: number; clock_in: string; shift: string }>();

  if (!row || !row.clock_in) return null;
  return { id: String(row.id), clockIn: row.clock_in, shift: row.shift };
}

/**
 * Records the open shift against a run that does not yet have one.
 *
 * The `shift_id IS NULL` guard is the point: a run that already carries a shift
 * keeps it, so re-running this never moves compliance evidence from one member's
 * attendance record to another's.
 */
export async function linkOpenShift(scope: SopScope, runId: string, shiftId: string): Promise<SopRunShift | null> {
  const updated = await sopDatabase(scope)
    .prepare('UPDATE sop_runs SET shift_id = ? WHERE id = ? AND tenant_id = ? AND shift_id IS NULL')
    .bind(shiftId, runId, scope.tenantId)
    .run();
  return updated.meta.changes ? { runId, shiftId } : null;
}

/**
 * Resolves the caller's open shift and attaches it to a run that has none.
 *
 * Best-effort by design: a failure to read or write the shift returns null and
 * leaves the run as it was. The run is valid without a shift — a checklist
 * closed out while attendance is briefly unavailable still has to land — so a
 * read failure here must not discard work the member already did.
 */
export async function linkRunToOpenShift(scope: SopScope, runId: string): Promise<string | null> {
  try {
    const openShift = await findOpenShift(scope);
    if (!openShift) return null;
    const linked = await linkOpenShift(scope, runId, openShift.id);
    return linked?.shiftId ?? null;
  } catch {
    return null;
  }
}
