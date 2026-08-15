export const TABLE_STATUS_STYLES: Record<string, { dot: string }> = {
	available: { dot: 'bg-emerald-400' },
	occupied: { dot: 'bg-amber-400' },
	reserved: { dot: 'bg-sky-400' },
};

export const STATUS_LABEL_KEY: Record<string, string> = {
	available: 'qrCodes.status.available',
	occupied: 'qrCodes.status.occupied',
	reserved: 'qrCodes.status.reserved',
};
