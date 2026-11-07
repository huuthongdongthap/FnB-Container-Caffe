/**
 * SOP recurring-duty reminders (runs every 5 minutes via scheduled.ts).
 * Three rules keyed on the store's calendar:
 * 1. UPCOMING — three days ahead of a monthly duty.
 * 2. DUE_NO_RUN — the duty's own day, from 08:00, when nobody has started it.
 * 3. OVERDUE — an in-progress run past its window for that shift type.
 */
import { createLogger } from '../../middleware/logger';
import { businessDate, isDeepCleanDay, isAuditDay, nextDeepClean, nextAudit, isOverdue } from '@aura/domain-sop';

const log = createLogger({ route: 'cron' });
const STORE_TZ = 'Asia/Ho_Chi_Minh';

export interface SopReminderResult {
  tenantId: string;
  remindersCreated: number;
  errors: string[];
}

interface RunRow {
  id: string;
  template_id: string;
  shift_type: string;
  started_at: string;
  staff_id: string;
  staff_name: string | null;
}

interface ReminderDuty {
  templateId: string;
}

type SopReminderKind = 'upcoming' | 'due_no_run' | 'overdue';

export async function runSopReminders(
  env: Record<string, unknown>,
  now: Date = new Date()
): Promise<SopReminderResult[]> {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
  const results: SopReminderResult[] = [];

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

  const uniqueTenants = [...new Set(tenants.map((t) => (t.tenant_id || '').trim() || 'default'))];
  for (const tenantId of uniqueTenants) {
    const result = await processTenantReminders(db, tenantId, now);
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
  const cleanTenant = (tenantId || '').trim() || 'default';
  const storeNow = storeWallClockDate(now);
  const todayStr = dayKey(now);
  const currentHour = storeHour(now);

  try {
    const { results: templates } = await db.prepare(`
      SELECT id, code FROM sop_templates
      WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND is_active = 1
    `).bind(cleanTenant).all<{ id: string; code: string }>();

    const toDuty = (template: { id: string } | undefined): ReminderDuty | undefined =>
      template ? { templateId: template.id } : undefined;
    const deepCleanTpl = toDuty(templates.find((t) => t.code === 'deep-clean-m15'));
    const auditTpl = toDuty(templates.find((t) => t.code === 'inventory-audit-m30'));

    remindersCreated += await processUpcomingReminders(db, cleanTenant, storeNow, now, deepCleanTpl, auditTpl);
    if (currentHour >= 8) {
      remindersCreated += await processDueNoRunReminders(db, cleanTenant, storeNow, now, todayStr, deepCleanTpl, auditTpl);
    }
    remindersCreated += await processOverdueReminders(db, cleanTenant, todayStr, now);
  } catch (err) {
    errors.push((err as Error).message);
    log.error('sop-reminders tenant error', { tenantId: cleanTenant, message: (err as Error).message });
  }

  return { tenantId: cleanTenant, remindersCreated, errors };
}

function dayKey(date: Date): string {
  return businessDate(date);
}

function calendarDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function storeHour(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STORE_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
  return Number.parseInt(hourStr, 10);
}

function storeWallClockDate(date: Date): Date {
  const [year, month, day] = businessDate(date).split('-').map(Number);
  const hour = storeHour(date);
  return new Date(year, month - 1, day, hour, date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
}

async function processUpcomingReminders(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  storeNow: Date,
  now: Date,
  deepCleanTpl: ReminderDuty | undefined,
  auditTpl: ReminderDuty | undefined
): Promise<number> {
  let created = 0;
  if (deepCleanTpl) {
    const nextDc = nextDeepClean(storeNow);
    if (withinDays(storeNow, nextDc, 3)) {
      if (await tryInsertReminder(db, tenantId, deepCleanTpl, 'upcoming', calendarDayKey(nextDc), null, null, null, now)) created++;
    }
  }
  if (auditTpl) {
    const nextAuditDate = nextAudit(storeNow);
    if (withinDays(storeNow, nextAuditDate, 3)) {
      if (await tryInsertReminder(db, tenantId, auditTpl, 'upcoming', calendarDayKey(nextAuditDate), null, null, null, now)) created++;
    }
  }
  return created;
}

async function processDueNoRunReminders(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  storeNow: Date,
  now: Date,
  todayStr: string,
  deepCleanTpl: ReminderDuty | undefined,
  auditTpl: ReminderDuty | undefined
): Promise<number> {
  let created = 0;
  if (isDeepCleanDay(storeNow) && deepCleanTpl) {
    if (!(await hasRunForDay(db, tenantId, deepCleanTpl.templateId, todayStr))) {
      if (await tryInsertReminder(db, tenantId, deepCleanTpl, 'due_no_run', todayStr, null, null, null, now)) created++;
    }
  }
  if (isAuditDay(storeNow) && auditTpl) {
    if (!(await hasRunForDay(db, tenantId, auditTpl.templateId, todayStr))) {
      if (await tryInsertReminder(db, tenantId, auditTpl, 'due_no_run', todayStr, null, null, null, now)) created++;
    }
  }
  return created;
}

async function hasRunForDay(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  templateId: string,
  dayKeyStr: string
): Promise<boolean> {
  const { results } = await db.prepare(`
    SELECT 1 FROM sop_runs
    WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND template_id = ? AND scheduled_date = ?
      AND status IN ('in_progress', 'completed', 'abandoned')
    LIMIT 1
  `).bind(tenantId, templateId, dayKeyStr).all<{ 1: number }>();
  return results.length > 0;
}

async function processOverdueReminders(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  todayStr: string,
  now: Date
): Promise<number> {
  let created = 0;
  const { results: runs } = await db.prepare(`
    SELECT id, template_id, shift_type, started_at, staff_id, staff_name
    FROM sop_runs
    WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND status = 'in_progress'
  `).bind(tenantId).all<RunRow>();

  for (const run of runs) {
    const shiftType = run.shift_type as 'a' | 'b' | 'c';
    if (isOverdue(run.started_at, shiftType, now)) {
      const inserted = await tryInsertReminder(
        db, tenantId, { templateId: run.template_id }, 'overdue', todayStr, run.id, run.staff_id, run.staff_name, now
      );
      if (inserted) created++;
    }
  }
  return created;
}

async function tryInsertReminder(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  duty: ReminderDuty,
  kind: SopReminderKind,
  targetDayKey: string,
  runId: string | null,
  staffId: string | null,
  staffName: string | null,
  now: Date
): Promise<boolean> {
  if (runId === null) {
    // SQLite treats NULL values as distinct in UNIQUE(tenant_id, template_id, kind, day_key, run_id),
    // so upcoming and due_no_run reminders (where run_id IS NULL) must be deduplicated before insert.
    const existing = await db.prepare(`
      SELECT tenant_id, template_id, kind, day_key, run_id
      FROM sop_reminders
      WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
        AND template_id = ?
        AND kind = ?
        AND day_key = ?
        AND run_id IS NULL
      LIMIT 50
    `).bind(tenantId, duty.templateId, kind, targetDayKey).all<{
      tenant_id?: string | null;
      template_id?: string;
      kind?: string;
      day_key?: string;
      run_id?: string | null;
    }>();
    const alreadyExists = (existing.results ?? []).some((row) => {
      const rowTenant = (row.tenant_id || '').trim() || 'default';
      return (
        rowTenant === tenantId &&
        row.template_id === duty.templateId &&
        row.kind === kind &&
        row.day_key === targetDayKey &&
        (row.run_id === null || row.run_id === undefined)
      );
    });
    if (alreadyExists) {
      return false;
    }
  }

  const sentAt = now.toISOString();
  const result = await db.prepare(`
    INSERT OR IGNORE INTO sop_reminders
      (id, tenant_id, template_id, kind, day_key, run_id, staff_id, staff_name, sent_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), tenantId, duty.templateId, kind, targetDayKey,
    runId, staffId, staffName, sentAt, sentAt, sentAt
  ).run();
  return result.meta.changes > 0;
}

function withinDays(from: Date, target: Date, days: number): boolean {
  const diff = target.getTime() - from.getTime();
  return diff >= 0 && diff <= days * 86_400_000;
}