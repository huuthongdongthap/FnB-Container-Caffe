import { useCallback, useMemo, useRef, useState } from 'react';
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

function isDecorativeOrUnloadedQrCard(card: Element): boolean {
	if (card.getAttribute('data-qr-error') === 'true') return true;
	const img = card.querySelector('img');
	if (!img) return true;
	const src = (img.getAttribute('src') || img.src || '').trim();
	if (!src || src.startsWith('data:image/svg+xml')) return true;
	if (!img.complete || img.naturalWidth === 0) return true;
	return false;
}

export default function GenerateQRPage() {
	const { t } = useTranslation();
	const [filterZone, setFilterZone] = useState<string>('all');
	const [printWarning, setPrintWarning] = useState<string | null>(null);
	const cardsContainerRef = useRef<HTMLDivElement | null>(null);
	const { tables, loading, error, regenerating, handleRegenerate, loadTables } = useQrTables(t);

	const zones = useMemo(() => Array.from(new Set(tables.map((t) => t.zone))).sort(), [tables]);
	const filtered = useMemo(() => filterZone === 'all' ? tables : tables.filter((t) => t.zone === filterZone), [tables, filterZone]);
	const grouped = useMemo(() => filtered.reduce<Record<string, AdminQRTable[]>>((acc, t) => {
		(acc[t.zone] ||= []).push(t);
		return acc;
	}, {}), [filtered]);

	const handlePrint = useCallback(() => {
		if (filtered.length === 0) {
			setPrintWarning('Chưa có mã QR bàn nào sẵn sàng để in.');
			return;
		}
		const hasMissingPayload = filtered.some((table) => !table.slug || !table.signed_url || !table.qr_png_url);
		const renderedCards = Array.from(cardsContainerRef.current?.querySelectorAll('[data-testid="qr-card"]') ?? []);
		const hasUnprintableCard =
			renderedCards.length !== filtered.length ||
			renderedCards.some((card) => isDecorativeOrUnloadedQrCard(card));
		if (hasMissingPayload || hasUnprintableCard) {
			setPrintWarning('Một hoặc nhiều mã QR chưa tải được ảnh PNG thật (ảnh dự phòng không quét được). Vui lòng tải lại trước khi in.');
			return;
		}
		setPrintWarning(null);
		window.print();
	}, [filtered]);

	if (error) {
		return (
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-7xl mx-auto">
					<div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
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
			<style>{`@media print { .qr-card[data-qr-error="true"], .qr-card img[src^="data:image/svg+xml"], .qr-card:has(img[src^="data:image/svg+xml"]) { display: none !important; } }`}</style>
			<HelmetHead title={t('qrCodes.pageTitle')} description="Mã QR đặt món tại bàn cho cửa hàng" />
			<PrintHeader />
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-6 no-print print:hidden">
						<h1 className="text-2xl font-display font-bold">{t('qrCodes.pageTitle')}</h1>
						<p className="text-sm text-muted mt-1">{t('qrCodes.pageSubtitle')}</p>
					</div>
					<FilterToolbar
						filterZone={filterZone}
						zones={zones}
						filteredCount={filtered.length}
						regenerating={regenerating}
						onFilterChange={(zone) => {
							setPrintWarning(null);
							setFilterZone(zone);
						}}
						onRegenerate={handleRegenerate}
						onPrint={handlePrint}
					/>
					{printWarning && (
						<div role="alert" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 no-print">
							<span>{printWarning}</span>
							<button onClick={loadTables} type="button" className="ml-3 underline hover:no-underline">
								{t('qrCodes.retry')}
							</button>
						</div>
					)}
					{loading && <div className="text-center py-12 text-muted"><div className="animate-pulse">{t('qrCodes.loading')}</div></div>}
					{!loading && filtered.length === 0 && <div className="text-center py-12 text-muted text-sm">{t('qrCodes.noTablesZone')}</div>}
					<div ref={cardsContainerRef}>
						{!loading && Object.keys(grouped).length <= 1 && (
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:gap-3 print-grid">
								{filtered.map((table) => (
									<QrCard key={table.id} tableNumber={table.table_number} zoneName={table.zone} qrPngUrl={table.qr_png_url} signedUrl={table.signed_url} slug={table.slug} status={table.status} onDownload={downloadQrImage} />
								))}
							</div>
						)}
						{!loading && Object.keys(grouped).length > 1 && <ZoneGroups grouped={grouped} onDownload={downloadQrImage} />}
					</div>
				</div>
			</div>
		</>
	);
}
