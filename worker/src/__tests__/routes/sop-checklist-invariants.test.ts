// @vitest-environment node
/**
 * Invariants of the staff-facing checklist surface.
 *
 * Two of these are security boundaries rather than behaviour: nothing in the
 * body may choose which staff member the run belongs to, and nothing may name
 * the person who ticked an item — both come from the session. The third is the
 * one the paper SOP actually stands on: a checklist with an unticked critical
 * item cannot be completed, because "opened the shift" is not evidence that the
 * KDS was checked.
 *
 * The seeded templates belong to the `default` tenant — the flagship container
 * in `20261004_01_multi_tenant_franchise.sql` — while the shared session
 * fixture mints its users under throwaway tenants, so this suite moves those
 * users to `default` before it starts rather than seeding its own templates.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';

/** The seeded opening checklist: system and KDS are critical, the rest are not. */
const OPEN_TEMPLATE = 'tpl_open_shift_a';
const CRITICAL_ITEMS = ['ti_open_system', 'ti_open_kds'];
const PLAIN_ITEM = 'ti_open_ingredients';

describe('sop checklist invariants', () => {
  let fx: ReturnType<typeof staffSessionFixture>;

  beforeAll(async () => {
    fx = staffSessionFixture();
    applySopMigrations(fx.sqlite);
    fx.sqlite
      .prepare('UPDATE users SET tenant_id = ? WHERE id IN (?, ?, ?, ?)')
      .run('default', 'owner', 'staff', 'manager', 'other');
  });

  async function startRun(staffId = 'staff', templateId = OPEN_TEMPLATE) {
    const res = await fx.request('/api/sop/runs', await fx.token(staffId), 'POST', { templateId });
    expect(res.status).toBe(200);
    const body = await res.json() as { run: { id: string } };
    return body.run.id;
  }

  it('refuses an unauthenticated caller before it will list templates', async () => {
    const res = await fx.request('/api/sop/templates');
    expect(res.status).toBe(401);
  });

  it('lists only the templates this store has defined', async () => {
    const res = await fx.request('/api/sop/templates', await fx.token('staff'));
    expect(res.status).toBe(200);
    const body = await res.json() as { templates: { code: string }[] };
    expect(body.templates.map((t) => t.code)).toContain('open-shift-a');
  });

  it('takes the staff member from the session, ignoring a body that names another', async () => {
    const res = await fx.request('/api/sop/runs', await fx.token('staff'), 'POST', {
      templateId: OPEN_TEMPLATE,
      staffId: 'owner',
      checkedBy: 'owner',
      tenantId: 'cafe-b',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { run: { staffId: string; tenantId: string } };
    // Had the body been trusted, the run would sit under the owner's name and in
    // another store's tenant, where this staff member has no read access.
    expect(body.run.staffId).toBe('staff');
    expect(body.run.tenantId).toBe('default');
  });

  it('takes who ticked an item from the session, not the body', async () => {
    const runId = await startRun();
    const res = await fx.request(`/api/sop/runs/${runId}/items/${PLAIN_ITEM}`, await fx.token('staff'), 'POST', {
      isChecked: true,
      checkedBy: 'owner',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { run: { items: { templateItemId: string; checkedBy: string }[] } };
    const ticked = body.run.items.find((i) => i.templateItemId === PLAIN_ITEM);
    expect(ticked?.checkedBy).toBe('staff');
  });

  it('refuses to complete a checklist with an unticked critical item', async () => {
    const runId = await startRun();
    const tickPlain = await fx.request(`/api/sop/runs/${runId}/items/${PLAIN_ITEM}`, await fx.token('staff'), 'POST', { isChecked: true });
    expect(tickPlain.status).toBe(200);

    const blocked = await fx.request(`/api/sop/runs/${runId}/complete`, await fx.token('staff'), 'POST');
    expect(blocked.status).toBe(409);
    const body = await blocked.json() as { error: string };
    // The critical item is reported as an unfinished required step, not named
    // explicitly — the message has to stay right for a note- or value-bound item
    // whose blocker is a missing measurement rather than an unticked box.
    expect(body.error).toMatch(/required step/i);

    // Both critical items must be ticked: the paper SOP marks the system check
    // and the KDS check as blocking, so ticking one still cannot complete.
    for (const item of CRITICAL_ITEMS) {
      const tickCritical = await fx.request(`/api/sop/runs/${runId}/items/${item}`, await fx.token('staff'), 'POST', { isChecked: true });
      expect(tickCritical.status).toBe(200);
    }
    const done = await fx.request(`/api/sop/runs/${runId}/complete`, await fx.token('staff'), 'POST');
    expect(done.status).toBe(200);
  });

  it('holds a terminal run immutable — a completed run cannot be re-ticked', async () => {
    const runId = await startRun();
    for (const item of CRITICAL_ITEMS) {
      await fx.request(`/api/sop/runs/${runId}/items/${item}`, await fx.token('staff'), 'POST', { isChecked: true });
    }
    const done = await fx.request(`/api/sop/runs/${runId}/complete`, await fx.token('staff'), 'POST');
    expect(done.status).toBe(200);

    const retick = await fx.request(`/api/sop/runs/${runId}/items/${PLAIN_ITEM}`, await fx.token('staff'), 'POST', { isChecked: true });
    expect(retick.status).toBe(409);
    const recomplete = await fx.request(`/api/sop/runs/${runId}/complete`, await fx.token('staff'), 'POST');
    expect(recomplete.status).toBe(409);
  });

  it('keeps one staff member out of another staff member’s run', async () => {
    const runId = await startRun('staff');
    const res = await fx.request(`/api/sop/runs/${runId}/items/${PLAIN_ITEM}`, await fx.token('other'), 'POST', { isChecked: true });
    // Same tenant, so the run is readable — but `other` is neither the staff
    // member it belongs to nor a manager, and the policy refuses on that basis.
    expect(res.status).toBe(403);
  });

  it('requires a reason before a checklist may be abandoned', async () => {
    const runId = await startRun();
    const noReason = await fx.request(`/api/sop/runs/${runId}/abandon`, await fx.token('staff'), 'POST', {});
    expect(noReason.status).toBe(400);
    const withReason = await fx.request(`/api/sop/runs/${runId}/abandon`, await fx.token('staff'), 'POST', {
      reason: 'Store alarm went off, shift cut short',
    });
    expect(withReason.status).toBe(200);
  });
});
