import type { CartItem } from '@/hooks/stores/use-cart-store';

interface OrderSummarySidebarProps {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  serviceFee: number;
  total: number;
  qualifiesForFreeDelivery: boolean;
  remainingForFreeDelivery: number;
}

export function OrderSummarySidebar({
  items,
  totalItems,
  subtotal,
  serviceFee,
  total,
  qualifiesForFreeDelivery,
  remainingForFreeDelivery,
}: OrderSummarySidebarProps) {
  return (
    <div className="sticky top-24 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
      <h3 className="mb-4 font-display text-lg font-semibold text-chrome-bright">
        Đơn hàng ({totalItems} món)
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-chrome-light/70">
              {item.name}
              <span className="ml-1 text-chrome-light/40">x{item.quantity}</span>
            </span>
            <span className="tabular-nums text-chrome-light/90">
              {new Intl.NumberFormat('vi-VN').format(item.price * item.quantity) + '₫'}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t border-chrome-light/10 pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-chrome-light/60">Tạm tính</span>
          <span className="text-chrome-light/90">{new Intl.NumberFormat('vi-VN').format(subtotal) + '₫'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-chrome-light/60">Phí phục vụ (5%)</span>
          <span className="text-chrome-light/90">{new Intl.NumberFormat('vi-VN').format(serviceFee) + '₫'}</span>
        </div>
        <div className="flex justify-between border-t border-chrome-light/10 pt-2 text-base font-bold">
          <span className="text-chrome-bright">Tổng cộng</span>
          <span className="text-chrome-bright">{new Intl.NumberFormat('vi-VN').format(total) + '₫'}</span>
        </div>
      </div>

      {!qualifiesForFreeDelivery && subtotal > 0 && (
        <p className="mt-4 rounded-lg bg-chrome-mid/10 p-3 text-center text-xs text-chrome-light/60">
          🚚 Thêm {new Intl.NumberFormat('vi-VN').format(remainingForFreeDelivery) + '₫'} để miễn phí giao hàng
        </p>
      )}
    </div>
  );
}
