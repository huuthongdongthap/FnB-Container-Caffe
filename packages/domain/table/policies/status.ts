/**
 * Table status policy — v1 permissive semantics.
 * All four statuses are legal targets from any current status;
 * callers opt into stricter transitions later without touching
 * route handlers.
 */
import type { CafeTable } from '../model/table-types';

export const TABLE_STATUSES = ['Available', 'Occupied', 'Reserved', 'Overdue'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const TABLE_STATUS_TRANSITIONS: Record<TableStatus, readonly TableStatus[]> = {
  Available: ['Available', 'Occupied', 'Reserved', 'Overdue'],
  Occupied: ['Available', 'Occupied', 'Reserved', 'Overdue'],
  Reserved: ['Available', 'Occupied', 'Reserved', 'Overdue'],
  Overdue: ['Available', 'Occupied', 'Reserved', 'Overdue'],
} as const;

export function canTransitionTo(
  current: CafeTable['status'],
  target: CafeTable['status'],
): boolean {
  return TABLE_STATUS_TRANSITIONS[current].includes(target);
}
