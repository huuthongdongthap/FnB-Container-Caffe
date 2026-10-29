// @vitest-environment node
/**
 * The recurring-duty reminder ledger, as read and acknowledged over HTTP.
 *
 * The scheduled task writes this ledger (see sop-reminders.test.ts); this is the
 * surface that makes it actionable, and it can fail in ways the task cannot:
 *
 * 1. A non-manager reads or acknowledges the ledger, which would expose one
 *    store's compliance warnings to a staff member of any store — the scope is
 *    the session's tenant, so the risk is a missing role gate, not a leak of a
 *    foreign row through a guessed id.
 * 2. The counts badge disagrees with the list, so the console shows "3 open"
 *    above an empty table.
 * 3. Acknowledging silently deletes or rewrites the notice, losing the fact that
 *    the store was warned about a duty it then did not do.
 * 4. A second acknowledge fails, so a double-tap reads as a broken console.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';

/**
 * The fixture's manager and staff both live in `cafe-a`; the templates seeded by
 * the SOP migration are on `default`. The reminder ledger is scoped to the
 * session's tenant, so the reminders a manager can see must be written on
 * `cafe-a` — which is the whole point of the tenancy tests at the bottom.
 */
const TENANT = 'cafe-a';
const OTHER_TENANT = 'cafe-b';
const DEEP_CLEAN = 'tpl_deep_clean_m15';
const MANAGER = 'manager';
const STAFF = 'staff';

/** Seeded by the shared fixture; the monthly duties are what the rules raise. */
function seedReminder(
  fx: ReturnType<typeof staffSessionFixture>,
  overrides: Partial<{
    id: string;
    kind: string;
    dayKey: string;
    runId: string | null;
    staffId: string | null;
    acknowledgedAt: string | null;
    sentAt: string;
  }> = {}
) {
  const row = {
    id: 'rem-1',
    kind: 'upcoming',
    dayKey: '2026-11-15',
    runId: null,
    staffId: null,
    acknowledgedAt: null,
    sentAt: '2026-11-12T09:00:00.000Z',
    ...overrides,
  };
  fx.sqlite
    .prepare(
      `INSERT INTO sop_reminders (id, tenant_id, template_id, kind, day_key, run_id, staff_id, staff_name, sent_at, acknowledged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Name staff', ?, ?)`
    )
    .run(row.id, TENANT, DEEP_CLEAN, row.kind, row.dayKey, row.runId, row.staffId, row.sentAt, row.acknowledgedAt);
  return row.id;
}

function storedReminder(fx: ReturnType<typeof staffSessionFixture>, id: string) {
  return fx.sqlite
    .prepare('SELECT id, kind, day_key, acknowledged_at FROM sop_reminders WHERE id = ?')
    .get(id) as { id: string; kind: string; day_key: string; acknowledged_at: string | null };
}

describe('sop reminder ledger API', () => {
  let fx: ReturnType<typeof staffSessionFixture>;

  beforeAll(() => {
    fx = staffSessionFixture();
    applySopMigrations(fx.sqlite);
  });

  beforeEach(() => {
    fx.sqlite.prepare('DELETE FROM sop_reminders').run();
  });

  // ------------------------------------------------------------------ AUTHORITY

  it('refuses an unauthenticated caller before the ledger is read', async () => {
    seedReminder(fx);
    const res = await fx.request('/api/sop/admin/reminders');
    expect(res.status).toBe(401);
  });

  it('refuses a staff member from the ledger', async () => {
    seedReminder(fx);
    const res = await fx.request('/api/sop/admin/reminders', await fx.token(STAFF));
    expect(res.status).toBe(403);
  });

  it('lets a manager read the ledger', async () => {
    seedReminder(fx);
    const res = await fx.request('/api/sop/admin/reminders', await fx.token(MANAGER));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { reminders: { id: string }[] } };
    expect(body.data.reminders.map((r) => r.id)).toEqual(['rem-1']);
  });

  // --------------------------------------------------------------------- FILTERS

  it('filters by kind, so an overdue notice is not buried under advance notices', async () => {
    seedReminder(fx, { id: 'rem-upcoming', kind: 'upcoming' });
    seedReminder(fx, { id: 'rem-due', kind: 'due_no_run', dayKey: '2026-11-15' });
    seedReminder(fx, { id: 'rem-overdue', kind: 'overdue', dayKey: '2026-11-20', runId: 'run-live', staffId: STAFF });

    const res = await fx.request('/api/sop/admin/reminders?kind=overdue', await fx.token(MANAGER));
    const body = await res.json() as { data: { reminders: { id: string; runId: string | null }[] } };
    expect(body.data.reminders.map((r) => r.id)).toEqual(['rem-overdue']);
    // The overdue kind is the only one that names a run.
    expect(body.data.reminders[0].runId).toBe('run-live');
  });

  it('hides acknowledged notices when asked for unread only', async () => {
    seedReminder(fx, { id: 'rem-open' });
    // A different day so the dedup index — which keys on kind, day and run — does
    // not treat the handled notice as a duplicate write of the open one.
    seedReminder(fx, { id: 'rem-handled', dayKey: '2026-11-16', acknowledgedAt: '2026-11-12T10:00:00.000Z' });

    const all = await fx.request('/api/sop/admin/reminders', await fx.token(MANAGER));
    const allBody = await all.json() as { data: { reminders: { id: string }[] } };
    expect(allBody.data.reminders.map((r) => r.id)).toEqual(['rem-open', 'rem-handled']);

    const unread = await fx.request('/api/sop/admin/reminders?unread=true', await fx.token(MANAGER));
    const unreadBody = await unread.json() as { data: { reminders: { id: string }[] } };
    expect(unreadBody.data.reminders.map((r) => r.id)).toEqual(['rem-open']);

    // `false` asks for the whole ledger. A filter that reads the query string
    // for truthiness treats "false" as a value and hides the history anyway.
    const every = await fx.request('/api/sop/admin/reminders?unread=false', await fx.token(MANAGER));
    const everyBody = await every.json() as { data: { reminders: { id: string }[] } };
    expect(everyBody.data.reminders.map((r) => r.id)).toEqual(['rem-open', 'rem-handled']);
  });

  it('counts open notices per kind, and the counts agree with the list', async () => {
    seedReminder(fx, { id: 'rem-upcoming', kind: 'upcoming' });
    seedReminder(fx, { id: 'rem-due', kind: 'due_no_run' });
    seedReminder(fx, { id: 'rem-overdue', kind: 'overdue', runId: 'run-live' });
    // Acknowledged ones are history: they must not inflate the badge.
    seedReminder(fx, { id: 'rem-done', kind: 'overdue', runId: 'run-old', acknowledgedAt: '2026-11-21T09:00:00.000Z' });

    const res = await fx.request('/api/sop/admin/reminders', await fx.token(MANAGER));
    const body = await res.json() as {
      data: { reminders: { acknowledgedAt: string | null }[]; counts: { total: number; byKind: Record<string, number> } };
    };
    expect(body.data.counts).toEqual({ total: 3, byKind: { upcoming: 1, due_no_run: 1, overdue: 1 } });
    expect(body.data.reminders.filter((r) => r.acknowledgedAt === null)).toHaveLength(3);
  });

  it('caps the page rather than returning the whole ledger', async () => {
    for (let i = 0; i < 5; i += 1) {
      seedReminder(fx, { id: `rem-${i}`, dayKey: `2026-11-${String(10 + i).padStart(2, '0')}` });
    }
    const res = await fx.request('/api/sop/admin/reminders?limit=2', await fx.token(MANAGER));
    const body = await res.json() as { data: { reminders: { id: string }[] } };
    expect(body.data.reminders).toHaveLength(2);
  });

  it('filters by day and template, so one duty can be looked up on its own', async () => {
    seedReminder(fx, { id: 'rem-day-15', dayKey: '2026-11-15' });
    seedReminder(fx, { id: 'rem-day-20', dayKey: '2026-11-20' });

    const byDay = await fx.request('/api/sop/admin/reminders?dayKey=2026-11-20', await fx.token(MANAGER));
    const byDayBody = await byDay.json() as { data: { reminders: { id: string }[] } };
    expect(byDayBody.data.reminders.map((r) => r.id)).toEqual(['rem-day-20']);

    const byTemplate = await fx.request(
      `/api/sop/admin/reminders?templateId=${DEEP_CLEAN}`,
      await fx.token(MANAGER)
    );
    const byTemplateBody = await byTemplate.json() as { data: { reminders: { id: string }[] } };
    expect(byTemplateBody.data.reminders).toHaveLength(2);
  });

  it('rejects a page size outside the documented range rather than clamping silently', async () => {
    seedReminder(fx);
    const res = await fx.request('/api/sop/admin/reminders?limit=0', await fx.token(MANAGER));
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------- ACKNOWLEDGE

  it('marks a notice handled, keeping the row and what it was about', async () => {
    seedReminder(fx);
    const res = await fx.request('/api/sop/admin/reminders/rem-1/acknowledge', await fx.token(MANAGER), 'POST');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { acknowledged: true } });

    const row = storedReminder(fx, 'rem-1');
    expect(row.acknowledged_at).not.toBeNull();
    // The obligation itself is untouched: the notice is not a work record, so
    // acknowledging it must not become completion of the duty.
    expect(row.kind).toBe('upcoming');
    expect(row.day_key).toBe('2026-11-15');
  });

  it('acknowledging twice is a no-op, not a failure', async () => {
    seedReminder(fx);
    const token = await fx.token(MANAGER);
    await fx.request('/api/sop/admin/reminders/rem-1/acknowledge', token, 'POST');
    const second = await fx.request('/api/sop/admin/reminders/rem-1/acknowledge', token, 'POST');
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ data: { acknowledged: false } });
  });

  it('refuses a staff member acknowledging a notice', async () => {
    seedReminder(fx);
    const res = await fx.request('/api/sop/admin/reminders/rem-1/acknowledge', await fx.token(STAFF), 'POST');
    expect(res.status).toBe(403);
    expect(storedReminder(fx, 'rem-1').acknowledged_at).toBeNull();
  });

  it('reports a notice that does not exist rather than inventing one', async () => {
    const res = await fx.request('/api/sop/admin/reminders/nope/acknowledge', await fx.token(MANAGER), 'POST');
    expect(res.status).toBe(200);
    // Acknowledged is false because there was nothing to mark; the ledger has no
    // row for it, and the handler did not create one.
    const count = fx.sqlite.prepare('SELECT COUNT(*) AS count FROM sop_reminders').get() as { count: number };
    expect(count.count).toBe(0);
  });

  // -------------------------------------------------------------------- TENANCY

  it('keeps each store to its own ledger', async () => {
    // The manager's own store and a second one each have notices on the same day.
    seedReminder(fx);
    fx.sqlite
      .prepare(
        `INSERT INTO sop_reminders (id, tenant_id, template_id, kind, day_key, sent_at)
         VALUES ('rem-other', ?, 'tpl-other', 'due_no_run', '2026-11-15', '2026-11-15T09:00:00.000Z')`
      )
      .run(OTHER_TENANT);

    const res = await fx.request('/api/sop/admin/reminders', await fx.token(MANAGER));
    const body = await res.json() as { data: { reminders: { id: string }[] } };
    expect(body.data.reminders.map((r) => r.id)).toEqual(['rem-1']);
  });

  it('will not let one store acknowledge another store notice', async () => {
    fx.sqlite
      .prepare(
        `INSERT INTO sop_reminders (id, tenant_id, template_id, kind, day_key, sent_at)
         VALUES ('rem-other', ?, 'tpl-other', 'due_no_run', '2026-11-15', '2026-11-15T09:00:00.000Z')`
      )
      .run(OTHER_TENANT);

    const res = await fx.request('/api/sop/admin/reminders/rem-other/acknowledge', await fx.token(MANAGER), 'POST');
    expect(res.status).toBe(200);
    const foreign = fx.sqlite
      .prepare('SELECT acknowledged_at FROM sop_reminders WHERE id = ?')
      .get('rem-other') as { acknowledged_at: string | null };
    expect(foreign.acknowledged_at).toBeNull();
  });
});
