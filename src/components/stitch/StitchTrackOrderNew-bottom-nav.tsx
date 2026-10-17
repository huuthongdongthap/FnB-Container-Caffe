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
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 w-full z-50 backdrop-blur-[8px] bg-[var(--aura-surface-dim)]/80 border-t border-[var(--aura-chrome-soft)]/10 px-5 py-2 pb-safe pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex justify-around items-center w-full">
        <button
          type="button"
          onClick={() => onNavigate?.('/menu')}
          aria-label={t('nav.menu', 'Menu')}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-95 transition-transform duration-150"
        >
          <UtensilsCrossed className="w-6 h-6" />
          <span className="font-body text-[12px] font-medium tracking-[0.08em] mt-1">
            {t('nav.menu', 'Menu')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.('/track-order')}
          aria-label={t('nav.orders', 'Orders')}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center text-[var(--aura-bronze-shimmer)] bg-[var(--aura-bronze-shimmer)]/10 rounded-xl px-4 py-1 active:scale-95 transition-transform duration-150"
        >
          <Receipt className="w-6 h-6" />
          <span className="font-body text-[12px] font-medium tracking-[0.08em] mt-1">
            {t('nav.orders', 'Orders')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.('/account')}
          aria-label={t('nav.profile', 'Profile')}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-95 transition-transform duration-150"
        >
          <User className="w-6 h-6" />
          <span className="font-body text-[12px] font-medium tracking-[0.08em] mt-1">
            {t('nav.profile', 'Profile')}
          </span>
        </button>
      </div>
    </nav>
  );
}
