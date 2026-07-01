import { ShoppingBag } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { CartItemRow } from './cart-item';
import { OrderSummary } from './order-summary';
import type { CartItem } from '@/hooks/stores/use-cart-store';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  serviceFee: number;
  total: number;
  qualifiesForFreeDelivery: boolean;
  remainingForFreeDelivery: number;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export function CartDrawer({
  open,
  onClose,
  items,
  subtotal,
  serviceFee,
  total,
  qualifiesForFreeDelivery,
  remainingForFreeDelivery,
  onUpdateQuantity,
  onRemove,
  onClearCart,
  onCheckout,
}: CartDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title="Giỏ hàng" side="right">
      <div className="flex h-full flex-col">
        {/* Items */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingBag className="mb-4 h-12 w-12 text-muted/50" />
              <p className="text-sm text-muted">Giỏ hàng trống</p>
              <p className="mt-1 text-xs text-muted/60">
                Thêm món từ thực đơn nhé!
              </p>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemove}
                />
              ))}
              <div className="pt-2 text-center">
                <button
                  onClick={onClearCart}
                  className="text-xs text-muted underline hover:text-destructive transition-colors"
                >
                  Xoá tất cả
                </button>
              </div>
            </>
          )}
        </div>

        {/* Summary + CTA */}
        {items.length > 0 && (
          <div className="border-t border-border/20 pt-4">
            <OrderSummary
              subtotal={subtotal}
              serviceFee={serviceFee}
              deliveryFee={0}
              discount={0}
              total={total}
              qualifiesForFreeDelivery={qualifiesForFreeDelivery}
              remainingForFreeDelivery={remainingForFreeDelivery}
              className="mb-4"
            />
            <Button
              className="w-full"
              size="lg"
              onClick={onCheckout}
            >
              Thanh toán &rarr;
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
