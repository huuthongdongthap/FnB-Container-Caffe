import { useMemo, useState } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useTranslation } from 'react-i18next';
import { PrintHeader, PrintStyles } from './GenerateQR-print-components';
import { QrCard } from './GenerateQR-qr-card';
import { FilterToolbar } from './GenerateQR-toolbar';
import { ZoneGroups } from './GenerateQR-zone-groups';
import { useQrTables } from './GenerateQR-hooks';
import { downloadQrImage } from './GenerateQR-utils';
import type { AdminQRTable } from './GenerateQR-types';

export type { AdminQRTable, QrCardProps } from './GenerateQR-types';
export { QrCard } from './GenerateQR-qr-card';

export default function GenerateQRPage() {
	const { t } = useTranslation('admin');
	const [filterZone, setFilterZone] = useState<string>('all');
	const { tables, loading, error, regenerating, handleRegenerate, loadTables } = useQrTables(t);

	const zones = useMemo(() => Array.from(new Set(tables.map((t) => t.zone))).sort(), [tables]);
	const filtered = useMemo(() => filterZone === 'all' ? tables : tables.filter((t) => t.zone === filterZone), [tables, filterZone]);
	const grouped = useMemo(() => filtered.reduce<Record<string, AdminQRTable[]>>((acc, t) => {
		(acc[t.zone] ||= []).push(t);
		return acc;
	}, {}), [filtered]);

	if (error) {
		return (
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-7xl mx-auto">
					<div className="bg-red-500/10 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
						{error}
						<button onClick={loadTables} className="ml-3 underline hover:no-underline">
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
			<HelmetHead title={t('qrCodes.pageTitle')} description="Mã QR cho đặt món tại AURA CAFE" />
			<PrintHeader />
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-6">
						<h1 className="text-2xl font-display font-bold">{t('qrCodes.pageTitle')}</h1>
						<p className="text-sm text-gray-500 mt-1">{t('qrCodes.pageSubtitle')}</p>
					</div>
					<FilterToolbar
						filterZone={filterZone}
						zones={zones}
						filteredCount={filtered.length}
						regenerating={regenerating}
						onFilterChange={setFilterZone}
						onRegenerate={handleRegenerate}
						onPrint={() => window.print()}
					/>
					{loading && <div className="text-center py-12 text-muted"><div className="animate-pulse">{t('qrCodes.loading')}</div></div>}
					{!loading && filtered.length === 0 && <div className="text-center py-12 text-muted text-sm">{t('qrCodes.noTablesZone')}</div>}
					{!loading && (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:gap-3 print-grid">
							{filtered.map((table) => (
								<QrCard key={table.id} tableNumber={table.table_number} zoneName={table.zone} qrPngUrl={table.qr_png_url} signedUrl={table.signed_url} slug={table.slug} status={table.status} onDownload={downloadQrImage} />
							))}
						</div>
					)}
					{!loading && Object.keys(grouped).length > 1 && <ZoneGroups grouped={grouped} onDownload={downloadQrImage} />}
				</div>
			</div>
		</>
	);
}
