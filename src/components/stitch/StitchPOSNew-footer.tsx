'use client';

import { useTranslation } from 'react-i18next';
import { LogOut, Receipt, Printer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LiveClock } from './StitchPOSNew-live-clock';

export function POSFooter({ cartOpen }: { cartOpen: boolean }) {
  const { t } = useTranslation();
  return (
    <footer
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-[rgba(24,16,10,0.9)] border-t border-[rgba(242,192,141,0.08)] flex justify-start items-center gap-5 px-6 h-14 z-50',
        'lg:right-96'
      )}
      role="contentinfo"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--aura-text-primary, #eae1db)] uppercase tracking-tight font-body">
          {t('posNew.terminalVersion')}
        </span>
        <div className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse" aria-label={t('posNew.connected')} />
      </div>
      <div className="h-5 w-px bg-[rgba(242,192,141,0.15)]" aria-hidden="true" />
      <nav className="flex items-center gap-3" aria-label={t('posNew.footerNav')}>
        <button
          type="button"
          className="text-[#8a7a6a] px-5 py-1.5 border border-[rgba(242,192,141,0.15)] rounded-full text-[11px] hover:border-[rgba(242,192,141,0.4)] hover:text-[var(--aura-text-primary, #eae1db)] transition-all active:scale-95 font-body"
          aria-label={t('posNew.openDrawer')}
        >
          <LogOut className="w-3.5 h-3.5 inline mr-1.5" />
          {t('posNew.openDrawer')}
        </button>
        <button
          type="button"
          className="text-[#8a7a6a] px-5 py-1.5 border border-[rgba(242,192,141,0.15)] rounded-full text-[11px] hover:border-[rgba(242,192,141,0.4)] hover:text-[var(--aura-text-primary, #eae1db)] transition-all active:scale-95 font-body"
          aria-label={t('posNew.printReceipt')}
        >
          <Printer className="w-3.5 h-3.5 inline mr-1.5" />
          {t('posNew.printReceipt')}
        </button>
        <button
          type="button"
          className="bg-[var(--aura-primary, #f2c08d)] text-[#1a1008] font-bold px-5 py-1.5 rounded-full text-[11px] active:scale-95 font-body"
          aria-label={t('posNew.endShift')}
        >
          <Receipt className="w-3.5 h-3.5 inline mr-1.5" />
          {t('posNew.endShift')}
        </button>
      </nav>
      <div className="ml-auto">
        <LiveClock />
      </div>
    </footer>
  );
}
