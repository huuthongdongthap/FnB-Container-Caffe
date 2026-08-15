import React from 'react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND, StatusBadge } from './dashboard-utils';
import type { Invoice } from '@/hooks/use-subscriptions';
import ReceiptDownloadButton from './receipt-download';

interface Props {
  invoices: Invoice[] | undefined;
  isLoading: boolean;
}

function handlePay(invoiceId: string) {
  window.location.href = `/api/subscriptions/invoices/${invoiceId}/pay`;
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start || !end) return '—';
  return `${new Date(start).toLocaleDateString('vi-VN')} – ${new Date(end).toLocaleDateString('vi-VN')}`;
}

export default function InvoiceTableCard({ invoices, isLoading }: Props) {
  return (
    <Card className="mt-6">
      <CardBody>
        <h2 className="font-display text-lg font-bold">Hóa đơn / Invoices</h2>
        {isLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Chưa có hóa đơn nào.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
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
                    <tr key={inv.id} className="border-t">
                      <td className="py-2">{inv.invoice_number || '—'}</td>
                      <td className="py-2">{formatDateRange(inv.period_start, inv.period_end)}</td>
                      <td className="py-2">{formatVND(inv.amount_vnd)}</td>
                      <td className="py-2"><StatusBadge status={inv.status} /></td>
                      <td className="py-2 flex gap-2">
                        {isPayable ? (
                          <Button size="sm" onClick={() => handlePay(inv.id)}>Thanh toán</Button>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                        {inv.status === 'paid' ? (
                          <ReceiptDownloadButton invoiceId={inv.id} invoiceNumber={inv.invoice_number || ''} />
                        ) : (
                          <span className="text-xs text-gray-500" title="Chưa thanh toán">🔒</span>
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
