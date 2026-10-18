import { cn } from '@/lib/cn';
import type { AdminOrder } from '@/hooks/use-admin';
import type { RefundActionProps } from './OrderTable-types';

type ExtendedOrder = AdminOrder & {
  refund_status?: string | null;
  payment_id?: string;
  payment_amount?: number;
  customer_name?: string;
};

export function RefundAction({ order, userRole, onRefund, t }: RefundActionProps) {
  const ord = order as ExtendedOrder;
  const refundStatus = ord.refund_status ?? null;
  const isAlreadyRefunded = refundStatus === 'refunded' || refundStatus === 'partial';

  const allowedRoles = ['owner', 'manager', 'admin', 'staff'];
  if (!userRole || !allowedRoles.includes(userRole)) {
    return null;
  }

  return (
    <button
      onClick={() => {
        const paymentId = ord.payment_id;
        if (!paymentId) return;
        onRefund({
          paymentId,
          orderId: order.id,
          amount: Number(ord.payment_amount) || order.total,
          customerName: ord.customer_name || order.customer,
        });
      }}
      disabled={isAlreadyRefunded}
      className={cn(
        'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
        isAlreadyRefunded
          ? 'bg-surface/60 text-muted cursor-not-allowed'
          : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
      )}
      title={isAlreadyRefunded ? t('adminOrders.refundAlready') : t('adminOrders.refundBtn')}
    >
      {isAlreadyRefunded ? t('adminOrders.refundAlready') : t('adminOrders.refundBtn')}
    </button>
  );
}
