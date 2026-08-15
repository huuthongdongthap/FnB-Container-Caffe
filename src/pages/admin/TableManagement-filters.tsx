import type { CafeTableRow } from './TableManagement-types';
import { STATUS_OPTIONS } from './TableManagement-constants';

interface TableFiltersProps {
	filterZone: string;
	filterStatus: string;
	zones: string[];
	onZoneChange: (zone: string) => void;
	onStatusChange: (status: string) => void;
	statusLabel: (status: CafeTableRow['status']) => string;
}

export function TableFilters({ filterZone, filterStatus, zones, onZoneChange, onStatusChange, statusLabel }: TableFiltersProps) {
	return (
		<div className="flex gap-3 mb-4 flex-wrap text-sm">
			<select
				value={filterZone}
				onChange={(e) => onZoneChange(e.target.value)}
				className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
			>
				<option value="all">All zones</option>
				{zones.map((z) => (
					<option key={z} value={z}>{z}</option>
				))}
			</select>
			<select
				value={filterStatus}
				onChange={(e) => onStatusChange(e.target.value)}
				className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
			>
				<option value="all">All statuses</option>
				{STATUS_OPTIONS.map((s) => (
					<option key={s.value} value={s.value}>
						{statusLabel(s.value)}
					</option>
				))}
			</select>
		</div>
	);
}
