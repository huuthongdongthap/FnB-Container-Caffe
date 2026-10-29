/**
 * Run and violation lifecycle states plus the pure transition guard.
 *
 * Both state machines end in a terminal state that forbids further mutation —
 * the same rule the shift policy enforces with `closed_shift_immutable` —
 * because a completed checklist is submitted as compliance evidence and must
 * not be editable after the fact.
 */

export type SopRunStatus = 'in_progress' | 'completed' | 'abandoned';
export type SopViolationStatus = 'recorded' | 'confirmed' | 'applied' | 'appealed' | 'closed';

const RUN_TERMINAL: readonly SopRunStatus[] = ['completed', 'abandoned'];
const VIOLATION_TERMINAL: readonly SopViolationStatus[] = ['closed'];

const RUN_TRANSITIONS: Record<SopRunStatus, readonly SopRunStatus[]> = {
  in_progress: ['completed', 'abandoned'],
  completed: [],
  abandoned: [],
};

const VIOLATION_TRANSITIONS: Record<SopViolationStatus, readonly SopViolationStatus[]> = {
  recorded: ['confirmed', 'appealed', 'closed'],
  confirmed: ['applied', 'closed'],
  applied: ['appealed', 'closed'],
  appealed: ['closed'],
  closed: [],
};

export function isRunTerminal(status: SopRunStatus): boolean {
  return RUN_TERMINAL.includes(status);
}

export function isViolationTerminal(status: SopViolationStatus): boolean {
  return VIOLATION_TERMINAL.includes(status);
}

/** True when moving a run from `from` to `to` is permitted. */
export function canTransitionRun(from: SopRunStatus, to: SopRunStatus): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

/** True when moving a violation from `from` to `to` is permitted. */
export function canTransitionViolation(from: SopViolationStatus, to: SopViolationStatus): boolean {
  return VIOLATION_TRANSITIONS[from].includes(to);
}
