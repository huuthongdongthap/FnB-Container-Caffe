/**
 * StitchReviewsNew — Loading, error, and empty state components
 *
 * ReviewsSkeleton: pulsing placeholder grid shown during data fetch.
 * ReviewsError: glassmorphism error card with icon and message.
 * ReviewsEmpty: glassmorphism empty card inviting users to write first review.
 */

import { useTranslation } from 'react-i18next';
import { AlertCircle, MessageSquareQuote } from 'lucide-react';

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

export function ReviewsSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-surface-container)' }}>
      <div className="mx-auto max-w-[1200px] px-6 pt-24">
        {/* Header skeleton */}
        <div className="mb-16 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded" style={{ backgroundColor: '#0b2038' }} />
          <div className="flex items-center gap-4">
            <div className="h-8 w-16 animate-pulse rounded" style={{ backgroundColor: '#0b2038' }} />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 w-6 animate-pulse rounded" style={{ backgroundColor: '#0b2038' }} />
              ))}
            </div>
            <div className="h-4 w-32 animate-pulse rounded" style={{ backgroundColor: '#0b2038' }} />
          </div>
        </div>

        {/* Filter skeleton */}
        <div className="mb-8 flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-24 animate-pulse rounded-full" style={{ backgroundColor: '#0b2038' }} />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl" style={{ height: '24rem', backgroundColor: '#0b2038' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

export function ReviewsError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      role="alert"
      aria-live="assertive"
      style={{
        backgroundColor: 'rgba(11, 32, 56, 0.6)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(198, 198, 199, 0.15)',
        borderLeft: '1px solid rgba(198, 198, 199, 0.15)',
      }}
    >
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--aura-error)' }} />
      <h3
        className="text-xl font-semibold"
        style={{ fontFamily: "'EB Garamond', Georgia, serif", color: 'var(--aura-noir-void)' }}
      >
        {t('stitch.failedToLoadReviews', { defaultValue: 'Failed to load reviews' })}
      </h3>
      <p style={{ color: 'var(--aura-chrome-soft)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

export function ReviewsEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      role="status"
      style={{
        backgroundColor: 'rgba(11, 32, 56, 0.6)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(198, 198, 199, 0.15)',
        borderLeft: '1px solid rgba(198, 198, 199, 0.15)',
      }}
    >
      <MessageSquareQuote className="h-12 w-12" style={{ color: '#5a6270' }} />
      <h3
        className="text-xl font-semibold"
        style={{ fontFamily: "'EB Garamond', Georgia, serif", color: 'var(--aura-noir-void)' }}
      >
        {t('stitch.noReviewsYet', { defaultValue: 'No reviews yet' })}
      </h3>
      <p style={{ color: 'var(--aura-chrome-soft)' }}>
        {t('stitch.beFirstToShare', { defaultValue: 'Be the first to share your experience' })}
      </p>
    </div>
  );
}
