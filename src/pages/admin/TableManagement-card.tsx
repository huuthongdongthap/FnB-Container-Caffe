import { useTranslation } from 'react-i18next';
import type { CafeTableRow } from './TableManagement-types';
import { STATUS_OPTIONS, STATUS_KEYS_MAP } from './TableManagement-constants';

interface TableCardProps {
	table: CafeTableRow;
	zone: string;
	activeCount: number;
	isUpdating: boolean;
	onSetStatus: (id: string, status: CafeTableRow['status']) => void;
	onRelease: (table: CafeTableRow) => void;
}

export function TableCard({ table, zone, activeCount, isUpdating, onSetStatus, onRelease }: TableCardProps) {
	const { t } = useTranslation('admin');

	const statusLabel = (status: CafeTableRow['status']) =>
		t(`admin.tableManagement.${STATUS_KEYS_MAP[status]}`, { fallback: status });

	const clickStatusLabel = (key: string) =>
		t(`admin.tableManagement.${key}`, { fallback: 'Cycle status' });

	return (
		<div className="rounded-xl border border-border bg-[var(--aura-bg-elevated)] p-4 flex flex-col items-center text-center transition-all hover:shadow-md">
			<span className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
				{zone}
			</span>
			<span className="text-2xl font-display font-bold mb-2">
				{String(table.table_number)}
			</span>

			{/* Status badge — clickable */}
			<div className="relative group">
				<button
					disabled={isUpdating}
					onClick={() => {
						const next = STATUS_OPTIONS.find((s) => s.value !== table.status);
						if (next) onSetStatus(table.id, next.value);
					}}
					title={clickStatusLabel("clickCycleStatus")}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:ring-2 hover:ring-primary/50"
				>
					<span
						className={`w-2 h-2 rounded-full ${STATUS_OPTIONS.find((s) => s.value === table.status)?.dot}`}
					/>
					<span className="whitespace-nowrap">
						{statusLabel(table.status)}
					</span>
				</button>

				{/* Quick actions dropdown */}
				<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block group-focus-within:block bg-white dark:bg-gray-800 rounded-lg shadow-lg border py-1 min-w-[130px] z-10">
					{STATUS_OPTIONS.map((s) => (
						<button
							key={s.value}
							onClick={() => onSetStatus(table.id, s.value)}
							className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
						>
							<span className={`w-2 h-2 rounded-full ${s.dot}`} />
							{statusLabel(s.value)}
							{table.status === s.value ? ' ✓' : ''}
						</button>
					))}
				</div>
			</div>

			{/* Order count badge + KDS button */}
			<div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
				{activeCount > 0 && (
					<button
						onClick={() => { window.location.href = '/kds'; }}
						className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium hover:bg-amber-200 transition-colors"
						title={t('admin.tableManagement.viewKDS')}
					>
						{activeCount}{' '}
						{t('admin.tableManagement.orders')}
					</button>
				)}
				<button
					onClick={() => { window.location.href = '/kds'; }}
					className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium hover:bg-gray-200 transition-colors"
					title={t('admin.tableManagement.openKDS')}
				>
					🍳 KDS
				</button>
			</div>

			{/* Manual release button on Occupied tables */}
			{table.status === 'Occupied' && (
				<button
					disabled={isUpdating}
					onClick={() => onRelease(table)}
					className="mt-2 px-2.5 py-1 text-[11px] rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
				>
					{t('admin.tableManagement.releaseTable')}
				</button>
			)}

			<span className="text-[10px] text-gray-400 mt-1.5">
				{t('admin.tableManagement.capacity')}: {table.capacity}
			</span>
			{isUpdating && <span className="text-xs text-primary mt-1 animate-pulse">...</span>}
		</div>
	);
}
