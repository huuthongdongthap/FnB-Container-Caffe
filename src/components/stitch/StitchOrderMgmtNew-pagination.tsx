/**
 * StitchOrderMgmtNew Pagination Footer
 * Page navigation with previous/next buttons and page numbers.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GLASS_CLASSES } from './stitch-order-mgmt-default';

/* ─── Pagination Footer ──────────────────────────────────────────────── */

export interface PaginationFooterProps {
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  currentCount?: number;
  onPageChange?: (page: number) => void;
}

function buildPageNumbers(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && page - prev > 1) {
      items.push('ellipsis');
    }
    items.push(page);
  }
  return items;
}

export function PaginationFooter({
  currentPage = 1,
  pageSize = 12,
  totalCount,
  currentCount = 0,
  onPageChange,
}: Readonly<PaginationFooterProps> = {}) {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  const resolvedPageSize = Math.max(1, pageSize);
  const resolvedTotal = Math.max(0, totalCount ?? currentCount);
  const totalPages = Math.max(1, Math.ceil(resolvedTotal / resolvedPageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageItems = buildPageNumbers(safePage, totalPages);
  const canGoPrev = safePage > 1;
  const canGoNext = safePage < totalPages;

  return (
    <footer
      className="mt-8 flex flex-col items-center justify-between gap-4 pb-6 sm:flex-row"
      aria-label={tTerminal('pagination')}
    >
      <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
        {tTerminal('showingOrders')
          .replace('{current}', String(currentCount))
          .replace('{total}', String(resolvedTotal))}
      </span>
      <div className="flex items-center gap-2">
        <button type="button"
          disabled={!canGoPrev}
          onClick={() => canGoPrev && onPageChange?.(safePage - 1)}
          className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95 disabled:opacity-40')}
          aria-label={tTerminal('prevPage')}
        >
          <ChevronLeft size={20} />
        </button>
        {pageItems.map((item, idx) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-1 text-[var(--aura-text-secondary, #a0a8b0)]"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button type="button"
              key={item}
              onClick={() => item !== safePage && onPageChange?.(item)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg font-sans text-[12px] font-bold uppercase tracking-[0.1em] transition-all',
                item === safePage
                  ? 'border border-[var(--aura-primary, #c6c6c7)]/50 bg-[var(--aura-primary, #c6c6c7)]/20 text-[var(--aura-primary, #c6c6c7)]'
                  : cn(GLASS_CLASSES, 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/10'),
              )}
              aria-label={tTerminal('page').replace('{n}', String(item))}
              aria-current={item === safePage ? 'true' : undefined}
            >
              {item}
            </button>
          ),
        )}
        <button type="button"
          disabled={!canGoNext}
          onClick={() => canGoNext && onPageChange?.(safePage + 1)}
          className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95 disabled:opacity-40')}
          aria-label={tTerminal('nextPage')}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </footer>
  );
}
