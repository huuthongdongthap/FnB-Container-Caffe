import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';
import { CartFabProps } from './StitchMenu2New-types';

export function CartFab({ cartItemCount, onCartClick }: CartFabProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8">
      <button
        onClick={onCartClick}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E5E4E2] text-[#1e314a] shadow-xl transition-all active:scale-95 hover:shadow-2xl md:h-16 md:w-16"
        aria-label={t('stitch.menu2.cartAriaLabel')}
      >
        <ShoppingBag className="h-6 w-6" aria-hidden="true" />
        {cartItemCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--aura-bg-page, #0A1A2E)]"
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
