import { useState, useEffect } from 'react';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { OrderTable } from '@/components/admin/OrderTable';
import { DateRangePicker } from '@/components/admin/DateRangePicker';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'preparing', label: 'Đang chế biến' },
  { value: 'ready', label: 'Sẵn sàng' },
  { value: 'delivering', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'Tất cả thanh toán' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'momo', label: 'MoMo' },
  { value: 'bank', label: 'Chuyển khoản' },
];

export default function AdminOrdersPage() {
  const { orders, totalCount, loading, error, fetchOrders, updateOrderStatus } = useAdminOrdersStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

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
          <h1 className="text-2xl font-display font-bold">Quản lý đơn hàng</h1>
          <span className="text-sm text-muted">
            {loading ? 'Đang tải...' : `${filteredByDate.length} đơn`}
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
              Thử lại
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Trạng thái</label>
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
              <label className="block text-xs font-medium text-muted mb-1">Thanh toán</label>
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

        {/* Orders Table or Empty State */}
        {!loading && !error && filteredByDate.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-white/40 p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/10">
              <span className="text-3xl">📋</span>
            </div>
            <h3 className="mb-1 font-display text-lg font-semibold">Không có đơn hàng</h3>
            <p className="mb-4 text-sm text-muted/60">
              {statusFilter || paymentFilter || startDate
                ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc hiện tại.'
                : 'Chưa có đơn hàng nào trong hệ thống.'}
            </p>
            {(statusFilter || paymentFilter || startDate) && (
              <button
                onClick={() => { setStatusFilter(''); setPaymentFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}
                className="text-sm text-accent underline underline-offset-2 hover:text-accent-warm"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <OrderTable
              orders={filteredByDate}
              statusFilter={statusFilter || undefined}
              paymentFilter={paymentFilter || undefined}
              sortBy="date"
              onUpdateStatus={updateOrderStatus}
            />
          </div>
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted">
              Trang {page} / {Math.ceil(totalCount / 20) || 1}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={filteredByDate.length < 20}
                className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
