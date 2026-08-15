import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useTranslation } from 'react-i18next';
import type { InvoiceRecord } from './invoice-history-types';
export type { InvoiceRecord } from './invoice-history-types';
import { InvoiceLoadingSkeleton } from './invoice-history-loading-skeleton';
import { InvoiceEmptyState } from './invoice-history-empty-state';
import { InvoiceTable } from './invoice-history-table';

export default function AdminInvoiceHistoryPage() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ success: boolean; data: InvoiceRecord[]; error?: string }>('/api/erpnext-invoices/list');
      if (!response.success) {
        throw new Error(response.error || t('invoices.error.loadFailed'));
      }
      setInvoices(response.data || []);
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

  const showTable = !isLoading && !error && invoices.length > 0;
  const showEmpty = !isLoading && !error && invoices.length === 0;

  return (
    <>
      <HelmetHead
        title="Lich su hoa don — Invoice History — AURA CAFE"
        description="Xem lich su hoa don va trang thai dong bo ERPNext tai AURA CAFE. Invoice history, sync status & ERPNext integration."
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

              {isLoading && !error && <InvoiceLoadingSkeleton />}
              {showEmpty && <InvoiceEmptyState />}
              {showTable && <InvoiceTable invoices={invoices} />}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
