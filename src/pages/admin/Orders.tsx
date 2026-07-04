import { useState, useEffect } from 'react';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { OrderTable } from '@/components/admin/OrderTable';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { RefundModal } from '@/components/payments/RefundModal';
import { useTranslations } from 'next-intl';

export default function AdminOrdersPage() {
  const t = useTranslations();
  const STATUS_OPTIONS = [
    { value: '', label: t('adminOrders.status.all') },
    { value: 'pending', label: t('adminOrders.status.pending') },
    { value: 'confirmed', label: t('adminOrders.status.confirmed') },
    { value: 'preparing', label: t('adminOrders.status.preparing') },
    { value: 'ready', label: t('adminOrders.status.ready') },
    { value: 'delivering', label: t('adminOrders.status.delivering') },
    { value: 'delivered', label: t('adminOrders.status.delivered') },
    { value: 'cancelled', label: t('adminOrders.status.cancelled') },
  ];

  const PAYMENT_OPTIONS = [
    { value: '', label: t('adminOrders.payment.all') },
    { value: 'cash', label: t('adminOrders.payment.cash') },
    { value: 'momo', label: t('adminOrders.payment.momo') },
    { value: 'bank', label: t('adminOrders.payment.bank') },
  ];
  const { orders, totalCount, loading, error, fetchOrders, updateOrderStatus } = useAdminOrdersStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [refundPayment, setRefundPayment] = useState<{ id: string; orderId: string; amount: number; customerName: string } | null>(null);

  useEffect(() => {
    fetchOrders(page, {
      status: statusFilter || undefined,
      payment: paymentFilter || undefined,
    });
  }, [page, statusFilter, paymentFilter, fetchOrders]);

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handlePaymentChange = (newPayment: string) => {
    setPaymentFilter(newPayment);
    setPage(1);
  };

  // Client-side date filter on already-fetched orders
  const filteredByDate = orders.filter((o) => {
    if (startDate && new Date(o.createdAt) < new Date(startDate)) return false;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(o.createdAt) > end) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">{t('adminOrders.title')}</h1>
          <span className="text-sm text-muted">
            {loading ? t('adminOrders.loading') : t('adminOrders.orderCount', { count: filteredByDate.length })}
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            {error}
            <button
              onClick={() => fetchOrders(page)}
              className="ml-3 underline hover:no-underline"
            >
              {t('adminOrders.retry')}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t('adminOrders.statusLabel')}</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t('adminOrders.paymentLabel')}</label>
              <select
                value={paymentFilter}
                onChange={(e) => handlePaymentChange(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <OrderTable
            orders={filteredByDate}
            statusFilter={statusFilter || undefined}
            paymentFilter={paymentFilter || undefined}
            sortBy="date"
            onUpdateStatus={updateOrderStatus}
            onRefund={(payment) =>
              setRefundPayment({
                id: payment.paymentId,
                orderId: payment.orderId,
                amount: payment.amount,
                customerName: payment.customerName,
              })
            }
          />

          {/* Refund Modal */}
          {refundPayment && (
            <RefundModal
              isOpen={!!refundPayment}
              onClose={() => setRefundPayment(null)}
              payment={refundPayment}
              onRefundComplete={() => {
                setRefundPayment(null);
                fetchOrders(page);
              }}
            />
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted">
              {t('adminOrders.pageInfo', { page, total: Math.ceil(totalCount / 20) || 1 })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/10 disabled:opacity-50"
              >
                {t('adminOrders.prev')}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={filteredByDate.length < 20}
                className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/10 disabled:opacity-50"
              >
                {t('adminOrders.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
