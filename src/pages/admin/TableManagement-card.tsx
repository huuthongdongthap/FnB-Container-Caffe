import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CafeTableRow } from './TableManagement-types';
import { STATUS_OPTIONS, STATUS_KEYS_MAP, normalizeTableStatusUI } from './TableManagement-constants';

interface TableCardProps {
	table: CafeTableRow;
	zone: string;
	activeCount: number;
	isUpdating: boolean;
	onSetStatus: (id: string, status: CafeTableRow['status']) => void;
	onTransfer?: (table: CafeTableRow) => void;
	onRelease: (table: CafeTableRow) => void;
}

export function TableCard({ table, zone, activeCount, isUpdating, onSetStatus, onRelease, onTransfer }: TableCardProps) {
	const { t, i18n } = useTranslation();
	const vi = i18n.language?.startsWith('vi');
	const [menuOpen, setMenuOpen] = useState(false);

	const normalizedStatus = normalizeTableStatusUI(table.status);
	const statusLabel = (status: CafeTableRow['status'] | string) => {
		const norm = normalizeTableStatusUI(status);
		return t(`admin.tableManagement.${STATUS_KEYS_MAP[norm]}`, { defaultValue: norm, fallback: norm });
	};

	const isOccupiedOrOverdue = normalizedStatus === 'Occupied' || normalizedStatus === 'Overdue';

	return (
		<div className="rounded-xl border border-border bg-[var(--aura-bg-elevated)] p-4 flex flex-col items-center text-center transition-all hover:shadow-md">
			<span className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
				{zone}
			</span>
			<span className="text-2xl font-display font-bold mb-2">
				{String(table.table_number)}
			</span>

			{/* Status badge — click toggles dropdown without accidental status cycling */}
			<div className="relative">
				<button
					type="button"
					disabled={isUpdating}
					aria-expanded={menuOpen}
					aria-haspopup="menu"
					onClick={() => setMenuOpen((prev) => !prev)}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:ring-2 hover:ring-primary/50"
				>
					<span
						className={`w-2 h-2 rounded-full ${STATUS_OPTIONS.find((s) => s.value === normalizedStatus)?.dot ?? 'bg-gray-400'}`}
					/>
					<span className="whitespace-nowrap">
						{statusLabel(normalizedStatus)}
					</span>
				</button>

				{/* Quick actions dropdown — opens downward to avoid clipping at top row */}
				{menuOpen && (
					<div
						role="menu"
						className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-surface text-foreground rounded-lg shadow-lg border border-border py-1 min-w-[140px] z-20"
					>
						{STATUS_OPTIONS.map((s) => (
							<button
								key={s.value}
								type="button"
								role="menuitem"
								onClick={() => {
									setMenuOpen(false);
									if (s.value !== normalizedStatus) {
										onSetStatus(table.id, s.value);
									}
								}}
								className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/20 flex items-center gap-2"
							>
								<span className={`w-2 h-2 rounded-full ${s.dot}`} />
								{statusLabel(s.value)}
								{normalizedStatus === s.value ? ' ✓' : ''}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Order count badge + KDS button */}
			<div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
				{activeCount > 0 && (
					<button
						type="button"
						onClick={() => { const q = encodeURIComponent(String(table.table_number)); window.location.href = `/admin/orders?search=${q}&searchField=table`; }}
						className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-medium hover:bg-amber-500/30 transition-colors"
						title={t('admin.tableManagement.viewKDS')}
					>
						{activeCount}{' '}
						{t('admin.tableManagement.orders')}
					</button>
				)}
				<button
					type="button"
					onClick={() => { window.location.href = '/kds'; }}
					className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-foreground text-[11px] font-medium hover:bg-muted/20 transition-colors"
					title={t('admin.tableManagement.openKDS')}
				>
					🍳 KDS
				</button>
			</div>

			{onTransfer && isOccupiedOrOverdue && (
				<button type="button" disabled={isUpdating} onClick={() => onTransfer(table)}
					className="mt-2 px-3 py-2 text-xs rounded-md border border-border hover:bg-muted/20 disabled:opacity-50">
					{vi ? 'Chuyển bàn' : 'Transfer table'}
				</button>
			)}

			{/* Manual release button on Occupied or Overdue tables */}
			{isOccupiedOrOverdue && (
				<button
					type="button"
					disabled={isUpdating}
					onClick={() => onRelease(table)}
					className="mt-2 px-2.5 py-1 text-[11px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
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
