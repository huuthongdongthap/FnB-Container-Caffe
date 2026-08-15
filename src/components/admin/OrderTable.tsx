import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import type { AdminOrder } from '@/hooks/use-admin';
import { STATUS_VARIANT } from './OrderTable-constants';
import { StatusActions } from './OrderTable-status-actions';
import { RefundAction } from './OrderTable-refund-action';
import type { OrderTableProps } from './OrderTable-types';

export type { OrderTableProps, StatusActionsProps, RefundActionProps } from './OrderTable-types';
export { STATUS_VARIANT, STATUS_TRANSITIONS } from './OrderTable-constants';
export { StatusActions } from './OrderTable-status-actions';
export { RefundAction } from './OrderTable-refund-action';

export function OrderTable({
  orders,
  statusFilter,
  paymentFilter,
  sortBy = 'date',
  searchQuery = '',
  className,
  onUpdateStatus,
  onRefund,
}: OrderTableProps) {
  const { t } = useTranslation();
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
      <div className="text-center py-8 text-muted">
        <span className="text-3xl block mb-2">&#128230;</span>
        <p className="text-sm">Không có đơn hàng</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-3">
        <Input
          placeholder={t('adminOrders.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">{t('adminOrders.colOrderId')}</th>
              <th className="text-left py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">{t('adminOrders.colCustomer')}</th>
              <th className="text-center py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">{t('adminOrders.colQty')}</th>
              <th className="text-right py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">{t('adminOrders.colTotal')}</th>
              <th className="text-center py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">{t('adminOrders.colStatus')}</th>
              <th className="text-center py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">{t('adminOrders.colPayment')}</th>
              {(onUpdateStatus || onRefund) && (
                <th className="text-center py-2 px-3 font-medium text-muted uppercase text-xs tracking-wider">{t('adminOrders.colActions')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-border/60 hover:bg-muted/10">
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
                <td className="py-2.5 px-3 text-center text-xs text-muted uppercase">
                  {order.payment === 'momo' ? t('adminOrders.paymentMomo') : order.payment === 'cash' ? t('adminOrders.paymentCash') : order.payment === 'bank' ? t('adminOrders.paymentBank') : order.payment}
                </td>
                {(onUpdateStatus || onRefund) && (
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {onUpdateStatus && (
                        <StatusActions
                          currentStatus={order.status}
                          isUpdating={updatingId === order.id}
                          onUpdate={(s) => handleUpdateStatus(order.id, s)}
                          t={t}
                        />
                      )}
                      {onRefund && 'payment_status' in order && (order as unknown as { payment_status?: string }).payment_status === 'paid' && (
                        <RefundAction
                          order={order}
                          userRole={useAuthStore.getState().user?.role}
                          onRefund={onRefund}
                          t={t}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-6 text-muted">
          <p className="text-sm">{t('adminOrders.emptyTitle')}</p>
        </div>
      )}
    </div>
  );
}
