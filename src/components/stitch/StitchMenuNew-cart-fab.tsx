'use client';

import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';

interface StitchMenuNewCartFabProps {
  cartItemCount: number;
  onCartClick?: () => void;
}

export function StitchMenuNewCartFab({ cartItemCount, onCartClick }: StitchMenuNewCartFabProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-8 right-8 z-40">
      <button
        onClick={onCartClick}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] shadow-xl transition-all duration-300 active:scale-95 hover:shadow-2xl hover:shadow-[var(--aura-chrome-bright)]/20"
        aria-label={t('stitch.cartAriaLabel')}
      >
        <ShoppingBag className="h-6 w-6" aria-hidden="true" />
        {cartItemCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--aura-surface-dim)]"
            aria-live="polite"
            aria-atomic="true"
          >
            {cartItemCount}
          </span>
        )}
      </button>
    </div>
  );
}
