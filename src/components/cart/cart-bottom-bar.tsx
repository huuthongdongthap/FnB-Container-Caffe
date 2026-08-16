/**
 * CartBottomBar — persistent floating cart summary.
 * Shows when cart has items: total items + subtotal + CTA to checkout.
 * Animated slide-up entrance. Matches Aura Cafe dark luxury design system.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '@/hooks/stores/use-cart-store';

export default function CartBottomBar() {
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.totalItems);
  const subtotal = useCartStore((s) => s.subtotal);
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  const count = totalItems();
  const total = subtotal();

  useEffect(() => {
    if (count > 0) {
      // Delay entrance animation slightly
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [count]);

  if (count === 0) return null;

  const formatPrice = (n: number) =>
    n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[60] transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Glass backdrop */}
      <div className="mx-auto max-w-lg px-4 pb-4">
        <button
          type="button"
          onClick={() => navigate('/checkout')}
          className="w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5
                     bg-[var(--aura-noir-deep)]/95 backdrop-blur-md
                     border border-[var(--aura-border-chrome)]
                     shadow-[0_-4px_24px_rgba(0,0,0,0.4)]
                     active:scale-[0.98] transition-transform cursor-pointer"
        >
          {/* Left: item count + label */}
          <div className="flex items-center gap-2.5">
            {/* Cart icon with badge */}
            <div className="relative">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--aura-chrome-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--aura-chrome-mid)] text-[var(--aura-noir-void)] text-[11px] font-bold px-1">
                {count}
              </span>
            </div>
            <span className="text-sm font-medium text-[var(--aura-chrome-light)]">
              {count} món
            </span>
          </div>

          {/* Right: subtotal + CTA */}
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-[var(--aura-chrome-bright)]">
              {formatPrice(total)}
            </span>
            <span className="rounded-xl bg-[var(--aura-chrome-mid)] px-4 py-2 text-sm font-bold text-[var(--aura-noir-void)]">
              Thanh toán →
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
