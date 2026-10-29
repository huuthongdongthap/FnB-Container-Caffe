import { describe, expect, it } from 'vitest';
import type { SopTemplate, SopTemplateItem } from '../model/sop-types';
import {
  abandonRun,
  blockingCriticalItems,
  checkItem,
  completeRun,
  computeProgress,
  startRun,
} from '../src/policies/checklist-lifecycle-policy';

function item(overrides: Partial<SopTemplateItem> = {}): SopTemplateItem {
  return {
    id: 'item_1',
    templateId: 'tpl_open',
    label: 'Bật hệ thống',
    description: null,
    requireValue: 0,
    requireNote: 0,
    orderIndex: 0,
    isCritical: 0,
    ...overrides,
  };
}

function template(items: SopTemplateItem[], overrides: Partial<SopTemplate> = {}): SopTemplate {
  return {
    id: 'tpl_open',
    tenantId: 'default',
    code: 'open-shift-a',
    title: 'Mở cửa',
    description: null,
    source: 'SOP01',
    shiftType: 'a',
    applicableRoles: 'owner,manager,staff',
    version: 1,
    isActive: 1,
    items,
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    ...overrides,
  };
}

const NOW = '2026-10-23T06:05:00Z';

function startedRun(items: SopTemplateItem[]): SopRun {
  const result = startRun({
    runId: 'run_1',
    tenantId: 'default',
    template: template(items),
    templateVersion: 1,
    staffId: 'staff_1',
    now: NOW,
  });
  if (!result.ok) throw new Error(`startRun failed: ${result.error}`);
  return result.data;
}

describe('startRun', () => {
  it('creates one unchecked row per template item and pins the template version', () => {
    const run = startedRun([item({ id: 'item_1' }), item({ id: 'item_2' })]);

    expect(run.status).toBe('in_progress');
    expect(run.items).toHaveLength(2);
    expect(run.items.every((row) => row.isChecked === 0)).toBe(true);
    expect(run.templateVersion).toBe(1);
  });

  it('rejects an inactive template', () => {
    const result = startRun({
      runId: 'run_2',
      tenantId: 'default',
      template: template([item()], { isActive: 0 }),
      templateVersion: 1,
      staffId: 'staff_1',
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('template_not_executable');
  });

  it('rejects a template with no items — an empty checklist proves nothing', () => {
    const result = startRun({
      runId: 'run_3',
      tenantId: 'default',
      template: template([]),
      templateVersion: 1,
      staffId: 'staff_1',
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('template_not_executable');
  });
});

describe('checkItem', () => {
  it('records the checking actor and timestamp from the session, not the body', () => {
    const run = startedRun([item({ id: 'item_1' })]);
    const result = checkItem({
      run,
      item: item({ id: 'item_1' }),
      isChecked: true,
      checkedBy: 'staff_1',
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].isChecked).toBe(1);
    expect(result.data.items[0].checkedBy).toBe('staff_1');
    expect(result.data.items[0].checkedAt).toBe(NOW);
  });

  it('requires a note when the template item demands one', () => {
    const run = startedRun([item({ id: 'item_1', requireNote: 1 })]);
    const result = checkItem({
      run,
      item: item({ id: 'item_1', requireNote: 1 }),
      isChecked: true,
      note: '   ',
      checkedBy: 'staff_1',
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('missing_required_detail');
  });

  it('requires a measured value when the template item demands one', () => {
    const run = startedRun([item({ id: 'item_1', requireValue: 1 })]);
    const result = checkItem({
      run,
      item: item({ id: 'item_1', requireValue: 1 }),
      isChecked: true,
      value: '',
      checkedBy: 'staff_1',
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('missing_required_detail');
  });

  it('clears note and value when an item is unticked', () => {
    const spec = { id: 'item_1', requireNote: 1, requireValue: 1 };
    const checked = checkItem({
      run: startedRun([item(spec)]),
      item: item(spec),
      isChecked: true,
      note: '42',
      value: '42',
      checkedBy: 'staff_1',
      now: NOW,
    });
    if (!checked.ok) throw new Error('setup failed');

    const unticked = checkItem({
      run: checked.data,
      item: item(spec),
      isChecked: false,
      checkedBy: 'staff_1',
      now: NOW,
    });

    expect(unticked.ok).toBe(true);
    if (!unticked.ok) return;
    expect(unticked.data.items[0].isChecked).toBe(0);
    expect(unticked.data.items[0].note).toBeNull();
    expect(unticked.data.items[0].value).toBeNull();
  });

  it('refuses to mutate an item after the run is completed', () => {
    const items = [item({ id: 'item_1' })];
    const run = startedRun(items);
    const completed = completeRun({ run, templateItems: items, completedBy: 'staff_1', now: NOW });
    if (!completed.ok) throw new Error('setup failed');

    const result = checkItem({
      run: completed.data,
      item: item({ id: 'item_1' }),
      isChecked: false,
      checkedBy: 'staff_1',
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('run_immutable');
  });
});

describe('completeRun', () => {
  it('blocks completion while a critical item is unticked', () => {
    const items = [item({ id: 'item_1', isCritical: 1 }), item({ id: 'item_2' })];
    const run = startedRun(items);
    const partial = checkItem({
      run,
      item: item({ id: 'item_2' }),
      isChecked: true,
      checkedBy: 'staff_1',
      now: NOW,
    });
    if (!partial.ok) throw new Error('setup failed');

    const result = completeRun({ run: partial.data, templateItems: items, completedBy: 'staff_1', now: NOW });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('critical_items_incomplete');
    expect(blockingCriticalItems(partial.data, items)).toHaveLength(1);
  });

  it('completes once every critical item is ticked, leaving optional items unchecked', () => {
    const items = [item({ id: 'item_1', isCritical: 1 }), item({ id: 'item_2' })];
    const run = startedRun(items);
    const ticked = checkItem({
      run,
      item: item({ id: 'item_1', isCritical: 1 }),
      isChecked: true,
      checkedBy: 'staff_1',
      now: NOW,
    });
    if (!ticked.ok) throw new Error('setup failed');

    const result = completeRun({ run: ticked.data, templateItems: items, completedBy: 'staff_1', now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('completed');
    expect(result.data.completedAt).toBe(NOW);
    expect(result.data.completedBy).toBe('staff_1');
  });

  it('blocks completion when a ticked item is missing its required detail', () => {
    const items = [item({ id: 'item_1', requireNote: 1 })];
    const run = startedRun(items);
    const ticked = checkItem({
      run,
      item: item({ id: 'item_1', requireNote: 1 }),
      isChecked: true,
      note: 'ok',
      checkedBy: 'staff_1',
      now: NOW,
    });
    if (!ticked.ok) throw new Error('setup failed');

    // Simulate a row written by an older client that skipped the note.
    const stripped = {
      ...ticked.data,
      items: ticked.data.items.map((row) => ({ ...row, note: null })),
    };
    const result = completeRun({ run: stripped, templateItems: items, completedBy: 'staff_1', now: NOW });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('missing_required_detail');
  });

  it('refuses to complete a run twice — completed runs are immutable', () => {
    const items = [item({ id: 'item_1' })];
    const run = startedRun(items);
    const first = completeRun({ run, templateItems: items, completedBy: 'staff_1', now: NOW });
    if (!first.ok) throw new Error('setup failed');

    const second = completeRun({ run: first.data, templateItems: items, completedBy: 'staff_1', now: NOW });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('run_immutable');
  });
});

describe('abandonRun', () => {
  it('requires a reason so the gap stays auditable', () => {
    const run = startedRun([item()]);
    const result = abandonRun({ run, reason: '  ', now: NOW });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('reason_required');
  });

  it('records the reason and becomes immutable', () => {
    const run = startedRun([item()]);
    const abandoned = abandonRun({ run, reason: 'Mất điện', now: NOW });
    if (!abandoned.ok) throw new Error('setup failed');

    expect(abandoned.data.status).toBe('abandoned');
    expect(abandoned.data.abandonReason).toBe('Mất điện');

    const again = completeRun({ run: abandoned.data, templateItems: [item()], completedBy: 'staff_1', now: NOW });
    expect(again.ok).toBe(false);
  });
});

describe('computeProgress', () => {
  it('reports the share of template items ticked', () => {
    const items = [item({ id: 'item_1' }), item({ id: 'item_2' }), item({ id: 'item_3' })];
    const run = startedRun(items);
    const ticked = checkItem({
      run,
      item: item({ id: 'item_1' }),
      isChecked: true,
      checkedBy: 'staff_1',
      now: NOW,
    });
    if (!ticked.ok) throw new Error('setup failed');

    expect(computeProgress(ticked.data, items)).toBe(33);
  });

  it('returns 0 for a template with no items rather than dividing by zero', () => {
    expect(computeProgress(startedRun([item()]), [])).toBe(0);
  });
});
