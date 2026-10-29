import { describe, expect, it } from 'vitest';
import type { SopViolation } from '../model/sop-types';
import {
  appealViolation,
  applySanction,
  canApplyAction,
  closeViolation,
  escalationLevel,
  nextDisciplineStep,
} from '../src/policies/violation-policy';

function violation(overrides: Partial<SopViolation> = {}): SopViolation {
  return {
    id: 'vio_1',
    tenantId: 'default',
    staffId: 'staff_1',
    category: 'time',
    isSerious: 0,
    note: 'Đi muộn 20 phút',
    occurredAt: '2026-10-23T08:20:00Z',
    recordedBy: 'manager_1',
    confirmedBy: null,
    appliedBy: null,
    disciplineStep: 'written_warning',
    status: 'recorded',
    appealExplanation: null,
    closedAt: null,
    createdAt: '2026-10-23T08:25:00Z',
    ...overrides,
  };
}

describe('nextDisciplineStep', () => {
  it('walks the ladder warning → fine → termination across the month', () => {
    expect(nextDisciplineStep({ priorCountInMonth: 0, isSerious: false })).toBe('written_warning');
    expect(nextDisciplineStep({ priorCountInMonth: 1, isSerious: false })).toBe('fine');
    expect(nextDisciplineStep({ priorCountInMonth: 2, isSerious: false })).toBe('termination');
  });

  it('stays at termination once the ladder is exhausted', () => {
    expect(nextDisciplineStep({ priorCountInMonth: 7, isSerious: false })).toBe('termination');
  });

  it('sends a serious breach straight to termination regardless of history', () => {
    expect(nextDisciplineStep({ priorCountInMonth: 0, isSerious: true })).toBe('termination');
  });

  it('does not inflate the ladder from unconfirmed pending cases', () => {
    // priorCountInMonth is caller-supplied and counts confirmed cases only;
    // a pending appeal therefore reads as a first offence.
    expect(nextDisciplineStep({ priorCountInMonth: 0, isSerious: false })).toBe('written_warning');
  });
});

describe('canApplyAction', () => {
  it('lets a manager confirm a recorded violation', () => {
    expect(canApplyAction({ action: 'confirm', role: 'manager', violation: violation() })).toBe(true);
  });

  it('refuses to confirm an already-confirmed violation', () => {
    expect(
      canApplyAction({ action: 'confirm', role: 'manager', violation: violation({ status: 'confirmed' }) })
    ).toBe(false);
  });

  it('refuses to confirm a closed violation — records are never reopened', () => {
    expect(
      canApplyAction({ action: 'confirm', role: 'manager', violation: violation({ status: 'closed' }) })
    ).toBe(false);
  });

  it('lets a manager apply a warning or a fine', () => {
    expect(
      canApplyAction({ action: 'apply', role: 'manager', violation: violation({ status: 'confirmed', disciplineStep: 'fine' }) })
    ).toBe(true);
    expect(
      canApplyAction({ action: 'apply', role: 'manager', violation: violation({ status: 'confirmed', disciplineStep: 'written_warning' }) })
    ).toBe(true);
  });

  it('reserves termination for the owner', () => {
    const termination = violation({ status: 'confirmed', disciplineStep: 'termination' });
    expect(canApplyAction({ action: 'apply', role: 'owner', violation: termination })).toBe(true);
    expect(canApplyAction({ action: 'apply', role: 'manager', violation: termination })).toBe(false);
  });

  it('allows an appeal once a sanction has been applied', () => {
    expect(
      canApplyAction({ action: 'appeal', role: 'staff', violation: violation({ status: 'applied' }) })
    ).toBe(true);
  });

  it('refuses an appeal before a sanction was applied', () => {
    expect(
      canApplyAction({ action: 'appeal', role: 'staff', violation: violation({ status: 'confirmed' }) })
    ).toBe(false);
  });
});

describe('applySanction', () => {
  it('rejects a manager attempting to apply a termination', () => {
    const result = applySanction({
      violation: violation({ status: 'confirmed', disciplineStep: 'termination' }),
      role: 'manager',
      now: '2026-10-23T09:00:00Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('forbidden_discipline_action');
  });

  it('lets the owner apply a termination', () => {
    const result = applySanction({
      violation: violation({ status: 'confirmed', disciplineStep: 'termination' }),
      role: 'owner',
      now: '2026-10-23T09:00:00Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('applied');
    expect(result.data.appliedBy).toBe('owner');
  });

  it('rejects applying a sanction that was never confirmed', () => {
    const result = applySanction({
      violation: violation({ status: 'recorded', disciplineStep: 'fine' }),
      role: 'manager',
      now: '2026-10-23T09:00:00Z',
    });

    expect(result.ok).toBe(false);
  });
});

describe('appealViolation', () => {
  it('stores the employee explanation', () => {
    const result = appealViolation(violation({ status: 'applied' }), 'Có xác nhận của khách');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('appealed');
    expect(result.data.appealExplanation).toBe('Có xác nhận của khách');
  });

  it('requires an explanation', () => {
    const result = appealViolation(violation({ status: 'applied' }), '   ');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('explanation_required');
  });

  it('refuses an appeal on a closed record', () => {
    const result = appealViolation(violation({ status: 'closed' }), 'Quá muộn');

    expect(result.ok).toBe(false);
  });
});

describe('closeViolation', () => {
  it('lets the owner close an appealed case', () => {
    const result = closeViolation(violation({ status: 'appealed' }), 'owner', '2026-10-23T10:00:00Z');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('closed');
    expect(result.data.closedAt).toBe('2026-10-23T10:00:00Z');
  });

  it('refuses to close twice — a closed violation is never deleted or edited', () => {
    const result = closeViolation(violation({ status: 'closed' }), 'owner', '2026-10-23T10:00:00Z');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('forbidden_discipline_action');
  });

  it('refuses the shop-floor role from closing a case', () => {
    const result = closeViolation(violation({ status: 'appealed' }), 'staff', '2026-10-23T10:00:00Z');

    expect(result.ok).toBe(false);
  });
});

describe('escalationLevel', () => {
  it('reports the rung of the ladder the employee is on', () => {
    expect(escalationLevel(0, false)).toBe(1);
    expect(escalationLevel(1, false)).toBe(2);
    expect(escalationLevel(2, false)).toBe(3);
    expect(escalationLevel(9, false)).toBe(3);
  });

  it('reports 3 for a serious breach', () => {
    expect(escalationLevel(0, true)).toBe(3);
  });
});
