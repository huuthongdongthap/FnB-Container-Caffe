import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useTranslation } from 'react-i18next';

interface AdminQRTable {
	id: string;
	table_number: number;
	zone: string;
	status: string;
	slug: string;
	signed_url: string | null;
	qr_png_url: string | null;
}

const TABLE_STATUS_STYLES: Record<string, { dot: string }> = {
	available: { dot: 'bg-emerald-400' },
	occupied: { dot: 'bg-amber-400' },
	reserved: { dot: 'bg-sky-400' },
};

const STATUS_LABEL_KEY: Record<string, string> = {
	available: 'qrCodes.status.available',
	occupied: 'qrCodes.status.occupied',
	reserved: 'qrCodes.status.reserved',
};

function PrintHeader() {
	const { t } = useTranslation('admin');
	return (
		<div className="hidden print:block mb-4 pb-3 border-b-2 border-black">
			<h2 className="text-sm font-semibold uppercase text-gray-520 mb-1">
				{t('qrCodes.printHeaderTitle')}
			</h2>
			<p className="text-xs text-gray-500">{t('qrCodes.printHeaderHint')}</p>
			<p className="text-xs text-gray-500 mt-1">{t('qrCodes.printHeaderUrlHint')}</p>
		</div>
	);
}

function PrintStyles() {
	return (
		<style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } .print-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 14mm !important; } .print-section-title { color: #000 !important; border-color: #000 !important; } .qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #000 !important; box-shadow: none !important; background: #fff !important; padding: 10px !important; } .qr-signed-url { word-break: break-all; font-size: 7.5pt; color: #111 !important; } } @media print and (max-width: 800px) { .print-grid { grid-template-columns: repeat(2, 1fr) !important; } } `}</style>
	);
}

export function QrCard({
	tableNumber,
	zoneName,
	qrPngUrl,
	signedUrl,
	status,
	slug,
	onDownload,
}: {
	tableNumber: number | string;
	zoneName: string;
	qrPngUrl: string | null;
	signedUrl: string | null;
	status?: string;
	slug?: string;
	onDownload?: (slug: string, tableNumber: number) => void;
}) {
	const normalizedStatus =
		typeof status === 'string' ? status.trim().toLowerCase() : '';
	const statusStyle = (TABLE_STATUS_STYLES[normalizedStatus] ?? TABLE_STATUS_STYLES.available)!;

	const statusKey = STATUS_LABEL_KEY[normalizedStatus] ?? STATUS_LABEL_KEY.available;
	const { t } = useTranslation('admin');
	const statusLabel = t(statusKey);

	return (
		<div
			className="qr-card bg-[var(--aura-bg-elevated)] rounded-xl border border-border p-4 flex flex-col items-center text-center print:border-gray-300 print:shadow-none"
			data-testid="qr-card"
			data-table-number={String(tableNumber)}
			data-status={normalizedStatus}
			data-slug={slug ?? undefined}
		>
			<div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
				{zoneName}
			</div>
			<div className="text-xl font-bold font-display text-gray-800 mb-3">
				{tableNumber}
			</div>
			{qrPngUrl ? (
				<img
					src={qrPngUrl}
					alt={`QR table ${tableNumber} zone ${zoneName}`}
					className="rounded-lg w-[200px] h-[200px] object-contain bg-white"
					width={200}
					height={200}
				/>
			) : (
				<div className="w-[200px] h-[200px] flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
					{t('qrCodes.noQR')}
				</div>
			)}
			<div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-700">
				<span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
				<span>{statusLabel}</span>
			</div>
			{signedUrl && (
				<div className="qr-signed-url mt-2 text-[10px] text-gray-400 break-all max-w-full leading-tight print:text-gray-500">
					{signedUrl}
				</div>
			)}
			{slug && onDownload && (
				<button
					onClick={() => onDownload(slug, Number(tableNumber))}
					className="mt-2 text-[10px] px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 print:hidden"
					type="button"
				>
					{t('qrCodes.download')}
				</button>
			)}
		</div>
	);
}

export default function GenerateQRPage() {
	const { t } = useTranslation('admin');
	const [tables, setTables] = useState<AdminQRTable[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [regenerating, setRegenerating] = useState(false);
	const [filterZone, setFilterZone] = useState<string>('all');

	const loadTables = useCallback(async () => {
		try {
			const response = await apiFetch<{ success: boolean; data: AdminQRTable[] }>(
				'/api/admin/qr/tables',
			);
			const tableData = response?.data ?? [];
			const host =
				typeof window !== 'undefined' ? window.location.origin : '';
			const enriched = tableData.map((item) => ({
				...item,
				qr_png_url: `${host}/api/admin/qr/${item.slug}/png`,
			}));
			setTables(enriched);
			setLoading(false);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : t('qrCodes.error.loadFailed'));
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			await loadTables();
			return () => {
				cancelled = true;
			};
		})();
	}, [loadTables]);

	const zones = useMemo(() => {
		const unique = Array.from(new Set(tables.map((t) => t.zone))).sort();
		return unique;
	}, [tables]);

	const filtered = useMemo(() => {
		if (filterZone === 'all') return tables;
		return tables.filter((t) => t.zone === filterZone);
	}, [tables, filterZone]);

	const grouped = useMemo(
		() =>
			filtered.reduce<Record<string, AdminQRTable[]>>((acc, t) => {
				(acc[t.zone] ||= []).push(t);
				return acc;
			}, {}),
		[filtered],
	);

	const handleRegenerate = async () => {
		setRegenerating(true);
		try {
			await apiFetch('/api/admin/qr/regenerate', { method: 'POST' });
			await loadTables();
		} catch {
			setError(t('qrCodes.error.regenerateFailed'));
		} finally {
			setRegenerating(false);
		}
	};

	const handleDownload = async (slug: string, tableNumber: number) => {
		try {
			const res = await fetch(`/api/admin/qr/${slug}/download`);
			if (!res.ok) return;
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `qr-table-${tableNumber}-${slug}.png`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// Scale: individual download failures are intentionally silent per product doc
		}
	};

	if (error) {
		return (
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-7xl mx-auto">
					<div className="bg-red-500/10 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
						{error}
						<button
							onClick={loadTables}
							className="ml-3 underline hover:no-underline"
						>
							{t('qrCodes.retry')}
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<PrintStyles />
			<HelmetHead
				title={t('qrCodes.pageTitle')}
				description="Mã QR cho đặt món tại AURA CAFE"
			/>
			<PrintHeader />
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-6">
						<h1 className="text-2xl font-display font-bold">
							{t('qrCodes.pageTitle')}
						</h1>
						<p className="text-sm text-gray-500 mt-1">
							{t('qrCodes.pageSubtitle')}
						</p>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
						<div className="flex items-center gap-2">
							<label
								htmlFor="zone-filter"
								className="text-sm text-muted"
							>
								{t('qrCodes.zoneFilter')}
							</label>
							<select
								id="zone-filter"
								value={filterZone}
								onChange={(e) => setFilterZone(e.target.value)}
								className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
							>
								<option value="all">{t('qrCodes.allZones', { fallback: 'All zones' })}</option>
								{zones.map((z) => (
									<option key={z} value={z}>
										{z}
									</option>
								))}
							</select>
							<span className="text-xs text-muted ml-2">
								{filtered.length}{' '}
								{t('qrCodes.tablesCount', { count: filtered.length })}
							</span>
						</div>

						<div className="flex gap-2">
							<button
								onClick={handleRegenerate}
								disabled={regenerating}
								className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition-colors disabled:opacity-50"
							>
								{regenerating ? t('qrCodes.regenerating') : t('qrCodes.regenerateAll')}
							</button>
							<button
								onClick={() => window.print()}
								className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors"
							>
								{t('qrCodes.printAll')}
							</button>
						</div>
					</div>

					{loading && (
						<div className="text-center py-12 text-muted">
							<div className="animate-pulse">{t('qrCodes.loading')}</div>
						</div>
					)}

					{!loading && filtered.length === 0 && (
						<div className="text-center py-12 text-muted text-sm">
							{t('qrCodes.noTablesZone')}
						</div>
					)}

					{!loading && (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:gap-3 print-grid">
							{filtered.map((table) => (
								<QrCard
									key={table.id}
									tableNumber={table.table_number}
									zoneName={table.zone}
									qrPngUrl={table.qr_png_url}
									signedUrl={table.signed_url}
									slug={table.slug}
									status={table.status}
									onDownload={handleDownload}
								/>
							))}
						</div>
					)}

					{!loading && Object.keys(grouped).length > 1 && (
						<div className="mt-8 print:mt-12 section-break">
							{Object.entries(grouped).map(([zoneName, groupTables]) => (
								<div key={zoneName} className="mb-10">
									<h2 className="text-sm font-semibold uppercase text-gray-400 mb-3 print-section-title">
										{zoneName} —{' '}
										{groupTables.length}{' '}
										{t(groupTables.length === 1 ? 'qrCodes.table' : 'qrCodes.tables')}
									</h2>
									<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:gap-3 print-grid">
										{groupTables.map((table) => (
											<QrCard
												key={table.id}
												tableNumber={table.table_number}
												zoneName={table.zone}
												qrPngUrl={table.qr_png_url}
												signedUrl={table.signed_url}
												slug={table.slug}
												status={table.status}
												onDownload={handleDownload}
											/>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
