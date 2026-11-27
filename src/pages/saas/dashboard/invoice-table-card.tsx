import React, { useState } from 'react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { formatVND, StatusBadge } from './dashboard-utils';
import type { Invoice } from '@/hooks/use-subscriptions';
import ReceiptDownloadButton from './receipt-download';

interface Props {
  invoices: Invoice[] | undefined;
  isLoading: boolean;
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start || !end) return '—';
  return `${new Date(start).toLocaleDateString('vi-VN')} – ${new Date(end).toLocaleDateString('vi-VN')}`;
}

export default function InvoiceTableCard({ invoices, isLoading }: Props) {
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function handlePay(invoiceId: string) {
    setPayingId(invoiceId);
    setPaymentError(null);
    try {
      const res = await apiFetch<{
        success?: boolean;
        error?: string;
        message?: string;
        payment_url?: string;
        checkout_url?: string;
        data?: { payment_url?: string; checkout_url?: string };
      }>(`/api/subscriptions/invoices/${encodeURIComponent(invoiceId)}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: 'payos' }),
      });
      if (res?.success === false || res?.error) {
        setPaymentError(res.error || res.message || 'Không thể khởi tạo thanh toán');
        return;
      }
      const paymentUrl =
        res?.payment_url ??
        res?.checkout_url ??
        res?.data?.payment_url ??
        res?.data?.checkout_url;
      if (paymentUrl) {
        let isSafePayment = false;
        try {
          const parsed = new URL(String(paymentUrl));
          isSafePayment =
            parsed.protocol === 'https:' &&
            (/^(?:[a-z0-9-]+\.)?payos\.vn$/i.test(parsed.hostname) || parsed.origin === window.location.origin);
        } catch {
          isSafePayment = false;
        }
        if (isSafePayment) {
          window.location.href = paymentUrl;
        } else {
          setPaymentError('Liên kết thanh toán không hợp lệ');
        }
      } else {
        setPaymentError('Không nhận được liên kết thanh toán từ cổng thanh toán');
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Không thể kết nối cổng thanh toán');
    } finally {
      setPayingId(null);
    }
  }

  return (
    <Card className="mt-6">
      <CardBody>
        <h2 className="font-display text-lg font-bold">Hóa đơn / Invoices</h2>
        {paymentError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            {paymentError}
          </div>
        )}
        {isLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Chưa có hóa đơn nào.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2">Số hóa đơn</th>
                  <th className="pb-2">Kỳ</th>
                  <th className="pb-2">Số tiền</th>
                  <th className="pb-2">Trạng thái</th>
                  <th className="pb-2">Thanh toán</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isPayable = inv.status === 'pending' || inv.status === 'processing';
                  return (
                    <tr key={inv.id} className="border-t border-white/10">
                      <td className="py-2">{inv.invoice_number || '—'}</td>
                      <td className="py-2">{formatDateRange(inv.period_start, inv.period_end)}</td>
                      <td className="py-2">{formatVND(inv.amount_vnd)}</td>
                      <td className="py-2"><StatusBadge status={inv.status} /></td>
                      <td className="py-2 flex gap-2">
                        {isPayable ? (
                          <Button
                            size="sm"
                            loading={payingId === inv.id}
                            disabled={payingId !== null}
                            onClick={() => void handlePay(inv.id)}
                          >
                            Thanh toán
                          </Button>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                        {inv.status === 'paid' ? (
                          <ReceiptDownloadButton invoiceId={inv.id} invoiceNumber={inv.invoice_number || ''} />
                        ) : (
                          <span className="text-xs text-muted" title="Chưa thanh toán">🔒</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
