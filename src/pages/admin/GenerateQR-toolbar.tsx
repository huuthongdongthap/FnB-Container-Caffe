import { useTranslation } from 'react-i18next';

interface FilterToolbarProps {
	filterZone: string;
	zones: string[];
	filteredCount: number;
	regenerating: boolean;
	onFilterChange: (zone: string) => void;
	onRegenerate: () => void;
	onPrint: () => void;
}

export function FilterToolbar({
	filterZone,
	zones,
	filteredCount,
	regenerating,
	onFilterChange,
	onRegenerate,
	onPrint,
}: FilterToolbarProps) {
	const { t } = useTranslation('admin');

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
			<div className="flex items-center gap-2">
				<label htmlFor="zone-filter" className="text-sm text-muted">
					{t('qrCodes.zoneFilter')}
				</label>
				<select
					id="zone-filter"
					value={filterZone}
					onChange={(e) => onFilterChange(e.target.value)}
					className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
				>
					<option value="all">{t('qrCodes.allZones', { fallback: 'All zones' })}</option>
					{zones.map((z) => (
						<option key={z} value={z}>{z}</option>
					))}
				</select>
				<span className="text-xs text-muted ml-2">
					{filteredCount}{' '}
					{t('qrCodes.tablesCount', { count: filteredCount })}
				</span>
			</div>

			<div className="flex gap-2">
				<button
					onClick={onRegenerate}
					disabled={regenerating}
					className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition-colors disabled:opacity-50"
				>
					{regenerating ? t('qrCodes.regenerating') : t('qrCodes.regenerateAll')}
				</button>
				<button
					onClick={onPrint}
					className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors"
				>
					{t('qrCodes.printAll')}
				</button>
			</div>
		</div>
	);
}
