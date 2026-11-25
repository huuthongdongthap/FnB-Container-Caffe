import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchBlob, API_BASE } from '@/lib/api-client';
import { getAuthHeaders } from '@/hooks/stores/admin/admin-utils';
import type { AdminQRTable } from './GenerateQR-types';

export function useQrTables(t: (key: string) => string) {
	const [tables, setTables] = useState<AdminQRTable[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [regenerating, setRegenerating] = useState(false);
	const blobUrlsRef = useRef<string[]>([]);
	const loadSeqRef = useRef(0);

	const revokeTrackedBlobUrls = useCallback(() => {
		if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
		for (const url of blobUrlsRef.current.splice(0)) {
			URL.revokeObjectURL(url);
		}
	}, []);

	const loadTables = useCallback(async () => {
		const seq = ++loadSeqRef.current;
		try {
			const response = await apiFetch<{ success: boolean; data: AdminQRTable[] }>(
				'/api/admin/qr/tables',
			);
			if (seq !== loadSeqRef.current) return;
			revokeTrackedBlobUrls();
			const baseUrl = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
			const enriched = (response?.data ?? []).map((item) => ({
				...item,
				qr_png_url:
					item.qr_png_url ||
					(item.slug ? `${baseUrl}/api/admin/qr/${encodeURIComponent(item.slug)}/png` : null),
			}));
			setTables(enriched);
			setLoading(false);
			setError(null);

			const authHeaders = getAuthHeaders();
			const hasBearerAuth = Boolean(authHeaders.Authorization);
			if (
				hasBearerAuth &&
				enriched.length > 0 &&
				typeof URL !== 'undefined' &&
				typeof URL.createObjectURL === 'function'
			) {
				const resolvedEntries = await Promise.all(
					enriched.map(async (item) => {
						if (!item.qr_png_url || item.qr_png_url.startsWith('blob:') || item.qr_png_url.startsWith('data:')) {
							return item;
						}
						try {
							const blob =
								typeof apiFetchBlob === 'function'
									? await apiFetchBlob(item.qr_png_url, { silent: true })
									: await fetch(item.qr_png_url, { headers: authHeaders }).then(async (r) => {
											if (!r.ok || typeof r.blob !== 'function') throw new Error('PNG fetch failed');
											return r.blob();
										});
							const blobUrl = URL.createObjectURL(blob);
							blobUrlsRef.current.push(blobUrl);
							return { ...item, qr_png_url: blobUrl };
						} catch {
							// Fall back to direct qr_png_url so QrCard handles retry / print-guard explicitly
							return item;
						}
					}),
				);
				if (seq === loadSeqRef.current) {
					setTables(resolvedEntries);
				}
			}
		} catch (err) {
			if (seq !== loadSeqRef.current) return;
			setError(err instanceof Error ? err.message : t('qrCodes.error.loadFailed'));
			setLoading(false);
		}
	}, [revokeTrackedBlobUrls, t]);

	useEffect(() => {
		void loadTables();
		return () => {
			loadSeqRef.current += 1;
			revokeTrackedBlobUrls();
		};
	}, [loadTables, revokeTrackedBlobUrls]);

	const handleRegenerate = useCallback(async () => {
		setRegenerating(true);
		try {
			await apiFetch('/api/admin/qr/regenerate', { method: 'POST' });
			await loadTables();
		} catch {
			setError(t('qrCodes.error.regenerateFailed'));
		} finally {
			setRegenerating(false);
		}
	}, [loadTables, t]);

	return { tables, loading, error, regenerating, handleRegenerate, loadTables };
}
