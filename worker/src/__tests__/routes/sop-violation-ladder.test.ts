// @vitest-environment node
/**
 * The staff member's side of the discipline ladder.
 *
 * The ladder above is covered by `sop-admin-authority.test.ts`, which asks
 * whether the server refuses transitions the paper SOP reserves for a higher
 * role. These ask the opposite: whether the employee can actually exercise the
 * rights the paper SOP gives them — read the file they are named in, answer it
 * before a sanction lands, and have the answer kept. Each test is named for the
 * behaviour it pins, and each was confirmed to fail when the fix behind it was
 * reverted (see the comment on the test that covers the ladder count, which is
 * the one no earlier suite caught).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';

const OWNER = 'owner';
const MANAGER = 'manager';
const STAFF = 'staff';
/** Same store as STAFF, so an ownership refusal is a 403 rather than a 404. */
const SAME_STORE_STAFF = 'staff2';
const OTHER_STAFF = 'other';

describe('staff violation rights', () => {
  let fx: ReturnType<typeof staffSessionFixture>;

  beforeAll(() => {
    fx = staffSessionFixture();
    applySopMigrations(fx.sqlite);
  });

  /** Records, confirms and applies a breach, returning the violation id. */
  async function appliedFile(
    category: 'time' | 'conduct' | 'assets_finance' | 'stimulants' | 'workspace',
    step: 'written_warning' | 'fine' | 'termination',
    note: string,
    occurredAt: string
  ): Promise<string> {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: STAFF,
      category,
      note,
      occurredAt,
    });
    const { data } = await created.json() as { data: { id: string; disciplineStep: string } };
    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(OWNER), 'POST');
    await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', { step });
    return data.id;
  }

  // ── Reading one's own file ──

  it('lets the named staff member read the conduct file about them', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: STAFF,
      category: 'workspace',
      note: 'Sat at a customer table in uniform',
      occurredAt: '2026-10-25T09:00:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };

    const res = await fx.request(`/api/sop/violations/${data.id}`, await fx.token(STAFF));
    expect(res.status).toBe(200);
    const body = await res.json() as { violation: { note: string }; data: { item: { note: string } } };
    // The mobile surface returns the record top-level as `violation` and mirrored
    // under `data.item`, matching the checklist handlers.
    expect(body.violation.note).toBe('Sat at a customer table in uniform');
    expect(body.data.item.note).toBe('Sat at a customer table in uniform');
  });

  it('refuses a staff member another member\'s conduct file', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: STAFF,
      category: 'time',
      note: 'Late for opening',
      occurredAt: '2026-10-25T09:30:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };

    // Same store, not their file: the ownership check refuses it as 403.
    const sameTenant = await fx.request(`/api/sop/violations/${data.id}`, await fx.token(SAME_STORE_STAFF));
    expect(sameTenant.status).toBe(403);

    // Another store's member cannot even tell the id exists — tenant scoping
    // refuses it as 404, which is the stronger guarantee of the two.
    const foreignTenant = await fx.request(`/api/sop/violations/${data.id}`, await fx.token(OTHER_STAFF));
    expect(foreignTenant.status).toBe(404);
  });

  // ── The right of reply ──

  it('lets the staff member appeal their own applied sanction', async () => {
    const id = await appliedFile('conduct', 'fine', 'Spoke sharply to a customer', '2026-10-25T10:00:00.000Z');

    const res = await fx.request(`/api/sop/violations/${id}/appeal`, await fx.token(STAFF), 'POST', {
      appealExplanation: 'The customer had already been asked twice to leave',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string; appealExplanation: string } };
    expect(body.data.status).toBe('appealed');
    expect(body.data.appealExplanation).toBe('The customer had already been asked twice to leave');
  });

  it('refuses a staff member appealing on another member\'s behalf', async () => {
    const id = await appliedFile('time', 'fine', 'Left early without relief', '2026-10-25T10:30:00.000Z');

    // Nobody may answer for somebody else, in this store or another one.
    const sameTenant = await fx.request(`/api/sop/violations/${id}/appeal`, await fx.token(SAME_STORE_STAFF), 'POST', {
      appealExplanation: 'I will answer for them instead',
    });
    expect(sameTenant.status).toBe(403);

    const foreignTenant = await fx.request(`/api/sop/violations/${id}/appeal`, await fx.token(OTHER_STAFF), 'POST', {
      appealExplanation: 'I will answer for them instead',
    });
    expect(foreignTenant.status).toBe(404);
  });

  it('refuses an appeal with no explanation — the reply is the point of the right', async () => {
    const id = await appliedFile('time', 'written_warning', 'Late to handover', '2026-10-25T11:00:00.000Z');

    const res = await fx.request(`/api/sop/violations/${id}/appeal`, await fx.token(STAFF), 'POST', {
      appealExplanation: '   ',
    });
    expect(res.status).toBe(400);
  });

  // ── The recorder's words survive the sanction ──

  it('keeps the recorder\'s description and stores the applier\'s note apart from it', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: STAFF,
      category: 'conduct',
      note: 'Refused the opening handover',
      occurredAt: '2026-10-25T11:30:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };
    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(OWNER), 'POST');

    const res = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', {
      step: 'written_warning',
      sanctionNote: 'First warning issued, signed by the owner',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { note: string; sanctionNote: string } };
    expect(body.data.note).toBe('Refused the opening handover');
    expect(body.data.sanctionNote).toBe('First warning issued, signed by the owner');
  });

  // ── The ladder counts what it should ──

  /**
   * The one no earlier suite caught. Closing a file settles it, it does not
   * delete it, so a first offence that has been closed must still push the next
   * offence in the same month a rung up. Reverting the status filter in
   * `countConfirmedInMonth` to the two states that were open when it was written
   * (`confirmed`, `applied`) leaves this red while every other suite stays green.
   *
   * It uses its own staff member and its own month: the ladder counts offences
   * for one person within one calendar month, so a member earlier tests have
   * already filed against would arrive at the count from the wrong end.
   */
  it('counts a closed first offence toward the same month\'s ladder', async () => {
    const first = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: SAME_STORE_STAFF,
      category: 'time',
      note: 'First lateness',
      occurredAt: '2026-09-25T12:00:00.000Z',
    });
    const { data: firstData } = await first.json() as { data: { id: string } };
    await fx.request(`/api/sop/admin/violations/${firstData.id}/confirm`, await fx.token(OWNER), 'POST');
    await fx.request(`/api/sop/admin/violations/${firstData.id}/apply`, await fx.token(OWNER), 'POST', { step: 'written_warning' });
    await fx.request(`/api/sop/admin/violations/${firstData.id}/close`, await fx.token(OWNER), 'POST');

    const second = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: SAME_STORE_STAFF,
      category: 'time',
      note: 'Second lateness',
      occurredAt: '2026-09-25T12:30:00.000Z',
    });
    const { data: secondData } = await second.json() as { data: { disciplineStep: string } };
    expect(secondData.disciplineStep).toBe('fine');
  });

  // ── Seriousness is the category's call, not the request's ──

  it('resolves a serious category to termination without any flag in the request', async () => {
    const res = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: STAFF,
      category: 'stimulants',
      note: 'Drinking on shift',
      occurredAt: '2026-10-25T13:00:00.000Z',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { disciplineStep: string; isSerious: number } };
    expect(body.data.disciplineStep).toBe('termination');
    expect(body.data.isSerious).toBe(1);
  });

  // ── A dismissal is the owner's alone, and says so as the wrong-role refusal ──

  it('refuses a manager applying a termination as the wrong role, not the wrong state', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: STAFF,
      category: 'time',
      note: 'Third lateness',
      occurredAt: '2026-10-25T13:30:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };

    // Before the record is confirmed, both refusals apply at once. The role one
    // must win: it is the answer that stays true however long the manager waits
    // and retries, whereas the state one only says "not yet".
    const unconfirmed = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(MANAGER), 'POST', {
      step: 'termination',
    });
    expect(unconfirmed.status).toBe(403);

    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(OWNER), 'POST');

    const res = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(MANAGER), 'POST', {
      step: 'termination',
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Only the owner may dismiss a staff member');
  });

  it('keeps the ladder from running twice on one record', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(OWNER), 'POST', {
      staffId: STAFF,
      category: 'time',
      note: 'Second offence',
      occurredAt: '2026-10-25T14:00:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };
    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(MANAGER), 'POST');
    const first = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', { step: 'fine' });
    expect(first.status).toBe(200);

    const again = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', { step: 'termination' });
    expect(again.status).toBe(409);
  });
});
