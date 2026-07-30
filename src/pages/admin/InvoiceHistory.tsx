import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { FileText } from 'lucide-react';
import { API_BASE } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';


export interface InvoiceRecord {
  id: number;
  order_id: string;
  erpnext_id: string;
  erpnext_model: string;
  sync_status: string;
  attempts: number;
  error_message: string | null;
  created_at: string;
  last_synced_at: string;
  customer_name: string | null;
  total_amount: string | number | null;
  customer_email: string | null;
  customer_phone: string | null;
}

function getStatusLabel(status: string, t: (key: string) => string): string {
  const LABELS: Record<string, string> = {
    synced: t('invoices.status.synced'),
    failed: t('invoices.status.failed'),
    pending: t('invoices.status.pending'),
  };
  return LABELS[status] || status;
}

function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '---';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '---';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '---';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '---';
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '---';
  }
}

export default function AdminInvoiceHistoryPage() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      setError(t('invoices.error.loginRequired'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/erpnext-invoices/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, unknown>).error as string || t('invoices.error.loadFailed'));
      }

      const body = await res.json() as { success: boolean; data: InvoiceRecord[] };
      setInvoices(body.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('invoices.error.connectionError');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const getInvoicePdfUrl = (erpnextId: string): string => {
    return `${API_BASE}/api/erpnext-invoices/${encodeURIComponent(erpnextId)}/pdf`;
  };

  return (
    <>
      <HelmetHead
        title="Lịch sử hoá đơn — Invoice History — AURA CAFE"
        description="Xem lịch sử hoá đơn và trạng thái đồng bộ ERPNext tại AURA CAFE. Invoice history, sync status & ERPNext integration."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-display font-bold">{t('invoices.pageTitle')}</h1>
          <button
            onClick={fetchInvoices}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? t('invoices.loading') : t('invoices.reload')}
          </button>
        </div>

        <Card>
          <CardHeader>
            <h2 className="font-display font-semibold">{t('invoices.listTitle')}</h2>
          </CardHeader>
          <CardBody>
            {/* Error state */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 text-red-700 text-sm mb-4 flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={fetchInvoices}
                  className="underline hover:no-underline text-red-800 ml-3"
                >
                  {t('invoices.retry')}
                </button>
              </div>
            )}

            {/* Loading state */}
            {isLoading && !error && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && invoices.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 flex justify-center"><FileText size={40} aria-hidden="true" className="text-muted" /></div>
                <p className="text-muted text-base">{t('invoices.empty.title')}</p>
                <p className="text-sm text-muted mt-1">
                  {t('invoices.empty.description')}
                </p>
              </div>
            )}

            {/* Table */}
            {!isLoading && !error && invoices.length > 0 && (
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
                              {inv.order_id.length > 10
                                ? inv.order_id.slice(0, 10) + '...'
                                : inv.order_id}
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
            )}
          </CardBody>
        </Card>
      </div>
    </div>
    </>
  );
}
