import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { OrderTimeline } from '@/components/tracking/OrderTimeline';
import { StatusBadge, type OrderStatus } from '@/components/tracking/StatusBadge';
import { EstimatedTime } from '@/components/tracking/EstimatedTime';
import type { StatusStep } from '@/components/tracking/track-order-types';
import type { CustomerOrder, CustomerOrderItem } from '@/hooks/stores/order-store-types';

type OrderData = CustomerOrder;

interface TrackOrderStatusCardProps {
  order: OrderData;
  steps: StatusStep[];
}

export function TrackOrderStatusCard({ order, steps }: TrackOrderStatusCardProps) {
  const { t } = useTranslation('trackOrder');
  const orderStatus = order.status ?? 'pending';
  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('vi-VN')
    : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">
              {t('orderLabel', { id: order.orderNumber })}
            </h3>
            {orderDate && (
              <p className="text-xs text-[color:var(--aura-chrome-bright)]">{t('orderDate', { date: orderDate })}</p>
            )}
          </div>
          <StatusBadge status={orderStatus as OrderStatus} />
        </div>
      </CardHeader>
      <CardBody>
        <OrderTimeline currentStatus={orderStatus} steps={steps} />

        {order.createdAt && (
          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <EstimatedTime estimatedAt={order.createdAt} />
          </div>
        )}

        <OrderDetailsGrid order={order} t={t} />

        {order.items && order.items.length > 0 && (
          <OrderItemsList items={order.items} t={t} />
        )}

        <div className="mt-4 text-center text-xs text-[color:var(--aura-chrome-bright)]">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse" />
          {t('autoRefresh')}
        </div>
      </CardBody>
    </Card>
  );
}

function OrderDetailsGrid({ order, t }: { order: OrderData; t: (key: string) => string }) {
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <h4 className="text-sm font-semibold mb-2">{t('orderInfo')}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {order.table && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('table')}</span>
            <span>{order.table.name}</span>
          </>
        )}
        {order.channel && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('channel')}</span>
            <span>{order.channel === 'dine_in' ? 'Tại chỗ' : order.channel === 'takeaway' ? 'Mang đi' : 'Giao hàng'}</span>
          </>
        )}
        {order.paymentStatus && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('paymentStatus')}</span>
            <span className="capitalize">{order.paymentStatus}</span>
          </>
        )}
        {order.totalAmount !== undefined && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('total')}</span>
            <span className="font-semibold">
              {(order.totalAmount / 100).toLocaleString('vi-VN')}₫
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function OrderItemsList({ items, t }: { items: CustomerOrderItem[]; t: (key: string) => string }) {
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <h4 className="text-sm font-semibold mb-2">{t('items')}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex justify-between text-sm">
            <span>{item.quantity}x {item.name}</span>
            <span className="text-[color:var(--aura-chrome-bright)]">
              {(item.subtotalCents / 100).toLocaleString('vi-VN')}₫
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
