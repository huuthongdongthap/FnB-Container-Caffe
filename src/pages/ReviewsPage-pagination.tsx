import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReviewsPaginationProps {
  page: number;
  totalPages: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function ReviewsPagination({
  page,
  totalPages,
  hasMore,
  onPageChange,
}: Readonly<ReviewsPaginationProps>) {
  const { t } = useTranslation('reviews');

  if (totalPages <= 1) return null;

  return (
    <div
      className="flex items-center justify-center gap-4 px-6 pb-16"
      style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex items-center gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          backgroundColor:
            page <= 1
              ? 'var(--aura-bg-glass, rgba(11, 32, 56, 0.6))'
              : 'transparent',
          border:
            page > 1
              ? '1px solid var(--aura-border-card, rgba(255,255,255,0.08))'
              : '1px solid transparent',
          color: 'var(--aura-text-secondary, #a0a8b0)',
        }}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('previous')}
      </button>

      <span
        className="text-xs"
        style={{
          color: 'var(--aura-text-secondary, #a0a8b0)',
          fontFamily:
            'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
        }}
      >
        {t('pageOf', { page, totalPages })}
      </span>

      <button
        type="button"
        disabled={!hasMore}
        onClick={() => onPageChange(page + 1)}
        className="flex items-center gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          backgroundColor: !hasMore
            ? 'var(--aura-bg-glass, rgba(11, 32, 56, 0.6))'
            : 'transparent',
          border: hasMore
            ? '1px solid var(--aura-border-card, rgba(255,255,255,0.08))'
            : '1px solid transparent',
          color: 'var(--aura-text-secondary, #a0a8b0)',
        }}
      >
        {t('next')}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
