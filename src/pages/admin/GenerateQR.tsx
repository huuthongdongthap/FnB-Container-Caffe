import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { apiFetch } from '@/lib/api-client';
import { useTranslations } from 'next-intl';

interface TableData {
  id: string;
  table_number: string;
  zone_name?: string;
  zone?: string;
  status?: string;
}

export default function GenerateQRPage() {
  const t = useTranslations();
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch<{ success: boolean; data: TableData[] }>('/api/tables');
        const tableData = response?.data ?? [];
        if (!cancelled) {
          setTables(tableData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('qrCodes.error.loadFailed'));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const formatTableNumber = (num: string): string =>
    num.startsWith('B') || num.startsWith('T') ? num : `B${num.padStart(2, '0')}`;

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
            <button
              onClick={() => window.location.reload()}
              className="ml-3 underline hover:no-underline"
            >
              {t('qrCodes.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="text-2xl font-display font-bold">{t('qrCodes.pageTitle')}</h1>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors"
          >
            {t('qrCodes.printAll')}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-muted">
            <div className="animate-pulse">{t('qrCodes.loading')}</div>
          </div>
        )}

        {/* QR Grid */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:gap-3">
            {tables.map((table) => (
              <QrCard
                key={table.id}
                tableNumber={formatTableNumber(table.table_number)}
                zoneName={table.zone_name || table.zone || t('qrCodes.defaultZone')}
                url={`https://auraspace.cafe/menu?table=${table.table_number}`}
              />
            ))}
          </div>

        )}
      </div>
    </div>
  );
}

function QrCard({ tableNumber, zoneName, url }: { tableNumber: string; zoneName: string; url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: { dark: '#1f2937', light: '#ffffff' },
      });
    }
  }, [url]);

  return (
    <div className="bg-[var(--aura-bg-elevated)] rounded-xl border border-border p-4 flex flex-col items-center text-center print:break-inside-avoid print:border-gray-300 print:shadow-none">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {zoneName}
      </div>
      <div className="text-xl font-bold font-display text-gray-800 mb-3">
        {tableNumber}
      </div>
      <canvas
        ref={canvasRef}
        className="rounded-lg mx-auto"
        width={200}
        height={200}
      />
      <div className="mt-2 text-[10px] text-gray-400 break-all max-w-full leading-tight print:text-gray-500">
        {url}
      </div>
    </div>
  );
}
