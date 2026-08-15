import { useTranslation } from 'react-i18next';

export function PrintHeader() {
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

export function PrintStyles() {
	return (
		<style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } .print-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 14mm !important; } .print-section-title { color: #000 !important; border-color: #000 !important; } .qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #000 !important; box-shadow: none !important; background: #fff !important; padding: 10px !important; } .qr-signed-url { word-break: break-all; font-size: 7.5pt; color: #111 !important; } } @media print and (max-width: 800px) { .print-grid { grid-template-columns: repeat(2, 1fr) !important; } } `}</style>
	);
}
