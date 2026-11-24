import type { CafeTableRow } from './TableManagement-types';

export const STATUS_KEYS_MAP: Record<string, string> = {
	Available: 'statusAvailable',
	available: 'statusAvailable',
	Occupied: 'statusOccupied',
	occupied: 'statusOccupied',
	Reserved: 'statusReserved',
	reserved: 'statusReserved',
	Overdue: 'statusOverdue',
	overdue: 'statusOverdue',
};

export function normalizeTableStatusUI(status: string | undefined | null): CafeTableRow['status'] {
	const s = String(status || '').trim().toLowerCase();
	if (s === 'occupied') return 'Occupied';
	if (s === 'reserved') return 'Reserved';
	if (s === 'overdue') return 'Overdue';
	return 'Available';
}

export const STATUS_OPTIONS: Array<{ value: CafeTableRow['status']; dot: string }> = [
	{ value: 'Available', dot: 'bg-emerald-400' },
	{ value: 'Occupied', dot: 'bg-amber-400' },
	{ value: 'Reserved', dot: 'bg-sky-400' },
	{ value: 'Overdue', dot: 'bg-red-400' },
];

export const ACTIVE_ORDER_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready']);
