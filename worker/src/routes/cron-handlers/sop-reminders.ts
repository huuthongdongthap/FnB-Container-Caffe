/**
 * SOP recurring-duty reminders.
 *
 * Runs every 5 minutes via scheduled.ts and writes an obligation per duty per
 * day into `sop_reminders`. It does NOT push: the delivery surface in this repo
 * is gated because `push_subscriptions` has no `tenant_id`, so a role-wide send
 * reaches the managers of every store (verified at worker/schema.sql:742). The
 * ledger is the durable part — who reads it is a later concern.
 *
 * Three rules, all keyed on the store's calendar rather than the runtime's:
 * 1. UPCOMING — three days ahead of a monthly duty, so it is not a surprise.
 * 2. DUE_NO_RUN — the duty's own day, from 08:00, when nobody has started it.
 * 3. OVERDUE — an in-progress run past its window for that shift type.
 */
import { createLogger } from '../../middleware/logger';
import { isDeepCleanDay, isAuditDay, nextDeepClean, nextAudit, isOverdue } from '@aura/domain-sop';

const log = createLogger({ route: 'cron' });

export interface SopReminderResult {
  tenantId: string;
  remindersCreated: number;
  errors: string[];
}

/** An open row, the only ones that can be overdue. */
interface RunRow {
  id: string;
  template_id: string;
  shift_type: string;
  started_at: string;
  staff_id: string;
  staff_name: string | null;
}

/**
 * A duty a reminder can be about. Only the template is needed to identify it:
 * the shift type belongs to a run, and upcoming/due_no_run exist precisely
 * because there is no run yet.
 */
interface ReminderDuty {
  templateId: string;
}

/**
 * Main entry point called from scheduled.ts.
 *
 * `now` is a parameter rather than read from the clock so the four rules can be
 * exercised at the one moment that separates them — the day the duty falls, the
 * three days before it, and the hour the reminder starts.
 */
export async function runSopReminders(
  env: Record<string, unknown>,
  now: Date = new Date()
): Promise<SopReminderResult[]> {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
  const results: SopReminderResult[] = [];

  // Every tenant with an active template, because a store that has not run a
  // single checklist still has duties to be reminded about.
  //
  // A failure here is not recoverable per-tenant: without the list there is
  // nothing to fall back to, and this task runs inside a shared cron tick where
  // an unhandled rejection would take the other scheduled work down with it. So
  // it is swallowed and the next pass simply runs empty.
  let tenants: { tenant_id: string }[] = [];
  try {
    const discovered = await db.prepare(`
      SELECT DISTINCT tenant_id FROM sop_templates WHERE is_active = 1
    `).all<{ tenant_id: string }>();
    tenants = discovered.results ?? [];
  } catch (err) {
    log.error('sop-reminders discovery failed', { message: (err as Error).message });
    return results;
  }

  for (const { tenant_id } of tenants) {
    const result = await processTenantReminders(db, tenant_id, now);
    results.push(result);
  }

  return results;
}

async function processTenantReminders(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  now: Date
): Promise<SopReminderResult> {
  const errors: string[] = [];
  let remindersCreated = 0;
  const todayStr = dayKey(now);
  const currentHour = now.getHours();

  try {
    // Active templates for this tenant (we need deep-clean and audit template IDs)
    const { results: templates } = await db.prepare(`
      SELECT id, code FROM sop_templates
      WHERE tenant_id = ? AND is_active = 1
    `).bind(tenantId).all<{ id: string; code: string }>();

    const toDuty = (template: { id: string } | undefined): ReminderDuty | undefined =>
      template ? { templateId: template.id } : undefined;
    const deepCleanTpl = toDuty(templates.find((t) => t.code === 'deep-clean-m15'));
    const auditTpl = toDuty(templates.find((t) => t.code === 'inventory-audit-m30'));

    // ---------- RULE 1: UPCOMING (3 days before deep-clean / audit) ----------
    remindersCreated += await processUpcomingReminders(db, tenantId, now, deepCleanTpl, auditTpl);

    // ---------- RULE 2: DUE_NO_RUN (on the day, from 08:00, no run for template) ----------
    if (currentHour >= 8) {
      remindersCreated += await processDueNoRunReminders(db, tenantId, now, todayStr, deepCleanTpl, auditTpl);
    }

    // ---------- RULE 3: OVERDUE (in_progress run past isOverdue window) ----------
    remindersCreated += await processOverdueReminders(db, tenantId, now);

  } catch (err) {
    errors.push((err as Error).message);
    log.error('sop-reminders tenant error', { tenantId, message: (err as Error).message });
  }

  return { tenantId, remindersCreated, errors };
}

/**
 * The calendar day a reminder is about, as YYYY-MM-DD. Local, not UTC: the
 * duty belongs to the store's day, so a run opened just after midnight is
 * still yesterday's work — the same reason `scheduled_date` is captured at
 * start rather than derived from a timestamp.
 */
function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * RULE 1: UPCOMING
 * Fire once per duty in the 3-day window before its day.
 * day_key = the duty's day (YYYY-MM-DD).
 * kind = 'upcoming'.
 * No run exists yet, so run_id is NULL.
 */
async function processUpcomingReminders(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  now: Date,
  deepCleanTpl: ReminderDuty | undefined,
  auditTpl: ReminderDuty | undefined
): Promise<number> {
  let created = 0;

  // Deep-clean upcoming (3 days before the 15th)
  if (deepCleanTpl) {
    const nextDc = nextDeepClean(now);
    if (withinDays(now, nextDc, 3)) {
      const inserted = await tryInsertReminder(db, tenantId, deepCleanTpl, 'upcoming', nextDc, null, null, null, now);
      if (inserted) created++;
    }
  }

  // Audit upcoming (3 days before the 30th/last-day)
  if (auditTpl) {
    const nextAuditDate = nextAudit(now);
    if (withinDays(now, nextAuditDate, 3)) {
      const inserted = await tryInsertReminder(db, tenantId, auditTpl, 'upcoming', nextAuditDate, null, null, null, now);
      if (inserted) created++;
    }
  }

  return created;
}

/**
 * RULE 2: DUE_NO_RUN
 * On the duty's actual day (15th or 30th/last-day), from 08:00 onwards,
 * if no in_progress/completed run exists for that template on that day,
 * raise a reminder.
 * day_key = today (YYYY-MM-DD).
 * kind = 'due_no_run'.
 * run_id is NULL because no run exists.
 */
async function processDueNoRunReminders(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  now: Date,
  todayStr: string,
  deepCleanTpl: ReminderDuty | undefined,
  auditTpl: ReminderDuty | undefined
): Promise<number> {
  let created = 0;
  const isDcDay = isDeepCleanDay(now);
  const isAudit = isAuditDay(now);

  // Deep-clean due today, no run started
  if (isDcDay && deepCleanTpl) {
    const started = await hasRunForDay(db, tenantId, deepCleanTpl.templateId, todayStr);
    if (!started) {
      const inserted = await tryInsertReminder(db, tenantId, deepCleanTpl, 'due_no_run', now, null, null, null, now);
      if (inserted) created++;
    }
  }

  // Audit due today, no run started
  if (isAudit && auditTpl) {
    const started = await hasRunForDay(db, tenantId, auditTpl.templateId, todayStr);
    if (!started) {
      const inserted = await tryInsertReminder(db, tenantId, auditTpl, 'due_no_run', now, null, null, null, now);
      if (inserted) created++;
    }
  }

  return created;
}

/**
 * A run that has begun or finished. `abandoned` counts as started: the duty was
 * known about and someone chose to drop it, which is a different fact from
 * nobody having looked at it, and the reminder is about the latter.
 */
async function hasRunForDay(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  templateId: string,
  dayKey: string
): Promise<boolean> {
  const { results } = await db.prepare(`
    SELECT 1 FROM sop_runs
    WHERE tenant_id = ? AND template_id = ? AND scheduled_date = ?
      AND status IN ('in_progress', 'completed', 'abandoned')
    LIMIT 1
  `).bind(tenantId, templateId, dayKey).all<{ 1: number }>();
  return results.length > 0;
}

/**
 * RULE 3: OVERDUE
 * For every in_progress run, if its elapsed time exceeds the shift's
 * isOverdue() window, raise an overdue reminder.
 * day_key = today (YYYY-MM-DD).
 * kind = 'overdue'.
 * run_id = the overrun run's id.
 */
async function processOverdueReminders(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  now: Date
): Promise<number> {
  let created = 0;

  const { results: runs } = await db.prepare(`
    SELECT id, template_id, shift_type, started_at, staff_id, staff_name
    FROM sop_runs
    WHERE tenant_id = ? AND status = 'in_progress'
  `).bind(tenantId).all<RunRow>();

  for (const run of runs) {
    const shiftType = run.shift_type as 'a' | 'b' | 'c';
    if (isOverdue(run.started_at, shiftType, now)) {
      const duty: ReminderDuty = { templateId: run.template_id };
      const inserted = await tryInsertReminder(
        db, tenantId, duty, 'overdue', now, run.id, run.staff_id, run.staff_name, now
      );
      if (inserted) created++;
    }
  }

  return created;
}

/**
 * Try to insert a reminder row. The unique index makes this idempotent — a
 * second attempt for the same duty on the same day writes nothing, so the
 * five-minute cadence cannot pile up duplicate notices. Returns true only when
 * a row was actually inserted.
 */
async function tryInsertReminder(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  duty: ReminderDuty,
  kind: SopReminderKind,
  day: Date,
  runId: string | null,
  staffId: string | null,
  staffName: string | null,
  now: Date
): Promise<boolean> {
  const sentAt = now.toISOString();
  const result = await db.prepare(`
    INSERT OR IGNORE INTO sop_reminders
      (id, tenant_id, template_id, kind, day_key, run_id, staff_id, staff_name, sent_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    tenantId,
    duty.templateId,
    kind,
    dayKey(day),
    runId,
    staffId,
    staffName,
    sentAt,
    sentAt,
    sentAt
  ).run();

  // A conflicted insert reports no changes, which is how a repeat pass tells
  // its own notice is already on the ledger.
  return result.meta.changes > 0;
}

/**
 * Whether `target` is between zero and `days` days ahead of `from`. Whole days,
 * because the reminder is about the calendar, not about hours: three days ahead
 * still lands on the same day-of-month at 00:01 as it does at 23:59.
 */
function withinDays(from: Date, target: Date, days: number): boolean {
  const diff = target.getTime() - from.getTime();
  return diff >= 0 && diff <= days * 86_400_000;
}

type SopReminderKind = 'upcoming' | 'due_no_run' | 'overdue';