import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { AdminOrder } from '@/hooks/use-admin';

interface OrderTableProps {
  orders: AdminOrder[];
  statusFilter?: string;
  paymentFilter?: string;
  sortBy?: 'date' | 'total';
  searchQuery?: string;
  className?: string;
  onUpdateStatus?: (orderId: string, status: string) => Promise<void>;
}

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'success',
  delivering: 'info',
  delivered: 'success',
  cancelled: 'destructive',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivering'],
  delivering: ['delivered'],
};

export function OrderTable({
  orders,
  statusFilter,
  paymentFilter,
  sortBy = 'date',
  searchQuery = '',
  className,
  onUpdateStatus,
}: OrderTableProps) {
  const [search, setSearch] = useState(searchQuery);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...orders];

    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (paymentFilter) {
      result = result.filter((o) => o.payment === paymentFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'date') {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === 'total') {
      result.sort((a, b) => b.total - a.total);
    }

    return result;
  }, [orders, statusFilter, paymentFilter, sortBy, search]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!onUpdateStatus) return;
    setUpdatingId(orderId);
    try {
      await onUpdateStatus(orderId, newStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <span className="text-3xl block mb-2">&#128230;</span>
        <p className="text-sm">Không có đơn hàng</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-3">
        <Input
          placeholder="Tìm kiếm đơn hàng hoặc khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-500 uppercase text-xs tracking-wider">Mã ĐH</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 uppercase text-xs tracking-wider">Khách hàng</th>
              <th className="text-center py-2 px-3 font-medium text-gray-500 uppercase text-xs tracking-wider">SL</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500 uppercase text-xs tracking-wider">Tổng</th>
              <th className="text-center py-2 px-3 font-medium text-gray-500 uppercase text-xs tracking-wider">Trạng thái</th>
              <th className="text-center py-2 px-3 font-medium text-gray-500 uppercase text-xs tracking-wider">Thanh toán</th>
              {onUpdateStatus && (
                <th className="text-center py-2 px-3 font-medium text-gray-500 uppercase text-xs tracking-wider">Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 px-3 font-mono text-xs">{order.id}</td>
                <td className="py-2.5 px-3">{order.customer}</td>
                <td className="py-2.5 px-3 text-center">{order.items}</td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {order.total.toLocaleString('vi-VN')}₫
                </td>
                <td className="py-2.5 px-3 text-center">
                  <Badge variant={STATUS_VARIANT[order.status] || 'default'}>
                    {order.status}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 text-center text-xs text-gray-500 uppercase">
                  {order.payment === 'momo' ? 'MoMo' : order.payment === 'cash' ? 'Tiền mặt' : order.payment === 'bank' ? 'Chuyển khoản' : order.payment}
                </td>
                {onUpdateStatus && (
                  <td className="py-2.5 px-3 text-center">
                    <StatusActions
                      currentStatus={order.status}
                      isUpdating={updatingId === order.id}
                      onUpdate={(s) => handleUpdateStatus(order.id, s)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">Không tìm thấy đơn hàng phù hợp</p>
        </div>
      )}
    </div>
  );
}

function StatusActions({
  currentStatus,
  isUpdating,
  onUpdate,
}: {
  currentStatus: string;
  isUpdating: boolean;
  onUpdate: (status: string) => void;
}) {
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];

  if (!nextStatuses || nextStatuses.length === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  return (
    <div className="flex gap-1 justify-center">
      {nextStatuses.map((status) => (
        <button
          key={status}
          onClick={() => onUpdate(status)}
          disabled={isUpdating}
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
            status === 'cancelled'
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
            isUpdating && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isUpdating ? '...' : status === 'confirmed' ? 'Xác nhận' : status === 'preparing' ? 'Chế biến' : status === 'ready' ? 'Sẵn sàng' : status === 'delivering' ? 'Giao' : status === 'delivered' ? 'Hoàn tất' : 'Hủy'}
        </button>
      ))}
    </div>
  );
}
