import { describe, expect, it } from 'vitest';
import type { SopTemplate } from '../model/sop-types';
import {
  deriveShiftType,
  isAuditDay,
  isDeepCleanDay,
  isOverdue,
  nextAudit,
  nextDeepClean,
  sopForShift,
} from '../src/policies/recurrence-policy';

function template(overrides: Partial<SopTemplate>): SopTemplate {
  return {
    id: 'tpl_1',
    tenantId: 'default',
    code: 'open-shift-a',
    title: 'Mở cửa',
    description: null,
    source: 'SOP01',
    shiftType: 'a',
    applicableRoles: 'owner,manager,staff',
    version: 1,
    isActive: 1,
    items: [],
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    ...overrides,
  };
}

describe('isDeepCleanDay', () => {
  it('fires on the 15th', () => {
    expect(isDeepCleanDay(new Date(2026, 9, 15, 8, 0))).toBe(true);
  });

  it('does not fire on neighbouring days', () => {
    expect(isDeepCleanDay(new Date(2026, 9, 14, 8, 0))).toBe(false);
    expect(isDeepCleanDay(new Date(2026, 9, 16, 8, 0))).toBe(false);
  });
});

describe('isAuditDay', () => {
  it('fires on the 30th', () => {
    expect(isAuditDay(new Date(2026, 9, 30, 8, 0))).toBe(true);
  });

  it('falls back to the last day in a month with no 30th', () => {
    expect(isAuditDay(new Date(2026, 1, 28, 8, 0))).toBe(true);
    // 2027 February also ends on the 28th — same rule, different year.
    expect(isAuditDay(new Date(2027, 1, 28, 8, 0))).toBe(true);
    // A short month still requires the fallback day, not the 30th.
    expect(isAuditDay(new Date(2027, 1, 27, 8, 0))).toBe(false);
  });

  it('handles February in a leap year', () => {
    expect(isAuditDay(new Date(2028, 1, 29, 8, 0))).toBe(true);
    expect(isAuditDay(new Date(2028, 1, 28, 8, 0))).toBe(false);
  });

  it('keeps the 30th in a 31-day month rather than sliding to the last day', () => {
    expect(isAuditDay(new Date(2026, 2, 30, 8, 0))).toBe(true);
    expect(isAuditDay(new Date(2026, 2, 31, 8, 0))).toBe(false);
  });
});

describe('nextDeepClean / nextAudit', () => {
  it('points at this month when the day is still ahead', () => {
    const next = nextDeepClean(new Date(2026, 9, 3, 8, 0));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(9);
    expect(next.getDate()).toBe(15);
  });

  it('rolls into next month once the day has passed', () => {
    const next = nextDeepClean(new Date(2026, 9, 20, 8, 0));
    expect(next.getMonth()).toBe(10);
    expect(next.getDate()).toBe(15);
  });

  it('finds the next audit day across a short month', () => {
    const next = nextAudit(new Date(2027, 1, 28, 8, 0));
    expect(next.getMonth()).toBe(2);
    expect(next.getDate()).toBe(30);
  });
});

describe('deriveShiftType', () => {
  it('maps operating hours onto Ca A and Ca B', () => {
    expect(deriveShiftType(6)).toBe('a');
    expect(deriveShiftType(13)).toBe('a');
    expect(deriveShiftType(14)).toBe('b');
    expect(deriveShiftType(21)).toBe('b');
  });

  it('treats after-hours as Ca C — a 01:00 close belongs to the evening shift', () => {
    expect(deriveShiftType(1)).toBe('c');
    expect(deriveShiftType(22)).toBe('c');
  });

  it('puts the boundary exactly at 14:00 in Ca B, not Ca A', () => {
    expect(deriveShiftType(13)).toBe('a');
    expect(deriveShiftType(14)).toBe('b');
  });
});

describe('sopForShift', () => {
  const templates = [
    template({ id: 'tpl_open', code: 'open-shift-a', shiftType: 'a' }),
    template({ id: 'tpl_close', code: 'close-shift', shiftType: 'b' }),
    template({ id: 'tpl_deep', code: 'deep-clean-m15', shiftType: 'any' }),
  ];

  it('suggests the opening checklist for a Ca A operator', () => {
    const match = sopForShift({
      templates,
      shiftType: 'a',
      role: 'staff',
      date: new Date(2026, 9, 10, 7, 0),
    });

    expect(match.template?.code).toBe('open-shift-a');
    expect(match.reason).toBe('shift_template');
  });

  it('suggests the closing checklist for a Ca B operator', () => {
    const match = sopForShift({
      templates,
      shiftType: 'b',
      role: 'staff',
      date: new Date(2026, 9, 10, 15, 0),
    });

    expect(match.template?.code).toBe('close-shift');
  });

  it('surfaces the deep-clean template on the 15th regardless of shift', () => {
    const match = sopForShift({
      templates,
      shiftType: 'b',
      role: 'staff',
      date: new Date(2026, 9, 15, 15, 0),
    });

    expect(match.template?.code).toBe('deep-clean-m15');
    expect(match.reason).toBe('deep_clean_due');
  });

  it('surfaces the stocktake template on the 30th', () => {
    const withAudit = [...templates, template({ id: 'tpl_audit', code: 'inventory-audit-m30', shiftType: 'any' })];
    const match = sopForShift({
      templates: withAudit,
      shiftType: 'a',
      role: 'staff',
      date: new Date(2026, 9, 30, 9, 0),
    });

    expect(match.template?.code).toBe('inventory-audit-m30');
    expect(match.reason).toBe('inventory_audit_due');
  });

  it('honours the role restriction on a template', () => {
    const restricted = [
      template({ id: 'tpl_open', code: 'open-shift-a', shiftType: 'a', applicableRoles: 'owner,manager' }),
    ];
    const match = sopForShift({
      templates: restricted,
      shiftType: 'a',
      role: 'staff',
      date: new Date(2026, 9, 10, 7, 0),
    });

    expect(match.template).toBeNull();
    expect(match.reason).toBe('none_applicable');
  });

  it('ignores inactive templates', () => {
    const inactive = [template({ id: 'tpl_open', code: 'open-shift-a', shiftType: 'a', isActive: 0 })];
    const match = sopForShift({
      templates: inactive,
      shiftType: 'a',
      role: 'staff',
      date: new Date(2026, 9, 10, 7, 0),
    });

    expect(match.template).toBeNull();
  });
});

describe('isOverdue', () => {
  it('flags a Ca A checklist that overran its 30-minute window', () => {
    const started = new Date(2026, 9, 23, 6, 5, 0);
    const now = new Date(2026, 9, 23, 6, 40, 0);

    expect(isOverdue(started.toISOString(), 'a', now)).toBe(true);
  });

  it('leaves a Ca A checklist alone inside its window', () => {
    const started = new Date(2026, 9, 23, 6, 5, 0);
    const now = new Date(2026, 9, 23, 6, 20, 0);

    expect(isOverdue(started.toISOString(), 'a', now)).toBe(false);
  });

  it('gives Ca B its longer 40-minute window', () => {
    const started = new Date(2026, 9, 23, 14, 5, 0);
    const stillOk = new Date(2026, 9, 23, 14, 39, 0);
    const tooLate = new Date(2026, 9, 23, 14, 46, 0);

    expect(isOverdue(started.toISOString(), 'b', stillOk)).toBe(false);
    expect(isOverdue(started.toISOString(), 'b', tooLate)).toBe(true);
  });

  it('does not throw on an unparseable timestamp', () => {
    expect(isOverdue('not-a-date', 'a', new Date())).toBe(false);
  });
});
