/**
 * Write side of the SOP repository — starting a run. The tick, complete and
 * abandon mutations live in `sop-run-mutations.ts`.
 *
 * Two invariants are enforced here rather than in the handlers, because a
 * handler that forgets them is a silent compliance hole:
 *   1. the tenant comes from the scope, never from the payload;
 *   2. `checked_by` comes from the authenticated session, never from a body.
 *
 * Every write is a single prepared statement so a partially applied run cannot
 * exist: D1 has no partial transaction per statement, and an audit record that
 * is half written is worse than one that failed.
 */

import {
  startRun,
  type StartRunInput,
  type SopRun,
  type SopRunItem,
  type SopTemplate,
} from '../index';
import { assertId, businessDate, SopAccessError, type SopScope } from './sop-access';
import { findTemplate } from './sop-template-reads';
import { sopDatabase } from './sop-violation-columns';
import { runItemId, nowIso, mapPolicyError } from './sop-write-support';

/**
 * Ids are prefixed strings; a run id alone is not enough to find its rows safely.
 *
 * `shiftId` is a caller's own shift, resolved from the session and never from a
 * request body: a payload that names someone else's shift would attach one
 * member's attendance record to another member's compliance evidence.
 */
export interface StartRunRequest {
  templateId: string;
  shiftId?: string | null;
}

/**
 * Starts a run, snapshotting the template version and writing one unchecked
 * row per item. The insert of run and items is one batch so a crash between
 * them cannot leave a run with missing rows.
 */
export async function startRunForStaff(
  scope: SopScope,
  request: StartRunRequest
): Promise<{ run: SopRun; template: SopTemplate }> {
  const templateId = assertId(request.templateId, 'templateId');
  const template = await findTemplate(scope, templateId);
  if (!template) throw new SopAccessError('Template not found', 404);
  if (template.isActive !== 1 || template.items.length === 0) {
    throw new SopAccessError('Template is not executable', 409);
  }

  const scheduledDate = shiftDate(scope);

  const built = startRun({
    runId: `run_${crypto.randomUUID()}`,
    tenantId: scope.tenantId,
    template,
    templateVersion: template.version,
    staffId: scope.actorId,
    shiftId: request.shiftId ?? null,
    scheduledDate,
    now: nowIso(),
  } satisfies StartRunInput);
  if (!built.ok) throw new SopAccessError(mapPolicyError(built.error), 409);

  const run = built.data;
  const items: SopRunItem[] = run.items.map((row) => ({
    ...row,
    id: runItemId(run.id, row.templateItemId),
  }));

  await sopDatabase(scope).batch([
    sopDatabase(scope)
      .prepare(
        `INSERT INTO sop_runs
          (id, tenant_id, template_id, template_version, shift_id, staff_id, staff_name,
           shift_type, status, scheduled_date, started_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?)`
      )
      .bind(
        run.id,
        run.tenantId,
        run.templateId,
        run.templateVersion,
        run.shiftId,
        run.staffId,
        null,
        template.shiftType,
        scheduledDate,
        run.startedAt,
        run.startedAt,
        run.startedAt
      ),
    ...items.map((row) =>
      sopDatabase(scope)
        .prepare(
          `INSERT INTO sop_run_items
            (id, tenant_id, run_id, template_item_id, is_checked, checked_at, checked_by,
             note, value, created_at)
           VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)`
        )
        .bind(row.id, scope.tenantId, run.id, row.templateItemId, run.startedAt)
    ),
  ]);

  return { run: { ...run, items }, template };
}

/**
 * The calendar day the run belongs to, used as its scheduled_date. A store can
 * pin the business date through the environment for the night shift that runs
 * past midnight; otherwise it is the calendar day in store time.
 */
function shiftDate(scope: SopScope): string {
  const configured = (scope.env as unknown as { SOP_BUSINESS_DATE?: string }).SOP_BUSINESS_DATE?.trim();
  return configured && configured.length > 0 ? configured : businessDate();
}

/**
 * Ticks or unticks one item. The actor is always the session's staff id: a body
 * that supplies `checked_by` would let one staff member sign another's work.
 */
