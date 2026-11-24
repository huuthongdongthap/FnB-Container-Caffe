import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { InvoiceRecord } from './invoice-history-types';
import { getStatusLabel, formatCurrency, formatDate } from './invoice-history-types';
import { API_BASE } from '@/lib/api-client';
import { getAuthHeaders } from '@/hooks/stores/admin/admin-utils';

function getInvoicePdfUrl(erpnextId: string): string {
  return `${API_BASE}/api/erpnext-invoices/${encodeURIComponent(erpnextId)}/pdf`;
}

async function handleInvoicePdfDownload(
  e: React.MouseEvent<HTMLAnchorElement>,
  erpnextId: string,
  onError: (message: string) => void,
): Promise<void> {
  e.preventDefault();
  try {
    const res = await fetch(getInvoicePdfUrl(erpnextId), {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...getAuthHeaders(),
        Accept: 'application/pdf',
      },
    });
    if (!res.ok) {
      throw new Error(`PDF download failed (${res.status})`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${erpnextId.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PDF download failed';
    onError(message);
  }
}

function truncateId(id: string): string {
  return id.length > 10 ? id.slice(0, 10) + '...' : id;
}

interface InvoiceTableProps {
  invoices: InvoiceRecord[];
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  const { t } = useTranslation();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      {downloadError && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <span>{downloadError}</span>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
            className="ml-3 font-medium underline hover:no-underline"
          >
            {t('common.dismiss', 'Dismiss')}
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 font-medium text-muted">{t('invoices.table.orderId')}</th>
            <th className="text-left py-3 px-2 font-medium text-muted">{t('invoices.table.customer')}</th>
            <th className="text-right py-3 px-2 font-medium text-muted">{t('invoices.table.total')}</th>
            <th className="text-left py-3 px-2 font-medium text-muted">{t('invoices.table.status')}</th>
            <th className="text-left py-3 px-2 font-medium text-muted">{t('invoices.table.date')}</th>
            <th className="text-center py-3 px-2 font-medium text-muted">{t('invoices.table.download')}</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="py-3 px-2 font-mono text-xs">
                {inv.order_id ? (
                  <span
                    className="text-blue-400 hover:underline cursor-pointer"
                    title={inv.erpnext_id || ''}
                  >
                    {truncateId(inv.order_id)}
                  </span>
                ) : (
                  <span className="text-muted">---</span>
                )}
              </td>
              <td className="py-3 px-2">
                {inv.customer_name || inv.customer_phone || inv.customer_email || (
                  <span className="text-muted">{t('invoices.guestCustomer')}</span>
                )}
              </td>
              <td className="py-3 px-2 text-right font-mono text-xs">
                {formatCurrency(inv.total_amount)}
              </td>
              <td className="py-3 px-2">
                <Badge
                  variant={
                    inv.sync_status === 'synced' ? 'success' :
                    inv.sync_status === 'failed' ? 'destructive' : 'default'
                  }
                >
                  {getStatusLabel(inv.sync_status, t)}
                </Badge>
              </td>
              <td className="py-3 px-2 text-xs text-muted">
                {formatDate(inv.created_at)}
              </td>
              <td className="py-3 px-2 text-center">
                {inv.erpnext_id ? (
                  <a
                    href={getInvoicePdfUrl(inv.erpnext_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      setDownloadError(null);
                      void handleInvoicePdfDownload(e, inv.erpnext_id, setDownloadError);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                  >
                    PDF
                  </a>
                ) : (
                  <span className="text-xs text-muted">---</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
