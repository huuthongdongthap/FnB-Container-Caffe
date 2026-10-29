// @vitest-environment node
/**
 * Recurring-duty reminders.
 *
 * The two monthly duties — deep clean on the 15th, stocktake on the 30th — are
 * obligations nobody is clocked in for, so nothing in the checklist lifecycle
 * will ever remind anyone. This scheduled task is the whole mechanism, and it
 * can fail in five distinct ways:
 *
 * 1. It fires against the runtime's UTC day instead of the store's, so a store
 *    at UTC+7 gets a reminder about yesterday three days early.
 * 2. It writes the ledger twice, because it runs every five minutes and a
 *    per-day notice that repeats twelve times an hour is noise, not a reminder.
 * 3. It writes into `sop_runs`, which would show a checklist nobody was asked to
 *    do as work that was done.
 * 4. It counts a February stocktake as day 30, which does not exist.
 * 5. One store's failure stops the other stores from being reminded at all.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';
import { runSopReminders } from '../../routes/cron-handlers/sop-reminders';

const TENANT = 'default';
// Seeded by the shared fixture; the monthly duties are the two the reminder
// rules exist for, and the shift templates are there to prove a reminder is
// never raised about a checklist someone is already clocked in for.
const DEEP_CLEAN = 'tpl_deep_clean_m15';
const AUDIT = 'tpl_inventory_audit_m30';

/** The store is at UTC+7 (Vietnam); local dates are what the duties follow. */
function localDate(year: number, monthIndex: number, day: number, hour = 12): Date {
  return new Date(year, monthIndex, day, hour, 0, 0);
}

function withMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function reminderRows(fx: ReturnType<typeof staffSessionFixture>, tenantId = TENANT) {
  return fx.sqlite
    .prepare('SELECT kind, template_id, day_key, run_id, staff_id FROM sop_reminders WHERE tenant_id = ? ORDER BY kind')
    .all(tenantId) as { kind: string; template_id: string; day_key: string; run_id: string | null; staff_id: string | null }[];
}

describe('sop recurring-duty reminders', () => {
  let fx: ReturnType<typeof staffSessionFixture>;

  beforeAll(() => {
    fx = staffSessionFixture();
    applySopMigrations(fx.sqlite);
  });

  /**
   * Every test writes its own runs and templates, and the ledger is the whole
   * assertion surface. Without a reset an earlier test's run stays open and
   * shows up as an overrun in a later one — a leak that reads as a dedupe bug
   * in the handler but is really the harness failing to isolate itself.
   */
  beforeEach(() => {
    fx.sqlite.prepare('DELETE FROM sop_reminders').run();
    fx.sqlite.prepare('DELETE FROM sop_runs').run();
    // Templates are re-seeded below rather than deleted: the fixture's own set is
    // what the rules read, and a deleted template is indistinguishable from a
    // duty nobody has set up.
    for (const [id, code] of [[DEEP_CLEAN, 'deep-clean-m15'], [AUDIT, 'inventory-audit-m30']] as const) {
      fx.sqlite
        .prepare("UPDATE sop_templates SET is_active = 1 WHERE tenant_id = 'default' AND code = ?")
        .run(code);
    }
  });

  // ------------------------------------------------------------------ RULE 1

  it('reminds three days before the deep-clean day, and not four', async () => {
    const three = await runSopReminders(fx.env, localDate(2026, 10, 12)); // 12 Nov
    expect(three.find((r) => r.tenantId === TENANT)?.remindersCreated).toBe(1);
    expect(reminderRows(fx)).toEqual([
      { kind: 'upcoming', template_id: DEEP_CLEAN, day_key: '2026-11-15', run_id: null, staff_id: null },
    ]);

    const four = await runSopReminders(fx.env, localDate(2026, 10, 11)); // 11 Nov
    expect(reminderRows(fx)).toHaveLength(1);
  });

  it('reminds about the stocktake on its own short month, not on a day that never happens', async () => {
    // February has 28 days, so the stocktake is the 28th. A reminder built from
    // "day 30" would fire on March 2 via the JS date overflow, or never.
    const rows = await runSopReminders(fx.env, localDate(2026, 1, 25)); // 25 Feb
    const audit = rows.find((r) => r.tenantId === TENANT);
    expect(audit?.remindersCreated).toBe(1);
    expect(reminderRows(fx).find((r) => r.template_id === AUDIT)).toMatchObject({
      kind: 'upcoming',
      day_key: '2026-02-28',
    });

    // And it fires on the day itself, when nobody has started it.
    await runSopReminders(fx.env, localDate(2026, 1, 28, 9)); // 28 Feb, 09:00
    const due = reminderRows(fx).find((r) => r.kind === 'due_no_run');
    expect(due).toMatchObject({ template_id: AUDIT, day_key: '2026-02-28' });
  });

  it('keys the reminder on the store day, not the UTC day', async () => {
    // 00:30 local on 13 Nov in UTC+7 is still 17:30 UTC on 12 Nov. Reading the
    // UTC day would compute the deep-clean as two days away instead of three.
    const near = await runSopReminders(fx.env, new Date(Date.UTC(2026, 10, 12, 17, 30)));
    expect(near.find((r) => r.tenantId === TENANT)?.remindersCreated).toBe(1);
    const far = await runSopReminders(fx.env, new Date(Date.UTC(2026, 10, 11, 12, 0)));
    expect(reminderRows(fx)).toHaveLength(1);
  });

  // ------------------------------------------------------------------ RULE 2

  it('stays silent on the duty day when a run has actually been started', async () => {
    fx.sqlite
      .prepare("INSERT INTO sop_runs (id, tenant_id, template_id, template_version, staff_id, staff_name, shift_type, status, scheduled_date, started_at) VALUES (?, ?, ?, 1, 'staff', 'Name staff', 'any', 'in_progress', '2026-11-15', ?)")
      .run('run-started', TENANT, DEEP_CLEAN, localDate(2026, 10, 15, 9).toISOString());

    const rows = await runSopReminders(fx.env, localDate(2026, 10, 15, 9)); // 15 Nov, 09:00
    expect(rows.find((r) => r.tenantId === TENANT)?.remindersCreated).toBe(0);
    expect(reminderRows(fx).filter((r) => r.kind === 'due_no_run')).toHaveLength(0);
  });

  it('treats an abandoned run as the duty having been faced, not ignored', async () => {
    // Someone looked at it and dropped it. The reminder is for nobody having
    // looked at all, which is a different fact.
    fx.sqlite
      .prepare("INSERT INTO sop_runs (id, tenant_id, template_id, template_version, staff_id, staff_name, shift_type, status, scheduled_date, started_at, abandoned_reason) VALUES (?, ?, ?, 1, 'staff', 'Name staff', 'any', 'abandoned', '2026-11-15', ?, 'no time')")
      .run('run-dropped', TENANT, DEEP_CLEAN, localDate(2026, 10, 15, 9).toISOString());

    await runSopReminders(fx.env, localDate(2026, 10, 15, 9));
    expect(reminderRows(fx).filter((r) => r.kind === 'due_no_run')).toHaveLength(0);
  });

  it('does not raise the day-not-run notice before 08:00', async () => {
    const early = await runSopReminders(fx.env, localDate(2026, 10, 15, 6));
    expect(early.find((r) => r.tenantId === TENANT)?.remindersCreated).toBe(0);

    const late = await runSopReminders(fx.env, localDate(2026, 10, 15, 9));
    expect(late.find((r) => r.tenantId === TENANT)?.remindersCreated).toBe(1);
  });

  // ------------------------------------------------------------------ RULE 3

  it.each([
    ['a', 30],
    ['b', 40],
    ['c', 60],
  ])('flags a run overdue of shift %s after %i minutes', async (shiftType, minutes) => {
    const startedAt = localDate(2026, 10, 20, 9).toISOString();
    const startedMs = new Date(startedAt).getTime();

    // The run must exist before the boundary is probed: an "inside window"
    // assertion made against no run at all is satisfied by any window, so it
    // would pass just as well against a handler that called every shift 30
    // minutes — which is precisely the off-by-a-shift bug it is here to catch.
    fx.sqlite
      .prepare("INSERT INTO sop_runs (id, tenant_id, template_id, template_version, staff_id, staff_name, shift_type, status, scheduled_date, started_at) VALUES (?, ?, ?, 1, 'staff', 'Name staff', ?, 'in_progress', '2026-11-20', ?)")
      .run(`run-${shiftType}`, TENANT, DEEP_CLEAN, shiftType, startedAt);

    // Just inside the window: the run is open but not yet overdue.
    const inside = await runSopReminders(fx.env, new Date(startedMs + minutes * 60_000));
    expect(inside.find((r) => r.tenantId === TENANT)?.remindersCreated, `${shiftType} inside window`).toBe(0);
    expect(reminderRows(fx).filter((r) => r.kind === 'overdue')).toHaveLength(0);

    await runSopReminders(fx.env, new Date(startedMs + (minutes + 1) * 60_000));
    const overdue = reminderRows(fx).filter((r) => r.kind === 'overdue');
    expect(overdue, `${shiftType} past window`).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ run_id: `run-${shiftType}`, staff_id: 'staff' });
  });

  it('leaves a completed run alone however long ago it ran', async () => {
    fx.sqlite
      .prepare("INSERT INTO sop_runs (id, tenant_id, template_id, template_version, staff_id, staff_name, shift_type, status, scheduled_date, started_at, completed_at) VALUES (?, ?, ?, 1, 'staff', 'Name staff', 'a', 'completed', '2026-11-10', ?, ?)")
      .run('run-done', TENANT, DEEP_CLEAN, localDate(2026, 10, 10, 9).toISOString(), localDate(2026, 10, 10, 9, 45).toISOString());

    await runSopReminders(fx.env, localDate(2026, 10, 10, 23));
    expect(reminderRows(fx).filter((r) => r.kind === 'overdue')).toHaveLength(0);
  });

  // ------------------------------------------------------------------ RULE 4

  it('writes one notice per duty per day however often it runs', async () => {
    // The deep-clean day. The stocktake is not due, so only one notice is due —
    // the point is that four passes produce one row, not two.
    const when = localDate(2026, 10, 15, 9);
    const passes = [
      await runSopReminders(fx.env, when),
      await runSopReminders(fx.env, when),
      await runSopReminders(fx.env, withMinutes(when, 5)),
      await runSopReminders(fx.env, withMinutes(when, 300)),
    ];

    const rows = reminderRows(fx).filter((r) => r.kind === 'due_no_run');
    expect(rows).toHaveLength(1);
    expect(rows.map((r) => r.template_id)).toEqual([DEEP_CLEAN]);

    // The repeat passes are the point: writing the same notice again must be a
    // no-op, not an error. If the insert were not ignoring conflicts the unique
    // index would raise on the second pass, the per-tenant catch would swallow
    // it, and the ledger would still show one row — so only the error channel
    // distinguishes a working dedupe from one that is quietly failing.
    for (const pass of passes) {
      const tenant = pass.find((r) => r.tenantId === TENANT);
      expect(tenant?.errors).toEqual([]);
    }
    expect(passes.map((p) => p.find((r) => r.tenantId === TENANT)?.remindersCreated)).toEqual([1, 0, 0, 0]);
  });

  it('backs the dedupe with a unique index, not with application logic', () => {
    // The five-minute cadence means two workers can easily run concurrently.
    // A check-then-insert in code races; a unique index does not, because the
    // database resolves the conflict. This is the constraint the pass relies on,
    // so it is asserted directly rather than inferred from a green run.
    const index = fx.sqlite
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get('idx_sop_reminders_dedup') as { sql: string };

    expect(index.sql).toContain('CREATE UNIQUE INDEX');
    // template_id is in the key or the two monthly duties collide with each other.
    expect(index.sql).toContain('template_id');
    // COALESCE, because a bare NULL run_id is distinct from every other NULL and
    // would let the run-less kinds repeat forever.
    expect(index.sql).toContain('COALESCE(run_id');
  });

  it('gives each overrun run its own overdue notice', async () => {
    // The unique index covers run_id, so two simultaneous overruns are two
    // obligations rather than one. With run_id excluded from the key, the second
    // would be silently dropped and a shift leader would never hear about it.
    const startedAt = localDate(2026, 10, 20, 9).toISOString();
    for (const id of ['run-a', 'run-b']) {
      fx.sqlite
        .prepare("INSERT INTO sop_runs (id, tenant_id, template_id, template_version, staff_id, staff_name, shift_type, status, scheduled_date, started_at) VALUES (?, ?, ?, 1, ?, 'Name staff', 'a', 'in_progress', '2026-11-20', ?)")
        .run(id, TENANT, DEEP_CLEAN, id, startedAt);
    }
    await runSopReminders(fx.env, new Date(new Date(startedAt).getTime() + 61 * 60_000));
    await runSopReminders(fx.env, new Date(new Date(startedAt).getTime() + 62 * 60_000));

    const overdue = reminderRows(fx).filter((r) => r.kind === 'overdue');
    expect(overdue.map((r) => r.run_id).sort()).toEqual(['run-a', 'run-b']);
  });

  // ---------------------------------------------------------------- tenancy

  it('reminds every store and keeps their ledgers apart', async () => {
    // The fixture's own staff moved to a second store, which now has no templates
    // of its own — a store is reminded because of its duties, not its people.
    fx.sqlite.prepare("UPDATE users SET tenant_id = 'cafe-a' WHERE id IN ('owner','staff','manager')").run();
    fx.sqlite
      .prepare("INSERT OR IGNORE INTO sop_templates (id, tenant_id, code, title, shift_type, is_active, version) VALUES ('tpl-b-deep-clean', 'cafe-b', 'deep-clean-m15', 'Deep clean', 'any', 1, 1)")
      .run();

    const rows = await runSopReminders(fx.env, localDate(2026, 10, 12));
    expect(rows.map((r) => r.tenantId).sort()).toEqual(['cafe-b', 'default']);

    const forB = reminderRows(fx, 'cafe-b');
    expect(forB).toEqual([
      { kind: 'upcoming', template_id: 'tpl-b-deep-clean', day_key: '2026-11-15', run_id: null, staff_id: null },
    ]);
  });

  it('keeps going for the other stores when one store fails', async () => {
    fx.sqlite.prepare("UPDATE users SET tenant_id = 'cafe-a' WHERE id IN ('owner','staff')").run();
    fx.sqlite
      .prepare("INSERT OR IGNORE INTO sop_templates (id, tenant_id, code, title, shift_type, is_active, version) VALUES ('tpl-broken', 'cafe-b', 'deep-clean-m15', 'Deep clean', 'any', 1, 1)")
      .run();

    // The failure is injected inside the first store's work, not at discovery:
    // discovery failing means nothing can be reminded at all, which is a
    // different degradation. What must hold is that one store raising does not
    // stop the store after it.
    const originalPrepare = fx.db.prepare.bind(fx.db);
    let armed = true;
    fx.db.prepare = (sql: string) => {
      const statement = originalPrepare(sql);
      // The per-store template read, once discovery has already returned.
      if (armed && sql.includes('SELECT id, code FROM sop_templates')) {
        armed = false;
        throw new Error('D1 unavailable');
      }
      return statement;
    };

    const rows = await runSopReminders(fx.env, localDate(2026, 10, 12));
    fx.db.prepare = originalPrepare;

    // The store after the failing one is still reminded.
    const healthy = rows.find((r) => r.tenantId === TENANT);
    expect(healthy?.errors).toEqual([]);
    expect(healthy?.remindersCreated).toBe(1);
  });

  it('runs empty rather than throwing when discovery itself fails', async () => {
    // A shared cron tick must never be taken down by this task: the throw is
    // converted into "no reminders this pass", and the next pass picks it up.
    const originalPrepare = fx.db.prepare.bind(fx.db);
    fx.db.prepare = (sql: string) => {
      if (sql.includes('SELECT DISTINCT tenant_id')) throw new Error('D1 unavailable');
      return originalPrepare(sql);
    };
    let rows: ReturnType<typeof runSopReminders> extends Promise<infer R> ? R : never = [];
    let threw = false;
    try {
      rows = await runSopReminders(fx.env, localDate(2026, 10, 12));
    } catch {
      threw = true;
    } finally {
      fx.db.prepare = originalPrepare;
    }
    expect(threw).toBe(false);
    expect(rows).toEqual([]);
    expect(reminderRows(fx)).toHaveLength(0);
  });

  // ------------------------------------------------------------- ledger shape

  it('writes no checklist run at all', async () => {
    const before = fx.sqlite.prepare('SELECT COUNT(*) AS count FROM sop_runs').get() as { count: number };
    await runSopReminders(fx.env, localDate(2026, 10, 15, 9));
    const after = fx.sqlite.prepare('SELECT COUNT(*) AS count FROM sop_runs').get() as { count: number };
    expect(after.count).toBe(before.count);
  });

  it('leaves reminder_sent_at on a real run untouched', async () => {
    // The column belongs to the checklist record; the reminder ledger is a
    // separate table, and the two must not drift into each other.
    fx.sqlite
      .prepare("INSERT INTO sop_runs (id, tenant_id, template_id, template_version, staff_id, staff_name, shift_type, status, scheduled_date, started_at) VALUES ('run-live', ?, ?, 1, 'staff', 'Name staff', 'a', 'in_progress', '2026-11-15', ?)")
      .run(TENANT, DEEP_CLEAN, localDate(2026, 10, 15, 9).toISOString());
    await runSopReminders(fx.env, new Date(new Date(localDate(2026, 10, 15, 9)).getTime() + 90 * 60_000));

    const run = fx.sqlite.prepare('SELECT reminder_sent_at FROM sop_runs WHERE id = ?').get('run-live') as {
      reminder_sent_at: string | null;
    };
    expect(run.reminder_sent_at).toBeNull();
  });
});
