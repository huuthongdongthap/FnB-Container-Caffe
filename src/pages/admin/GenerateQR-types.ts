export interface AdminQRTable {
	id: string;
	table_number: number;
	zone: string;
	status: string;
	slug: string;
	signed_url: string | null;
	qr_png_url: string | null;
}

export interface QrCardProps {
	tableNumber: number | string;
	zoneName: string;
	qrPngUrl: string | null;
	signedUrl: string | null;
	status?: string;
	slug?: string;
	onDownload?: (slug: string, tableNumber: number) => void;
}
