import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { OrderTimeline } from '@/components/tracking/OrderTimeline';
import { StatusBadge, type OrderStatus } from '@/components/tracking/StatusBadge';
import { EstimatedTime } from '@/components/tracking/EstimatedTime';
import type { StatusStep } from '@/components/tracking/track-order-types';

interface OrderItem {
  quantity: number;
  name: string;
  price: number;
}

interface OrderData {
  id: string;
  status?: string;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  total?: number;
  payment_method?: string;
  items?: OrderItem[];
}

interface TrackOrderStatusCardProps {
  order: OrderData;
  steps: StatusStep[];
}

export function TrackOrderStatusCard({ order, steps }: TrackOrderStatusCardProps) {
  const { t } = useTranslation('trackOrder');
  const orderStatus = order.status ?? 'pending';
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('vi-VN')
    : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">
              {t('orderLabel', { id: order.id })}
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

        {order.created_at && (
          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <EstimatedTime estimatedAt={order.created_at} />
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
        {order.customer_name && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('customer')}</span>
            <span>{order.customer_name}</span>
          </>
        )}
        {order.customer_phone && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('phone')}</span>
            <span>{order.customer_phone}</span>
          </>
        )}
        {order.customer_address && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('address')}</span>
            <span>{order.customer_address}</span>
          </>
        )}
        {order.total !== undefined && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('total')}</span>
            <span className="font-semibold">
              {order.total.toLocaleString('vi-VN')}₫
            </span>
          </>
        )}
        {order.payment_method && (
          <>
            <span className="text-[color:var(--aura-chrome-bright)]">{t('payment')}</span>
            <span className="capitalize">
              {order.payment_method === 'cod' ? 'COD' : order.payment_method}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function OrderItemsList({ items, t }: { items: OrderItem[]; t: (key: string) => string }) {
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <h4 className="text-sm font-semibold mb-2">{t('items')}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex justify-between text-sm">
            <span>{item.quantity}x {item.name}</span>
            <span className="text-[color:var(--aura-chrome-bright)]">
              {(item.price * item.quantity).toLocaleString('vi-VN')}₫
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
