import { useTranslation } from 'react-i18next';
import { Truck, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/cn';

interface OrderSummaryProps {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  discount: number;
  total: number;
  qualifiesForFreeDelivery: boolean;
  remainingForFreeDelivery: number;
  className?: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

export function OrderSummary({
  subtotal,
  serviceFee,
  deliveryFee,
  discount,
  total,
  qualifiesForFreeDelivery,
  remainingForFreeDelivery,
  className,
}: OrderSummaryProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('space-y-3', className)}>
      {/* Free delivery progress */}
      {!qualifiesForFreeDelivery && subtotal > 0 && (
        <div className="rounded-lg bg-accent/10 p-3 text-center text-sm text-muted">
          <Truck size={14} className="inline" />{' '}
          {t('order.freeDeliveryMessage', { amount: formatPrice(remainingForFreeDelivery) })}
        </div>
      )}
      {qualifiesForFreeDelivery && subtotal > 0 && (
        <div className="rounded-lg bg-green-50 p-3 text-center text-sm font-medium text-green-700">
          <PartyPopper size={14} className="inline" /> {t('order.freeDeliveryQualified')}
        </div>
      )}

      <div className="space-y-2 divide-y divide-border/10">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('order.subtotal')}</span>
            <span className="text-foreground">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('order.serviceFee')}</span>
            <span className="text-foreground">{formatPrice(serviceFee)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">{t('order.deliveryFee')}</span>
              <span className="text-foreground">{formatPrice(deliveryFee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">{t('order.discount')}</span>
              <span className="text-green-600">-{formatPrice(discount)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-3 text-base font-bold">
          <span className="text-foreground">{t('order.total')}</span>
          <span className="text-primary">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}
