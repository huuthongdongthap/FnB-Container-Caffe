import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { AdminQRTable } from './GenerateQR-types';

export function useQrTables(t: (key: string) => string) {
	const [tables, setTables] = useState<AdminQRTable[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [regenerating, setRegenerating] = useState(false);

	const loadTables = useCallback(async () => {
		try {
			const response = await apiFetch<{ success: boolean; data: AdminQRTable[] }>(
				'/api/admin/qr/tables',
			);
			const host = typeof window !== 'undefined' ? window.location.origin : '';
			const enriched = (response?.data ?? []).map((item) => ({
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
		loadTables();
		return () => { cancelled = true; };
	}, [loadTables]);

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
