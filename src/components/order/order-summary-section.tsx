import { useTranslation } from 'react-i18next';
import { OrderSummary } from './order-summary';

interface OrderSummarySectionProps {
  cartItems: Array<{ id: string; name: string; price: number; quantity: number }>;
  subtotal: number;
  serviceFee: number;
  total: number;
  tip: number;
  qualifiesForFreeDelivery: boolean;
  remainingForFreeDelivery: number;
}

const formatVND = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value) + '₫';

export function OrderSummarySection({
  cartItems,
  subtotal,
  serviceFee,
  total,
  tip,
  qualifiesForFreeDelivery,
  remainingForFreeDelivery,
}: OrderSummarySectionProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border/20 bg-background/50 p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
        {t('order.summary')}
      </h3>
      <div className="mb-4 space-y-2">
        {cartItems.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-muted">
              {item.name} <span className="text-muted/60">x{item.quantity}</span>
            </span>
            <span className="tabular-nums text-foreground">
              {formatVND(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>
      <OrderSummary
        subtotal={subtotal}
        serviceFee={serviceFee}
        deliveryFee={0}
        discount={0}
        total={total + tip}
        qualifiesForFreeDelivery={qualifiesForFreeDelivery}
        remainingForFreeDelivery={remainingForFreeDelivery}
      />
    </div>
  );
}
