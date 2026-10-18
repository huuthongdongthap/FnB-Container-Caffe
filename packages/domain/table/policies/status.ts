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

export function normalizeTableStatus(status: unknown): TableStatus | null {
  if (typeof status !== 'string') return null;
  const lower = status.trim().toLowerCase();
  if (lower === 'available') return 'Available';
  if (lower === 'occupied') return 'Occupied';
  if (lower === 'reserved') return 'Reserved';
  if (lower === 'overdue') return 'Overdue';
  return null;
}

export function canTransitionTo(
  current: CafeTable['status'] | string,
  target: CafeTable['status'] | string,
): boolean {
  const normCurrent = normalizeTableStatus(current);
  const normTarget = normalizeTableStatus(target);
  if (!normCurrent || !normTarget) return false;
  return TABLE_STATUS_TRANSITIONS[normCurrent].includes(normTarget);
}
