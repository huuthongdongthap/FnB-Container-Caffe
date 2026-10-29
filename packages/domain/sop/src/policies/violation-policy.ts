/**
 * Violation and discipline-ladder policy — pure functions, no database access.
 *
 * Encodes SOP 09 §3 (escalating ladder) and §4 (three-level accountability):
 * a shift leader records, a manager confirms, and only the owner may apply a
 * termination. Serious breaches skip the ladder. The employee may appeal after
 * a sanction is applied, which reopens the record for the owner to close.
 *
 * Money is deliberately not modelled here: the fine step is expressed as a
 * shape ("one hour of wage"), with the amount resolved at payroll time.
 */

import type { SopDisciplineStep, SopViolation, SopViolationCategory } from '../../model/sop-types';
import { canTransitionViolation, isViolationTerminal } from '../model/sop-state';

const LADDER: SopDisciplineStep[] = ['none', 'written_warning', 'fine', 'termination'];

/**
 * The conduct groups SOP 09 §2 marks as grounds for immediate dismissal. These
 * skip the ladder regardless of prior history, so the set is policy, not
 * recorder preference.
 */
const SERIOUS_CATEGORIES: SopViolationCategory[] = ['assets_finance', 'secrets', 'stimulants'];

/**
 * Whether this conduct group is dismissible on its own. Called by the recorder
 * so a breach that warrants dismissal cannot be filed as a lateness instead.
 */
export function isSeriousCategory(category: SopViolationCategory): boolean {
  return SERIOUS_CATEGORIES.includes(category);
}

export interface DisciplineInput {
  /** How many confirmed violations this employee already has in the month. */
  priorCountInMonth: number;
  isSerious: boolean;
}

/**
 * The discipline step a new violation earns. `priorCountInMonth` counts only
 * offences already confirmed, so a pending appeal cannot inflate the ladder.
 */
export function nextDisciplineStep(input: DisciplineInput): SopDisciplineStep {
  if (input.isSerious) return 'termination';
  const index = Math.min(input.priorCountInMonth + 1, LADDER.length - 1);
  return LADDER[index];
}

export type ViolationAction = 'confirm' | 'apply' | 'appeal' | 'close';

/** Who may push each transition. Terminations are owner-only by design. */
export interface AuthorityInput {
  action: ViolationAction;
  role: string;
  violation: Pick<SopViolation, 'status' | 'disciplineStep'>;
}

export function canApplyAction(input: AuthorityInput): boolean {
  const role = String(input.role);
  const { violation } = input;

  switch (input.action) {
    // Shift leader / manager records, manager confirms.
    case 'confirm':
      return violation.status === 'recorded' && (role === 'manager' || role === 'owner' || role === 'admin');
    // Only the owner may apply a termination; lesser steps are manager-level.
    case 'apply':
      if (violation.status !== 'confirmed') return false;
      return violation.disciplineStep === 'termination' ? role === 'owner' : (role === 'manager' || role === 'owner' || role === 'admin');
    // The employee appeals a sanction that was actually applied.
    case 'appeal':
      return violation.status === 'applied';
    // Closing is a manager/owner decision after appeal or completion.
    case 'close':
      return (violation.status === 'confirmed' || violation.status === 'applied' || violation.status === 'appealed')
        && (role === 'manager' || role === 'owner' || role === 'admin');
    default:
      return false;
  }
}

/**
 * Human-readable escalation level, surfaced in the admin console column. Derived
 * from `nextDisciplineStep` so the ladder has one formula: a second copy here
 * would let the two disagree about where rung three sits.
 */
export function escalationLevel(priorCountInMonth: number, isSerious: boolean): number {
  return LADDER.indexOf(nextDisciplineStep({ priorCountInMonth, isSerious }));
}

export interface ApplySanctionInput {
  violation: SopViolation;
  role: string;
  now: string;
}

/**
 * Applies the sanction recorded on the violation. Rejects when the actor may
 * not push this violation to `applied` — the server-side gate behind the admin
 * console hiding the [Sa thải] button from non-owners.
 */
export function applySanction(
  input: ApplySanctionInput
): { ok: true; data: SopViolation } | { ok: false; error: string } {
  if (!canApplyAction({ action: 'apply', role: input.role, violation: input.violation })) {
    return { ok: false, error: 'forbidden_discipline_action' };
  }
  if (!canTransitionViolation(input.violation.status, 'applied')) {
    return { ok: false, error: 'invalid_violation_transition' };
  }
  if (input.violation.disciplineStep === 'termination' && String(input.role) !== 'owner') {
    return { ok: false, error: 'termination_requires_owner' };
  }

  return {
    ok: true,
    data: { ...input.violation, status: 'applied', appliedBy: String(input.role) },
  };
}

/** Records an appeal with the employee's own explanation. */
export function appealViolation(
  violation: SopViolation,
  explanation: string
): { ok: true; data: SopViolation } | { ok: false; error: string } {
  if (!canTransitionViolation(violation.status, 'appealed')) {
    return { ok: false, error: 'invalid_violation_transition' };
  }
  if (!explanation.trim()) {
    return { ok: false, error: 'explanation_required' };
  }
  return { ok: true, data: { ...violation, status: 'appealed', appealExplanation: explanation.trim() } };
}

/** Closes the record. A closed violation is immutable — it is never deleted. */
export function closeViolation(
  violation: SopViolation,
  role: string,
  now: string
): { ok: true; data: SopViolation } | { ok: false; error: string } {
  if (!canApplyAction({ action: 'close', role, violation })) {
    return { ok: false, error: 'forbidden_discipline_action' };
  }
  if (isViolationTerminal(violation.status)) {
    return { ok: false, error: 'violation_immutable' };
  }
  return { ok: true, data: { ...violation, status: 'closed', closedAt: now } };
}
