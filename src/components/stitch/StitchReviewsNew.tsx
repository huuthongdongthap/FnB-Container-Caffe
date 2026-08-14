/**
 * StitchReviewsNew — AURA CAFE Guest Reviews (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy glassmorphism reviews section with aggregate rating header,
 * filter chips, review card grid (highlighted + standard), like toggle,
 * and infinite scroll loading indicator.
 * Source: Stitch AI reviews/design.html export (exact match).
 * Mobile-first responsive. Named export.
 *
 * Modularized: sub-components, types, data, styles, and hook extracted
 * into sibling files for maintainability (<200 LOC each).
 */
'use client';

import { useTranslation } from 'react-i18next';
import { Star, Pencil } from 'lucide-react';

/* ─── Extracted Modules ────────────────────────────────────────────── */

import type { StitchReviewsNewProps, FilterOption } from './stitch-reviews-new-types';
import { DEFAULT_REVIEWS_DATA } from './stitch-reviews-default';
import { REVIEWS_STYLES } from './stitch-reviews-new-styles';
import { ReviewsSkeleton, ReviewsError, ReviewsEmpty } from './stitch-reviews-new-states';
import { HalfStar } from './stitch-reviews-new-rating';
import { ReviewCard } from './stitch-reviews-new-card';
import { ReviewsNavHeader } from './stitch-reviews-new-nav';
import { ReviewsFooter } from './stitch-reviews-new-footer';
import { useStitchReviews } from './use-stitch-reviews';

/* ─── Re-export types for external consumers (ReviewsPage, index) ──── */

export type {
  StitchReviewsNewProps,
  ReviewEntry,
  ReviewImageData,
  FilterOption,
  ReviewsPageData,
  LoadingStatus,
} from './stitch-reviews-new-types';

/* ─── Filter chip labels ───────────────────────────────────────────── */

function getFilters(t: (key: string, opts?: Record<string, string>) => string) {
  return [
    { key: 'all' as FilterOption, label: t('stitch.filterAll', { defaultValue: 'All' }) },
    { key: '5-star' as FilterOption, label: t('stitch.filter5Star', { defaultValue: '5 Star' }) },
    { key: 'photo' as FilterOption, label: t('stitch.filterPhoto', { defaultValue: 'Photo' }) },
    { key: 'latest' as FilterOption, label: t('stitch.filterLatest', { defaultValue: 'Latest' }) },
  ];
}

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchReviewsNew({
  data = DEFAULT_REVIEWS_DATA,
  loadingState = 'idle',
  errorMessage,
  onWriteReview,
  onFilterChange,
  onToggleLike,
  onLoadMore,
}: Readonly<StitchReviewsNewProps>) {
  const { t } = useTranslation();
  const { activeFilter, handleFilter, visibleReviews } = useStitchReviews(data);

  const resolvedErrorMessage =
    errorMessage ?? t('stitch.unexpectedError', { defaultValue: 'An unexpected error occurred' });

  const filters = getFilters(t);
  const fullStars = Math.floor(data?.aggregateRating ?? 0);
  const hasHalf = (data?.aggregateRating ?? 0) - fullStars >= 0.5;

  /* ─── Loading ──────────────────────────────────────────────────── */
  if (loadingState === 'loading') return <ReviewsSkeleton />;

  /* ─── Error ────────────────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--aura-surface-container)' }}>
        <ReviewsError message={resolvedErrorMessage} />
      </div>
    );
  }

  /* ─── Empty ────────────────────────────────────────────────────── */
  if (!data || data.reviews.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--aura-surface-container)' }}>
        <ReviewsEmpty />
      </div>
    );
  }

  /* ─── Full Render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen overflow-x-hidden antialiased" style={{ backgroundColor: 'var(--aura-surface-container)', color: '#d3e4ff' }}>
      <ReviewsNavHeader />

      <main className="mx-auto max-w-[1200px] px-6 pb-16" style={{ paddingTop: '96px' }}>
        {/* ── Aggregate Rating Header + Write Review CTA ────────── */}
        <section className="flex flex-col items-end justify-between gap-4 mb-16 md:flex-row md:items-center">
          <div>
            <h1
              className="mb-2"
              style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '48px', lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: 500, color: 'var(--aura-noir-void)' }}
            >
              {t('stitch.guestExperiences', { defaultValue: 'Guest Experiences' })}
            </h1>
            <div className="flex items-center gap-4">
              <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '24px', lineHeight: '1.3', fontWeight: 500, color: '#c6c6c7' }}>
                {data.aggregateRating}/5
              </span>
              <div className="flex gap-1">
                {Array.from({ length: fullStars }).map((_, i) => (
                  <Star key={i} className="h-5 w-5" fill="#c6c6c7" style={{ color: '#c6c6c7' }} />
                ))}
                {hasHalf && <HalfStar className="h-5 w-5" color="#c6c6c7" />}
              </div>
              <span
                className="uppercase tracking-widest"
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '12px', lineHeight: '1.0', letterSpacing: '0.1em', fontWeight: 600, color: 'var(--aura-chrome-soft)' }}
              >
                {data.totalReviews.toLocaleString()} {t('stitch.reviews', { defaultValue: 'Reviews' })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onWriteReview}
            className="chrome-gradient group flex items-center gap-2 rounded-full px-8 py-4 text-[#0c1c30] uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '12px', lineHeight: '1.0', letterSpacing: '0.1em', fontWeight: 600 }}
            aria-label={t('stitch.writeAReview', { defaultValue: 'Write a Review' })}
          >
            <Pencil className="h-[18px] w-[18px] transition-transform group-hover:rotate-12" />
            {t('stitch.writeAReview', { defaultValue: 'Write a Review' })}
          </button>
        </section>

        {/* ── Filter Chips ─────────────────────────────────────── */}
        <section className="mb-8 overflow-x-auto pb-4" aria-label="Review filters">
          <div className="flex min-w-max gap-4">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleFilter(filter.key, onFilterChange)}
                className={`glass-card rounded-full px-6 py-2 uppercase tracking-widest transition-colors ${
                  activeFilter === filter.key
                    ? 'border border-[var(--aura-chrome-bright)]/30 text-[var(--aura-chrome-bright)]'
                    : 'text-[var(--aura-chrome-soft)] hover:text-[var(--aura-noir-void)]'
                }`}
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '12px', lineHeight: '1.0', letterSpacing: '0.1em', fontWeight: 600 }}
                aria-pressed={activeFilter === filter.key}
                aria-label={`Filter by ${filter.label}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Review Grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3" role="feed" aria-label={t('stitch.guestExperiences', { defaultValue: 'Guest Experiences' })}>
          {visibleReviews.map((review) => (
            <ReviewCard key={review.id} review={review} onToggleLike={onToggleLike} />
          ))}
        </div>

        {/* ── Scroll / Loading Indicator ───────────────────────── */}
        <div className="mt-8 flex flex-col items-center gap-4 opacity-40" aria-hidden={!onLoadMore}>
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", lineHeight: '1.0', letterSpacing: '0.1em' }}
          >
            {onLoadMore
              ? t('stitch.loadingMoreExperiences', { defaultValue: 'Loading more experiences' })
              : t('stitch.scrollToLoadMore', { defaultValue: 'Scroll to load more' })}
          </span>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--aura-noir-void)] border-t-transparent" />
        </div>
      </main>

      <ReviewsFooter />
      <style>{REVIEWS_STYLES}</style>
    </div>
  );
}
