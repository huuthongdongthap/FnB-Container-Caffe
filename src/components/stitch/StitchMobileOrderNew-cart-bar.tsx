/**
 * Floating cart bar — fixed bottom summary with item count, total, and "View Cart" CTA.
 */
import { useTranslation } from 'react-i18next';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import type { CartItem } from './StitchMobileOrderNew-types';

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

interface FloatingCartBarProps {
  totalItems: number;
  totalPrice: number;
  cart: CartItem[];
  onViewCart?: (cart: CartItem[]) => void;
}

export function FloatingCartBar({
  totalItems,
  totalPrice,
  cart,
  onViewCart,
}: Readonly<FloatingCartBarProps>) {
  const { t } = useTranslation();

  return (
    <footer
      className="fixed bottom-0 left-0 w-full z-50 px-4 pb-6"
      aria-label={t('stitch.ordering.cartBar', {
        defaultValue: 'Cart summary',
      })}
    >
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{
          background: 'rgba(11, 32, 58, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(229, 228, 226, 0.25)',
          boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Cart Details */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart className="w-5 h-5 text-[var(--aura-primary, #c6c6c7)]" />
            <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[var(--aura-chrome-mid)] text-[10px] font-bold text-white flex items-center justify-center font-body">
              {totalItems}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-body text-[11px] text-[var(--aura-text-secondary, #a0a8b0)]">
              {t('stitch.ordering.total', { defaultValue: 'Total' })}
            </span>
            <span className="font-body text-[20px] text-[var(--aura-text-primary, #e8e8e8)] font-bold tracking-tight">
              {formatPrice(totalPrice)}
            </span>
          </div>
        </div>

        {/* View Cart Button */}
        <button
          type="button"
          onClick={() => onViewCart?.(cart)}
          className="bg-[var(--aura-chrome-mid)] text-white px-8 py-3 rounded-full font-body text-[12px] font-semibold tracking-wider uppercase active:scale-95 transition-transform shadow-lg flex items-center gap-2"
          aria-label={t('stitch.ordering.viewCart', {
            count: totalItems,
            defaultValue: `View cart with ${totalItems} items`,
          })}
        >
          {t('stitch.ordering.viewCartButton', {
            defaultValue: 'View Cart',
          })}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
}
