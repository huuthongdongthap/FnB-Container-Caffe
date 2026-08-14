/**
 * StitchOrderMgmtNew Pagination Footer
 * Page navigation with previous/next buttons and page numbers.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GLASS_CLASSES } from './stitch-order-mgmt-default';

/* ─── Pagination Footer ──────────────────────────────────────────────── */

export function PaginationFooter() {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <footer
      className="mt-8 flex flex-col items-center justify-between gap-4 pb-6 sm:flex-row"
      aria-label={tTerminal('pagination')}
    >
      <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
        {tTerminal('showingOrders').replace('{current}', '6').replace('{total}', '124')}
      </span>
      <div className="flex items-center gap-2">
        <button
          className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95')}
          aria-label={tTerminal('prevPage')}
        >
          <ChevronLeft size={20} />
        </button>
        {[1, 2, 3].map((page) => (
          <button
            key={page}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg font-sans text-[12px] font-bold uppercase tracking-[0.1em] transition-all',
              page === 1
                ? 'border border-[var(--aura-primary, #c6c6c7)]/50 bg-[var(--aura-primary, #c6c6c7)]/20 text-[var(--aura-primary, #c6c6c7)]'
                : cn(GLASS_CLASSES, 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/10'),
            )}
            aria-label={tTerminal('page').replace('{n}', String(page))}
            aria-current={page === 1 ? 'true' : undefined}
          >
            {page}
          </button>
        ))}
        <span className="px-1 text-[var(--aura-text-secondary, #a0a8b0)]" aria-hidden="true">...</span>
        <button
          className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:bg-white/10 active:scale-95')}
          aria-label={tTerminal('page').replace('{n}', '12')}
        >
          12
        </button>
        <button
          className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95')}
          aria-label={tTerminal('nextPage')}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </footer>
  );
}
