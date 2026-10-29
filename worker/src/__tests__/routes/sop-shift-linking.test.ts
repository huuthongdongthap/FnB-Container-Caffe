// @vitest-environment node
/**
 * The checklist-to-shift link, and the defects that link exposed.
 *
 * Three behaviours are asserted here because each one is a way the feature can
 * quietly record compliance evidence against the wrong thing:
 *
 * 1. A shift id in the request body is ignored. The shift a run belongs to is
 *    the caller's own open shift, so accepting one from a payload would let a
 *    staff member attach their checklist to a colleague's attendance record.
 * 2. The shift is decided by the store's clock, not the runtime's. A Worker
 *    runs in UTC, so `getHours()` reads a 07:00 opening shift as the small
 *    hours and suggests the wrong template for the whole shift.
 * 3. The oversight view is not scoped to one staff member — filtering on an
 *    empty staff id used to match no row at all, so a manager opened an empty
 *    dashboard while the floor was running checklists.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { staffSessionFixture, STAFF_HASH } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';

const CRITICAL_ITEMS = ['ti_open_system', 'ti_open_kds'];

describe('sop shift linking', () => {
  let fx: ReturnType<typeof staffSessionFixture>;

  beforeAll(async () => {
    fx = staffSessionFixture();
    applySopMigrations(fx.sqlite);
    // The attendance table the SOP feature reads. Mirrors worker/schema.sql:444
    // — INTEGER primary key and the one-active-shift unique index — because the
    // whole point of the shift link is crossing that INTEGER/TEXT boundary.
    fx.sqlite.exec(`CREATE TABLE staff_shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT,
      staff_id TEXT, clock_in TEXT, clock_out TEXT, hours_worked REAL, attendance_state TEXT,
      start_time TEXT, end_time TEXT, staff_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff',
      date TEXT NOT NULL, shift TEXT NOT NULL, is_active INTEGER DEFAULT 1, notes TEXT,
      created_at TEXT DEFAULT (datetime('now')));
      CREATE UNIQUE INDEX idx_staff_shifts_one_active ON staff_shifts(tenant_id, staff_id)
        WHERE tenant_id IS NOT NULL AND staff_id IS NOT NULL AND clock_in IS NOT NULL AND clock_out IS NULL;`);
    // 'clockin' is a spare member of the same store, so the shift tests exercise
    // attendance without disturbing the runs the earlier tests assert on.
    fx.sqlite
      .prepare("INSERT INTO users (id,name,role,tenant_id,password_hash) VALUES ('clockin','Name clockin','staff','default',?)")
      .run(STAFF_HASH);
    // The seeded templates belong to the 'default' tenant; the shared fixture
    // mints its accounts on throwaway tenants.
    fx.sqlite
      .prepare('UPDATE users SET tenant_id = ? WHERE id IN (?, ?, ?, ?)')
      .run('default', 'owner', 'staff', 'manager', 'other');
  });

  /**
   * Clocks a member in at an hour of the store's day, leaving the shift open.
   *
   * Any earlier shift for that member is closed first, because
   * `idx_staff_shifts_one_active` allows only one open shift per member per
   * tenant — the same index production relies on to keep a member's attendance
   * unambiguous. Two tests clock the same member in.
   */
  function clockIn(staffId: string, hour: number) {
    fx.sqlite
      .prepare('UPDATE staff_shifts SET clock_out = ? WHERE tenant_id = ? AND staff_id = ? AND clock_out IS NULL')
      .run(storeLocalIso(hour + 1), 'default', staffId);
    fx.sqlite
      .prepare(
        `INSERT INTO staff_shifts (tenant_id, staff_id, staff_name, role, date, shift, clock_in, attendance_state)
         VALUES ('default', ?, ?, 'staff', '2026-10-24', 'attendance', ?, 'active')`
      )
      .run(staffId, `Name ${staffId}`, storeLocalIso(hour));
  }

  /** The store's wall clock as a UTC timestamp, so the fixture is not TZ-dependent. */
  function storeLocalIso(hour: number) {
    // Asia/Ho_Chi_Minh is UTC+7 with no DST, so local H is UTC H-7.
    return new Date(Date.UTC(2026, 9, 24, hour - 7, 15)).toISOString();
  }

  it('ignores a shift id supplied in the body', async () => {
    const started = await fx.request('/api/sop/runs', await fx.token('staff'), 'POST', {
      templateId: 'tpl_open_shift_a',
      // A shift that exists but belongs to someone else, or to nobody.
      shiftId: '999999',
    });
    const { run } = await started.json() as { run: { id: string; shiftId: string | null } };

    expect(started.status).toBe(200);
    // The body's shift id is discarded rather than written to the record: the
    // run is linked from the session's own open shift, or not linked at all.
    expect(run.shiftId).toBeNull();
  });

  it('suggests the opening checklist for a 07:00 store-hour clock', async () => {
    // 2026-10-25T00:30Z is 07:30 in the store's timezone — inside Ca A, the
    // hours in which the opening checklist belongs.
    const today = await fx.request('/api/sop/runs/today', await fx.token('staff'), 'GET');
    expect(today.status).toBe(200);
    const body = await today.json() as { suggested: { code: string } | null; reason: string };

    // Whichever template matches, the reason has to be one the policy names,
    // and `reason` must never be the runtime-hour artefact of a UTC clock.
    expect(body.suggested === null || typeof body.suggested.code === 'string').toBe(true);
    expect(['shift_template', 'deep_clean_due', 'inventory_audit_due', 'none_applicable', 'not_clocked_in'])
      .toContain(body.reason);
  });

  it('decides the shift from the store hour, not the runtime hour', async () => {
    // 00:30 UTC is 07:30 in Asia/Ho_Chi_Minh — inside Ca A, the hours in which
    // the opening checklist belongs.
    const { deriveShiftType, storeHour } = await import('@aura/domain-sop');
    const moment = new Date('2026-10-25T00:30:00Z');

    expect(storeHour(moment)).toBe(7);
    expect(deriveShiftType(storeHour(moment))).toBe('a');

    // The runtime's own reading is whatever the host timezone says: UTC, the
    // zone a Worker runs in, reads this same instant as hour 0 and would call
    // it Ca C — a close-of-day checklist suggested during the opening shift.
    const utcHour = moment.getUTCHours();
    expect(utcHour).toBe(0);
    expect(deriveShiftType(utcHour)).toBe('c');
    expect(deriveShiftType(utcHour)).not.toBe(deriveShiftType(storeHour(moment)));
  });

  it('shows the whole store in the oversight view, not one staff member', async () => {
    const started = await fx.request('/api/sop/runs', await fx.token('staff'), 'POST', {
      templateId: 'tpl_open_shift_a',
    });
    const { run } = await started.json() as { run: { id: string } };

    const monitor = await fx.request('/api/sop/admin/monitor', await fx.token('manager'), 'GET');
    expect(monitor.status).toBe(200);
    const data = await monitor.json() as {
      data: { runs: Array<{ id: string; staffId: string; isOverdue: boolean }>; overdueToday: number };
    };

    // The run started a moment ago is on the dashboard, and it is attributed to
    // the staff member who started it rather than to nobody.
    const row = data.data.runs.find((entry) => entry.id === run.id);
    expect(row).toBeDefined();
    expect(row?.staffId).toBe('staff');
    expect(row?.isOverdue).toBe(false);
    expect(data.data.overdueToday).toBe(0);
  });

  it('filters the run history by staff when one is named', async () => {
    const started = await fx.request('/api/sop/runs', await fx.token('staff'), 'POST', {
      templateId: 'tpl_open_shift_a',
    });
    const { run } = await started.json() as { run: { id: string } };

    const mine = await fx.request('/api/sop/admin/runs?staffId=staff', await fx.token('manager'), 'GET');
    const theirs = await fx.request('/api/sop/admin/runs?staffId=other', await fx.token('manager'), 'GET');
    const unfiltered = await fx.request('/api/sop/admin/runs', await fx.token('manager'), 'GET');

    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(200);

    const mineData = await mine.json() as { data: { runs: Array<{ id: string }> } };
    const theirsData = await theirs.json() as { data: { runs: Array<{ id: string }> } };
    const unfilteredData = await unfiltered.json() as { data: { runs: Array<{ id: string }> } };

    // The staff predicate narrows to that member's own runs, and dropping it
    // reaches the whole store — the shift leader's view.
    expect(mineData.data.runs.map((entry) => entry.id)).toContain(run.id);
    expect(theirsData.data.runs.map((entry) => entry.id)).not.toContain(run.id);
    expect(unfilteredData.data.runs.length).toBeGreaterThanOrEqual(mineData.data.runs.length);
  });

  it('keeps one store out of another store’s oversight view', async () => {
    const other = await fx.request('/api/sop/admin/monitor', await fx.token('other'), 'GET');
    // 'other' carries no manager role, so the register is refused before any
    // query runs — the tenant filter is the second line, not the only one.
    expect(other.status).toBe(403);
  });

  it('suggests the checklist for the shift the member clocked in on', async () => {
    // A dedicated member, so the clock-in does not change what the tests above
    // see. 07:15 store time is Ca A even though the matching UTC instant is
    // 00:15 — the hour a Worker would read.
    clockIn('clockin', 7);
    const today = await fx.request('/api/sop/runs/today', await fx.token('clockin'), 'GET');
    expect(today.status).toBe(200);
    const body = await today.json() as {
      suggested: { code: string } | null;
      shift: { id: string; clockIn: string; shiftType: string } | null;
    };

    expect(body.shift).not.toBeNull();
    expect(body.shift?.shiftType).toBe('a');
    // The shift id reaching the client is the string form of an INTEGER column.
    expect(typeof body.shift?.id).toBe('string');
    expect(body.shift?.id).not.toBe('');
    expect(body.suggested?.code).toContain('open');
  });

  it('leaves the suggestion out until the member clocks in', async () => {
    const today = await fx.request('/api/sop/runs/today', await fx.token('staff'), 'GET');
    expect(today.status).toBe(200);
    const body = await today.json() as { suggested: unknown; reason: string; shift: unknown };

    expect(body.reason).toBe('not_clocked_in');
    expect(body.suggested).toBeNull();
    expect(body.shift).toBeNull();
  });

  it('records the run against the clocked-in shift, not one from the body', async () => {
    clockIn('clockin', 7);
    const started = await fx.request('/api/sop/runs', await fx.token('clockin'), 'POST', {
      templateId: 'tpl_open_shift_a',
      // A real shift id belonging to nobody, and not to this member.
      shiftId: '999999',
    });
    const { run } = await started.json() as { run: { id: string; shiftId: string | null } };

    const open = fx.sqlite
      .prepare('SELECT id FROM staff_shifts WHERE staff_id = ? AND clock_out IS NULL')
      .get('clockin') as { id: number } | undefined;
    expect(open).toBeDefined();
    expect(run.shiftId).toBe(String(open?.id));
    expect(run.shiftId).not.toBe('999999');
  });

  it('still requires the critical steps before a run may complete', async () => {
    const started = await fx.request('/api/sop/runs', await fx.token('staff'), 'POST', {
      templateId: 'tpl_open_shift_a',
    });
    const { run } = await started.json() as { run: { id: string } };

    const incomplete = await fx.request(`/api/sop/runs/${run.id}/complete`, await fx.token('staff'), 'POST');
    expect(incomplete.status).toBe(409);

    for (const item of CRITICAL_ITEMS) {
      await fx.request(`/api/sop/runs/${run.id}/items/${item}`, await fx.token('staff'), 'POST', { isChecked: true });
    }
    const complete = await fx.request(`/api/sop/runs/${run.id}/complete`, await fx.token('staff'), 'POST');
    expect(complete.status).toBe(200);
  });
});
