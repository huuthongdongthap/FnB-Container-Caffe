import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { InvoiceRecord } from './invoice-history-types';
import { getStatusLabel, formatCurrency, formatDate } from './invoice-history-types';
import { API_BASE } from '@/lib/api-client';

function getInvoicePdfUrl(erpnextId: string): string {
  return `${API_BASE}/api/erpnext-invoices/${encodeURIComponent(erpnextId)}/pdf`;
}

function truncateId(id: string): string {
  return id.length > 10 ? id.slice(0, 10) + '...' : id;
}

interface InvoiceTableProps {
  invoices: InvoiceRecord[];
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
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
                    className="text-blue-600 hover:underline cursor-pointer"
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
                <a
                  href={getInvoicePdfUrl(inv.erpnext_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  PDF
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
