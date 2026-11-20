import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuthHeaders } from '@/hooks/stores/admin/admin-utils';
import { TABLE_STATUS_STYLES, STATUS_LABEL_KEY } from './GenerateQR-constants';
import type { QrCardProps } from './GenerateQR-types';

export function QrCard({
	tableNumber,
	zoneName,
	qrPngUrl,
	signedUrl,
	status,
	slug,
	onDownload,
}: QrCardProps) {
	const normalizedStatus =
		typeof status === 'string' ? status.trim().toLowerCase() : '';
	const statusStyle = (TABLE_STATUS_STYLES[normalizedStatus] ?? TABLE_STATUS_STYLES.available)!;

	const statusKey = STATUS_LABEL_KEY[normalizedStatus] ?? STATUS_LABEL_KEY.available;
	const { t } = useTranslation();
	const statusLabel = t(statusKey ?? 'qrCodes.status.available');
	const [resolvedSrc, setResolvedSrc] = useState<string | null>(qrPngUrl);
	const [loadFailed, setLoadFailed] = useState(false);
	const retriedRef = useRef(false);
	const objectUrlRef = useRef<string | null>(null);

	useEffect(() => {
		retriedRef.current = false;
		setLoadFailed(false);
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}
		setResolvedSrc(qrPngUrl);
		return () => {
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}
		};
	}, [qrPngUrl]);

	const fetchAuthenticatedPng = async () => {
		if (!qrPngUrl) {
			setLoadFailed(true);
			return;
		}
		try {
			const res = await fetch(qrPngUrl, {
				credentials: 'include',
				headers: getAuthHeaders(),
			});
			if (res?.ok && typeof res.blob === 'function') {
				const blob = await res.blob();
				if (objectUrlRef.current) {
					URL.revokeObjectURL(objectUrlRef.current);
				}
				const objUrl = URL.createObjectURL(blob);
				objectUrlRef.current = objUrl;
				setLoadFailed(false);
				setResolvedSrc(objUrl);
				return;
			}
		} catch {
			// Surface explicit error state instead of rendering a non-scannable SVG placeholder
		}
		setResolvedSrc(null);
		setLoadFailed(true);
	};

	const handleImgError = async () => {
		if (qrPngUrl && !retriedRef.current) {
			retriedRef.current = true;
			await fetchAuthenticatedPng();
			return;
		}
		setResolvedSrc(null);
		setLoadFailed(true);
	};

	const handleRetry = () => {
		retriedRef.current = true;
		setLoadFailed(false);
		void fetchAuthenticatedPng();
	};

	const imgSrc = loadFailed ? null : resolvedSrc;

	return (
		<div
			className="qr-card bg-[var(--aura-bg-elevated)] rounded-xl border border-border p-4 flex flex-col items-center text-center print:border-gray-300 print:shadow-none"
			data-testid="qr-card"
			data-table-number={String(tableNumber)}
			data-status={normalizedStatus}
			data-slug={slug ?? undefined}
			data-qr-error={loadFailed ? 'true' : undefined}
		>
			<div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
				{zoneName}
			</div>
			<div className="text-xl font-bold font-display text-foreground mb-3">
				{tableNumber}
			</div>
			{imgSrc ? (
				<img
					src={imgSrc}
					alt={`QR table ${tableNumber} zone ${zoneName}`}
					onError={handleImgError}
					className="rounded-lg w-[200px] h-[200px] object-contain bg-surface p-1"
					width={200}
					height={200}
				/>
			) : loadFailed ? (
				<div
					role="status"
					className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-200 print:hidden"
				>
					<span>Không tải được ảnh QR</span>
					<button
						type="button"
						onClick={handleRetry}
						className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded border border-amber-500/40 text-amber-100 hover:bg-amber-500/15"
					>
						{t('qrCodes.retry')}
					</button>
				</div>
			) : (
				<div className="w-[200px] h-[200px] flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
					{t('qrCodes.noQR')}
				</div>
			)}
			<div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10px] font-medium text-foreground">
				<span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
				<span>{statusLabel}</span>
			</div>
			{signedUrl && (
				<div className="qr-signed-url mt-2 text-[10px] text-muted break-all max-w-full leading-tight print:text-gray-500">
					{signedUrl}
				</div>
			)}
			{slug && onDownload && (
				<button
					onClick={() => onDownload(slug, Number(tableNumber))}
					className="mt-2 text-[10px] px-2.5 py-1 rounded border border-border text-muted hover:bg-muted/20 hover:text-foreground print:hidden"
					type="button"
				>
					{t('qrCodes.download')}
				</button>
			)}
		</div>
	);
}
