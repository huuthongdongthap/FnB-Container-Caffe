'use client';

import { useTranslation } from 'react-i18next';
import { LogOut, Receipt, Printer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LiveClock } from './StitchPOSNew-live-clock';

export function POSFooter({
  cartOpen: _cartOpen,
  onOpenDrawer,
  onPrintReceipt,
  onEndShift,
}: {
  cartOpen: boolean;
  onOpenDrawer?: () => void;
  onPrintReceipt?: () => void;
  onEndShift?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <footer
      data-testid="pos-footer"
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-[var(--aura-noir-void,#050814)]/95 backdrop-blur-md border-t border-[var(--aura-chrome-light,#B8C5D0)]/15 shadow-[0_-4px_20px_rgba(0,0,0,0.45)] flex items-center gap-3 sm:gap-5 px-3 sm:px-6 h-14 z-30',
        'lg:right-96'
      )}
      role="contentinfo"
    >
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-[var(--aura-text-primary,#eae1db)] uppercase tracking-tight font-body whitespace-nowrap">
          {t('posNew.terminalVersion')}
        </span>
        <div className="w-2 h-2 rounded-full bg-[var(--aura-success,#81C784)] animate-pulse" aria-label={t('posNew.connected')} />
      </div>
      <div className="hidden sm:block h-5 w-px bg-[var(--aura-chrome-light,#B8C5D0)]/20 shrink-0" aria-hidden="true" />
      <nav className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-x-auto" aria-label={t('posNew.footerNav')}>
        {onOpenDrawer && (
          <button
            type="button"
            onClick={() => onOpenDrawer()}
            className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-white/5 text-[var(--aura-text-primary,#eae1db)] px-3.5 sm:px-5 py-1.5 min-h-[36px] border border-[var(--aura-chrome-light,#B8C5D0)]/25 rounded-full text-[11px] font-medium hover:border-[var(--aura-chrome-light,#B8C5D0)]/50 hover:bg-white/10 transition-all active:scale-95 font-body cursor-pointer"
            aria-label={t('posNew.openDrawer')}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {t('posNew.openDrawer')}
          </button>
        )}
        <button
          type="button"
          onClick={() => (onPrintReceipt ? onPrintReceipt() : window.print())}
          className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-white/5 text-[var(--aura-text-primary,#eae1db)] px-3.5 sm:px-5 py-1.5 min-h-[36px] border border-[var(--aura-chrome-light,#B8C5D0)]/25 rounded-full text-[11px] font-medium hover:border-[var(--aura-chrome-light,#B8C5D0)]/50 hover:bg-white/10 transition-all active:scale-95 font-body cursor-pointer"
          aria-label={t('posNew.printReceipt')}
        >
          <Printer className="w-3.5 h-3.5 shrink-0" />
          {t('posNew.printReceipt')}
        </button>
        <button
          type="button"
          onClick={() => (onEndShift ? onEndShift() : window.location.assign('/admin/staff'))}
          className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-[#f2c08d] text-[#1a1008] hover:bg-[#f6cda3] font-bold px-3.5 sm:px-5 py-1.5 min-h-[36px] rounded-full text-[11px] shadow-sm transition-all active:scale-95 font-body cursor-pointer"
          aria-label={t('posNew.endShift')}
        >
          <Receipt className="w-3.5 h-3.5 shrink-0" />
          {t('posNew.endShift')}
        </button>
      </nav>
      <div className="ml-auto hidden md:block shrink-0">
        <LiveClock />
      </div>
    </footer>
  );
}
