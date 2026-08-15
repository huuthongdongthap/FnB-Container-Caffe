/**
 * BottomNav — fixed bottom navigation bar
 */

import { useTranslation } from 'react-i18next';
import { Receipt, UtensilsCrossed, User } from 'lucide-react';

interface BottomNavProps {
  onNavigate?: (path: string) => void;
}

export function BottomNav({ onNavigate }: BottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 w-full z-50 backdrop-blur-xl bg-[var(--aura-surface-dim)]/80 border-t border-[var(--aura-chrome-soft)]/10 px-5 py-2 pb-safe">
      <div className="flex justify-around items-center w-full">
        <button
          onClick={() => onNavigate?.('/menu')}
          className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-95 transition-transform duration-150"
        >
          <UtensilsCrossed className="w-6 h-6" />
          <span className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] mt-1">
            {t('nav.menu', 'Menu')}
          </span>
        </button>

        <button
          onClick={() => onNavigate?.('/orders')}
          className="flex flex-col items-center justify-center text-[var(--aura-bronze-shimmer)] bg-[var(--aura-bronze-shimmer)]/10 rounded-xl px-4 py-1 active:scale-95 transition-transform duration-150"
        >
          <Receipt className="w-6 h-6" />
          <span className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] mt-1">
            {t('nav.orders', 'Orders')}
          </span>
        </button>

        <button
          onClick={() => onNavigate?.('/profile')}
          className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-95 transition-transform duration-150"
        >
          <User className="w-6 h-6" />
          <span className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] mt-1">
            {t('nav.profile', 'Profile')}
          </span>
        </button>
      </div>
    </nav>
  );
}
