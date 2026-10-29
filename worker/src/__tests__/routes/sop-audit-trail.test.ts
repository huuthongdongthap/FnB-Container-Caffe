// @vitest-environment node
/**
 * The SOP audit trail.
 *
 * A completed checklist is the compliance evidence this feature exists to
 * produce, so the trail is part of the write and not a report reconstructed
 * afterwards. These tests assert the row appears at all, and that it names the
 * right resource — whichever of the three `audit_logs` schemas this database
 * happens to be running, because the writer falls through them in order and the
 * shape an older deployment carries is not knowable here.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';

const CRITICAL_ITEMS = ['ti_open_system', 'ti_open_kds'];

describe('sop audit trail', () => {
  let fx: ReturnType<typeof staffSessionFixture>;

  beforeAll(async () => {
    fx = staffSessionFixture();
    applySopMigrations(fx.sqlite);
    fx.sqlite
      .prepare('UPDATE users SET tenant_id = ? WHERE id IN (?, ?, ?, ?)')
      .run('default', 'owner', 'staff', 'manager', 'other');
  });

  interface AuditRow {
    id: string;
    action: string;
    resource_id: string | null;
    entity_id: string | null;
  }

  /** The three schemas differ in column name, so read whichever exists. */
  function auditRows(): AuditRow[] {
    const raw = fx.sqlite
      .prepare('SELECT * FROM audit_logs ORDER BY rowid DESC LIMIT 20')
      .all() as Record<string, unknown>[];
    return raw.map((row) => ({
      id: String(row.id ?? ''),
      action: String(row.action ?? ''),
      resource_id: (row.resource_id ?? row.entity_id ?? null) as string | null,
      entity_id: (row.entity_id ?? null) as string | null,
    }));
  }

  it('records the run it started, then the completion that closed it', async () => {
    const started = await fx.request('/api/sop/runs', await fx.token('staff'), 'POST', {
      templateId: 'tpl_open_shift_a',
    });
    const { run } = await started.json() as { run: { id: string } };

    for (const item of CRITICAL_ITEMS) {
      await fx.request(`/api/sop/runs/${run.id}/items/${item}`, await fx.token('staff'), 'POST', { isChecked: true });
    }
    const done = await fx.request(`/api/sop/runs/${run.id}/complete`, await fx.token('staff'), 'POST');
    expect(done.status).toBe(200);

    const rows = auditRows();
    const forRun = rows.filter((row) => row.resource_id === run.id);
    // The start, two ticks and the completion.
    expect(forRun.length).toBeGreaterThanOrEqual(4);
    const actions = forRun.map((row) => row.action);
    expect(actions).toContain('sop_run.started');
    expect(actions).toContain('sop_run.item_checked');
    expect(actions).toContain('sop_run.completed');
  });

  it('records every rung of the ladder against the violation it belongs to', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token('owner'), 'POST', {
      staffId: 'staff',
      category: 'assets_finance',
      isSerious: false,
      note: 'Reported short',
      occurredAt: '2026-10-24T12:00:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };
    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token('manager'), 'POST');
    await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token('owner'), 'POST', { step: 'written_warning' });
    await fx.request(`/api/sop/admin/violations/${data.id}/close`, await fx.token('owner'), 'POST');

    const actions = auditRows()
      .filter((row) => row.resource_id === data.id)
      .map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining([
      'sop_violation.recorded',
      'sop_violation.confirmed',
      'sop_violation.applied',
      'sop_violation.closed',
    ]));
  });

  it('keeps the staff member’s own words out of the log', async () => {
    const created = await fx.request('/api/sop/admin/violations', await fx.token('owner'), 'POST', {
      staffId: 'staff',
      category: 'conduct',
      isSerious: false,
      note: 'Refused handover',
      occurredAt: '2026-10-24T13:00:00.000Z',
    });
    const { data } = await created.json() as { data: { id: string } };
    await fx.request(`/api/sop/admin/violations/${data.id}/confirm`, await fx.token('manager'), 'POST');
    await fx.request(`/api/sop/admin/violations/${data.id}/apply`, await fx.token('owner'), 'POST', { step: 'fine' });
    await fx.request(`/api/sop/admin/violations/${data.id}/appeal`, await fx.token('manager'), 'POST', {
      appealExplanation: 'A private explanation naming another colleague',
    });

    const appealRows = fx.sqlite
      .prepare('SELECT * FROM audit_logs WHERE action = ?')
      .all('sop_violation.appealed');
    expect(appealRows.length).toBe(1);
    // The explanation lives on the violation row; the log only records that an
    // appeal was made, so a log reader cannot mine staff statements from it.
    expect(JSON.stringify(appealRows[0])).not.toContain('private explanation');
  });
});
