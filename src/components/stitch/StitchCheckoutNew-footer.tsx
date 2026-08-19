import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { ShoppingBag, AlertTriangle, RefreshCw } from 'lucide-react';
import { glassPanelBg, formatPrice } from './StitchCheckoutNew-utils';
import type { CheckoutNewSummary } from './StitchCheckoutNew-types';

interface CheckoutFooterProps {
  summary: CheckoutNewSummary;
  locale: string;
  processing: boolean;
  displayError: string | null;
}

export function CheckoutFooter({
  summary,
  locale,
  processing,
  displayError,
}: Readonly<CheckoutFooterProps>) {
  const { t } = useTranslation();

  return (
    <footer className="fixed bottom-0 left-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        <div
          className={cn(
            glassPanelBg,
            'p-6 md:px-12 rounded-full border border-[rgba(198,198,199,0.3)] shadow-[0_-8px_30px_rgba(0,0,0,0.5)] flex flex-col md:flex-row justify-between items-center gap-4',
          )}
        >
          <div className="flex items-center gap-8">
            <div className="hidden md:flex flex-col">
              <span className="text-xs text-[var(--aura-chrome-soft)] uppercase tracking-widest">
                {t('stitch.selectedItems', 'Selected Items')}
              </span>
              <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] text-[#e5e2e1]">
                {summary.items.length} {t('stitch.items', 'Nocturnal Crafts')}
              </span>
            </div>
            <div className="flex flex-col items-center md:items-start">
              <span className="text-xs font-bold text-[var(--aura-chrome-bright)] uppercase tracking-widest">
                {t('stitch.totalAmount', 'Total Amount')}
              </span>
              <span className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[var(--aura-chrome-bright)]">
                {formatPrice(summary.total, locale)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={processing}
            className={cn(
              'min-w-[min(240px,60vw)] px-12 py-4 rounded-full font-[\'Space_Grotesk\'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] uppercase font-bold shadow-xl transition-all',
              'bg-gradient-to-br from-[#E3E2E3] via-[#C6C6C7] to-[var(--aura-chrome-dim)]',
              'text-[var(--aura-surface-container)]',
              processing
                ? 'cursor-not-allowed opacity-60'
                : 'hover:brightness-110 active:scale-95',
            )}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('stitch.processing', 'Processing...')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                {t('stitch.placeOrder', 'Place Order')}
              </span>
            )}
          </button>

          {displayError && (
            <div className="flex items-center gap-2 text-sm" role="alert" aria-live="assertive">
              <AlertTriangle className="w-4 h-4 text-[var(--aura-error)]" aria-hidden="true" />
              <span className="text-[var(--aura-error)]">{displayError}</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
