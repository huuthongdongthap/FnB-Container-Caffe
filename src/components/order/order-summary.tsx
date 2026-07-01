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
  return (
    <div className={cn('space-y-3', className)}>
      {/* Free delivery progress */}
      {!qualifiesForFreeDelivery && subtotal > 0 && (
        <div className="rounded-lg bg-accent/10 p-3 text-center text-sm text-muted">
          🚚 Thêm{' '}
          <span className="font-semibold text-accent-warm">
            {formatPrice(remainingForFreeDelivery)}
          </span>{' '}
          để được miễn phí giao hàng
        </div>
      )}
      {qualifiesForFreeDelivery && subtotal > 0 && (
        <div className="rounded-lg bg-green-50 p-3 text-center text-sm font-medium text-green-700">
          🎉 Miễn phí giao hàng
        </div>
      )}

      <div className="space-y-2 divide-y divide-border/10">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Tạm tính</span>
            <span className="text-foreground">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Phí phục vụ (5%)</span>
            <span className="text-foreground">{formatPrice(serviceFee)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Phí giao hàng</span>
              <span className="text-foreground">{formatPrice(deliveryFee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Giảm giá</span>
              <span className="text-green-600">-{formatPrice(discount)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-3 text-base font-bold">
          <span className="text-foreground">Tổng cộng</span>
          <span className="text-primary">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}
