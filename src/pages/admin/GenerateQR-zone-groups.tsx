import { useTranslation } from 'react-i18next';
import { QrCard } from './GenerateQR-qr-card';
import type { AdminQRTable } from './GenerateQR-types';

interface ZoneGroupsProps {
	grouped: Record<string, AdminQRTable[]>;
	onDownload: (slug: string, tableNumber: number) => void;
}

export function ZoneGroups({ grouped, onDownload }: ZoneGroupsProps) {
	const { t } = useTranslation('admin');

	return (
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
								onDownload={onDownload}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
