import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function Pagination({
  page,
  totalPages,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  t,
}: PaginationProps) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-muted">
        {t('audit.pagination.info', { page, totalPages, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
          {t('audit.pagination.prev')}
        </Button>
        <span className="px-2 text-xs text-muted">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next page"
        >
          {t('audit.pagination.next')}
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
