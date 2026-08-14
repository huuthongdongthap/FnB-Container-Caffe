import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useMyActiveSubscription, useMyInvoices, useSubscribe, type Subscription, type Invoice } from '@/hooks/use-subscriptions';
import { Link } from 'react-router-dom';

function formatVND(value: number): string {
  return value.toLocaleString('vi-VN') + '₫';
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    overdue: 'bg-amber-100 text-amber-800',
    processing: 'bg-blue-100 text-blue-800',
    manual: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  const labels: Record<string, string> = {
    active: 'Đang hoạt động',
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    failed: 'Thất bại',
    overdue: 'Quá hạn',
    processing: 'Đang xử lý',
    manual: 'Thanh toán thủ công',
    cancelled: 'Đã huỷ',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function CustomerDashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: sub, isLoading: subLoading, refetch: refetchSub } = useMyActiveSubscription();
  const { data: invoices, isLoading: invLoading } = useMyInvoices();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  if (subLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <HelmetHead title="Dashboard — AURA CAFE" description="Customer dashboard" canonical="/saas/dashboard" />
        <Card className="p-10">
          <h2 className="font-display text-xl font-bold">Vui lòng đăng nhập</h2>
          <p className="mt-2 text-sm text-gray-600">Bạn cần đăng nhập để xem dashboard.</p>
          <Link to="/account"><Button className="mt-4">Đăng nhập</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] mx-auto max-w-4xl px-4 py-24">
      <HelmetHead title="Dashboard — AURA CAFE" description="Manage your subscription and billing" canonical="/saas/dashboard" />

      <h1 className="font-display text-3xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-[color:var(--aura-chrome-bright)]/60">Xin chào, {user.name || user.email}</p>

      {/* Subscription summary */}
      <Card className="mt-6">
        <CardBody>
          <h2 className="font-display text-lg font-bold">Gói hiện tại / Current Plan</h2>
          {sub ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{sub.plan_name || 'Container ' + (sub.container_number || '')}</span>
                {statusBadge(sub.status)}
              </div>
              <div className="text-sm text-gray-600">
                <span>{formatVND(sub.amount_vnd)}/tháng</span>
                {sub.zone && <span className="ml-3">· Zone: {sub.zone}</span>}
                {sub.container_number && <span className="ml-3">· #{sub.container_number}</span>}
              </div>
              {sub.current_period_end && (
                <div className="text-xs text-gray-500">
                  Gia hạn tiếp theo: {new Date(sub.current_period_end).toLocaleDateString('vi-VN')}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-600">
              Chưa có subscription. <Link to="/subscriptions" className="text-blue-600 underline">Xem gói</Link>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Invoices */}
      <Card className="mt-6">
        <CardBody>
          <h2 className="font-display text-lg font-bold">Hóa đơn / Invoices</h2>
          {invLoading ? (
            <div className="mt-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
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
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t">
                      <td className="py-2">{inv.invoice_number || '—'}</td>
                      <td className="py-2">
                        {inv.period_start && inv.period_end
                          ? `${new Date(inv.period_start).toLocaleDateString('vi-VN')} – ${new Date(inv.period_end).toLocaleDateString('vi-VN')}`
                          : '—'}
                      </td>
                      <td className="py-2">{formatVND(inv.amount_vnd)}</td>
                      <td className="py-2">{statusBadge(inv.status)}</td>
                      <td className="py-2 flex gap-2">
                        {inv.status === 'pending' || inv.status === 'processing' ? (
                          <Button size="sm" onClick={() => window.location.href = `/api/subscriptions/invoices/${inv.id}/pay`}>
                            Thanh toán
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/subscriptions/invoices/${inv.id}/receipt`);
                              if (!res.ok) {
                                const text = await res.text().catch(() => '');
                                throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 80) : ''}`);
                              }
                              const ct = res.headers.get('content-type') || '';
                              if (!ct.includes('text/plain')) {
                                const text = await res.text().catch(() => '');
                                throw new Error(`Unexpected content-type: ${ct}${text ? ' :: ' + text.slice(0, 120) : ''}`);
                              }
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `receipt-${inv.invoice_number || inv.id}.txt`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (e) {
                              console.error('Receipt download failed:', e);
                            }
                          }}
                          disabled={inv.status !== 'paid'}
                          title={inv.status === 'paid' ? 'Tải hóa đơn' : 'Chưa thanh toán'}
                        >
                          {inv.status === 'paid' ? '📄' : '🔒'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold">Huỷ subscription</h3>
            <p className="mt-2 text-sm text-gray-600">
              Bạn có chắc muốn huỷ? Quyền truy cập sẽ kết thúc vào ngày hết hạn hiện tại.
            </p>
            {cancelError && <p className="mt-2 text-sm text-red-600">{cancelError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={cancelLoading}>Giữ lại</Button>
              <Button variant="destructive" onClick={async () => {
                setCancelLoading(true);
                setCancelError('');
                try {
                  const res = await fetch(`/api/subscriptions/${sub?.id}/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'customer_requested' }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error || data.message || 'Cancel failed');
                  setCancelOpen(false);
                  refetchSub();
                } catch (e) {
                  setCancelError((e as Error).message);
                } finally {
                  setCancelLoading(false);
                }
              }} disabled={cancelLoading}>
                {cancelLoading ? 'Đang xử lý...' : 'Xác nhận huỷ'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
