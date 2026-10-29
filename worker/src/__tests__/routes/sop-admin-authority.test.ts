// @vitest-environment node
/**
 * Authority tests for the SOP admin surface.
 *
 * The point of these is not "the route answers" but that the server refuses the
 * transitions the paper SOP reserves for a higher role: a manager may not
 * terminate a staff member, and the recorder may not confirm their own record.
 * Both are refused before any statement runs, so the test asserts a 4xx rather
 * than inspecting the database for an absent row.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';

const OWNER = 'owner';
const MANAGER = 'manager';
const WAITER = 'staff';

describe('sop admin authority', () => {
  let fx: ReturnType<typeof staffSessionFixture>;

  beforeAll(async () => {
    fx = staffSessionFixture();
    applySopMigrations(fx.sqlite);
  });

  it('refuses an unauthenticated caller before reaching the register', async () => {
    const res = await fx.request('/api/sop/admin/violations');
    expect(res.status).toBe(401);
  });

  it('refuses a staff member from the violation register entirely', async () => {
    const res = await fx.request('/api/sop/admin/violations', await fx.token(WAITER));
    expect(res.status).toBe(403);
  });

  it('lets a manager record a breach the ladder resolves server-side', async () => {
    const res = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: WAITER,
      category: 'time',
      isSerious: false,
      note: 'Late for opening shift',
      occurredAt: '2026-10-24T09:00:00.000Z',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string; disciplineStep: string; status: string } };
    expect(body.data.status).toBe('recorded');
    // First offence in the month and not serious, so the ladder starts low.
    expect(body.data.disciplineStep).toBe('written_warning');
  });

  it('refuses the recorder confirming their own record', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: WAITER,
      category: 'conduct',
      isSerious: false,
      note: 'Refused handover',
      occurredAt: '2026-10-24T09:30:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };

    const own = await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(MANAGER), 'POST');
    expect(own.status).toBe(403);

    const byOwner = await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(OWNER), 'POST');
    expect(byOwner.status).toBe(200);
  });

  it('refuses a manager applying a termination — owner only', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(MANAGER), 'POST', {
      staffId: WAITER,
      category: 'time',
      isSerious: false,
      note: 'Third lateness',
      occurredAt: '2026-10-24T10:00:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };
    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(OWNER), 'POST');

    const asManager = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(MANAGER), 'POST', {
      step: 'termination',
    });
    expect(asManager.status).toBe(403);

    const asOwner = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', {
      step: 'fine',
    });
    expect(asOwner.status).toBe(200);
  });

  it('refuses the ladder from running twice on one record', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(OWNER), 'POST', {
      staffId: WAITER,
      category: 'time',
      isSerious: false,
      note: 'Second offence',
      occurredAt: '2026-10-24T11:00:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };
    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(MANAGER), 'POST');
    const first = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', { step: 'fine' });
    expect(first.status).toBe(200);

    const again = await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', { step: 'termination' });
    expect(again.status).toBe(409);
  });

  it('records the staff member appeal before the file is closed', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token(OWNER), 'POST', {
      staffId: WAITER,
      category: 'assets_finance',
      isSerious: true,
      note: 'Drawer short',
      occurredAt: '2026-10-24T12:00:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string; disciplineStep: string } };
    // A serious breach skips the ladder regardless of prior count.
    expect(data.disciplineStep).toBe('termination');

    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token(MANAGER), 'POST');
    await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token(OWNER), 'POST', { step: 'termination' });

    const appeal = await fx.request(`/api/sop/admin/violations/${data.id}/appeal`, await fx.token(MANAGER), 'POST', {
      appealExplanation: 'The drawer was counted before my shift started',
    });
    expect(appeal.status).toBe(200);

    const closed = await fx.request(`/api/sop/admin/violations/${data.id}/close`, await fx.token(OWNER), 'POST');
    expect(closed.status).toBe(200);
    // A closed file is terminal: closing again is refused, never a silent no-op.
    const twice = await fx.request(`/api/sop/admin/violations/${data.id}/close`, await fx.token(OWNER), 'POST');
    expect(twice.status).toBe(409);
  });

  it('hides the template authoring endpoints from the floor', async () => {
    const res = await fx.request('/api/sop/admin/templates', await fx.token(WAITER));
    expect(res.status).toBe(403);
  });
});
