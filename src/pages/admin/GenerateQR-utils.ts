import { API_BASE } from '@/lib/api-client';

export async function downloadQrImage(slug: string, tableNumber: number): Promise<void> {
	const res = await fetch(`${API_BASE}/api/admin/qr/${slug}/download`, {
		credentials: 'include',
	});
	if (!res.ok) return;
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `qr-table-${tableNumber}-${slug}.png`;
	a.click();
	URL.revokeObjectURL(url);
}
