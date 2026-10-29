import { describe, expect, it } from 'vitest';
import type {
  SopRunItemRow,
  SopRunRow,
  SopTemplateItemRow,
  SopTemplateRow,
  SopViolationRow,
} from '../src/model/sop-row-mapper';
import { toRun, toTemplate, toViolation } from '../src/model/sop-row-mapper';

function templateRow(overrides: Partial<SopTemplateRow> = {}): SopTemplateRow {
  return {
    id: 'tpl_1',
    tenant_id: 'default',
    code: 'open-shift-a',
    title: 'Mở cửa',
    description: null,
    source: 'SOP01',
    shift_type: 'a',
    applicable_roles: 'owner,manager,staff',
    version: 1,
    is_active: 1,
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
    ...overrides,
  };
}

function itemRow(overrides: Partial<SopTemplateItemRow> = {}): SopTemplateItemRow {
  return {
    id: 'ti_1',
    tenant_id: 'default',
    template_id: 'tpl_1',
    label: 'A1',
    description: null,
    order_index: 1,
    is_critical: 0,
    requires_note: 0,
    requires_value: 0,
    created_at: null,
    ...overrides,
  };
}

function runRow(overrides: Partial<SopRunRow> = {}): SopRunRow {
  return {
    id: 'run_1',
    tenant_id: 'default',
    template_id: 'tpl_1',
    template_version: 1,
    shift_id: null,
    staff_id: 'USR_1',
    staff_name: 'T',
    shift_type: 'a',
    status: 'in_progress',
    scheduled_date: '2026-10-23',
    started_at: '2026-10-23T06:00:00Z',
    completed_at: null,
    abandoned_reason: null,
    reminder_sent_at: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function runItemRow(overrides: Partial<SopRunItemRow> = {}): SopRunItemRow {
  return {
    id: 'run_1:ti_1',
    tenant_id: 'default',
    run_id: 'run_1',
    template_item_id: 'ti_1',
    is_checked: 0,
    checked_at: null,
    checked_by: null,
    note: null,
    value: null,
    created_at: null,
    ...overrides,
  };
}

describe('toTemplate', () => {
  it('renames requires_note/requires_value to the require* policy spelling', () => {
    const template = toTemplate(templateRow(), [
      itemRow({ requires_note: 1, requires_value: 1 }),
    ]);

    expect(template.items[0].requireNote).toBe(1);
    expect(template.items[0].requireValue).toBe(1);
  });

  it('sorts items by order_index regardless of row order', () => {
    const template = toTemplate(templateRow(), [
      itemRow({ id: 'ti_c', order_index: 3 }),
      itemRow({ id: 'ti_a', order_index: 1 }),
      itemRow({ id: 'ti_b', order_index: 2 }),
    ]);

    expect(template.items.map((item) => item.id)).toEqual(['ti_a', 'ti_b', 'ti_c']);
  });

  it("collapses the seeded shift_type 'monthly' to 'any' so the policy sees a value it knows", () => {
    // The migration seeds the day-15 and day-30 duties with 'monthly'; the
    // domain union is 'a' | 'b' | 'c' | 'any'.
    const template = toTemplate(templateRow({ shift_type: 'monthly' }), [itemRow()]);

    expect(template.shiftType).toBe('any');
  });

  it('keeps a real shift type untouched', () => {
    expect(toTemplate(templateRow({ shift_type: 'b' }), [itemRow()]).shiftType).toBe('b');
  });
});

describe('toRun', () => {
  it('renames snake_case columns to the camelCase run spelling', () => {
    const run = toRun(runRow());

    expect(run.templateId).toBe('tpl_1');
    expect(run.templateVersion).toBe(1);
    expect(run.staffId).toBe('USR_1');
    expect(run.startedAt).toBe('2026-10-23T06:00:00Z');
    expect(run.abandonReason).toBeNull();
  });

  it('orders items by the supplied template order, not by insertion order', () => {
    const run = toRun(
      runRow(),
      [runItemRow({ id: 'r:b', template_item_id: 'b' }), runItemRow({ id: 'r:a', template_item_id: 'a' })],
      [],
      ['a', 'b']
    );

    expect(run.items.map((item) => item.templateItemId)).toEqual(['a', 'b']);
  });

  it('sends items with no known template position to the end', () => {
    const run = toRun(runRow(), [runItemRow({ id: 'x', template_item_id: 'orphan' })], [], ['a']);

    expect(run.items).toHaveLength(1);
  });

  it('keeps a stored REAL measurement as a numeric string so 0 survives', () => {
    // 0 is a legitimate stocktake count; a falsy check would drop it and the
    // policy would then report the required detail as missing.
    const run = toRun(runRow(), [runItemRow({ value: 0 })]);

    expect(run.items[0].value).toBe('0');
  });

  it('leaves an absent value null rather than NaN', () => {
    expect(toRun(runRow(), [runItemRow({ value: null })]).items[0].value).toBeNull();
  });

  it('reports abandonedAt and completedBy as null because the table has no such column', () => {
    const run = toRun(runRow({ status: 'completed', completed_at: '2026-10-23T07:00:00Z' }));

    expect(run.abandonedAt).toBeNull();
    expect(run.completedBy).toBeNull();
  });
});

describe('toViolation', () => {
  it('maps the description column to the note field the policy reads', () => {
    const row: SopViolationRow = {
      id: 'vio_1',
      tenant_id: 'default',
      staff_id: 'USR_1',
      staff_name: 'T',
      category: 'conduct',
      is_serious: 0,
      description: 'đi muộn',
      occurred_at: '2026-10-23T08:00:00Z',
      recorded_by: 'USR_2',
      status: 'recorded',
      discipline_step: null,
      confirmed_by: null,
      confirmed_at: null,
      applied_by: null,
      applied_at: null,
      appeal_explanation: null,
      audit_log_id: null,
      closed_at: null,
      created_at: null,
      updated_at: null,
    };

    const violation = toViolation(row);

    expect(violation.note).toBe('đi muộn');
    expect(violation.disciplineStep).toBe('none');
    expect(violation.status).toBe('recorded');
  });
});
