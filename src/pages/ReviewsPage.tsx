/**
 * ReviewsPage — AURA CAFE Guest Reviews
 *
 * Dark navy glassmorphism reviews page matching the Stitch AI design.
 * Wire up to real API hooks with loading, error, empty states,
 * filter chips, write review form, and like interaction.
 *
 * Source: Stitch AI reviews/design.html export
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import {
  useReviews,
  useReviewsStats,
  useSubmitReview,
  type ReviewRecord,
} from '@/hooks/use-reviews';
import {
  Star,
  PenLine,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { StitchReviewsNew } from '@/components/stitch';
import type {
  ReviewEntry,
} from '@/components/stitch';
import type {
  ReviewsPageData,
  LoadingStatus,
} from '@/components/stitch/StitchReviewsNew';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/* ─── Data Transformation ────────────────────────────────────────────── */

function reviewRecordToEntry(record: ReviewRecord): ReviewEntry {
  const name = record.customer_name || 'Guest';
  return {
    id: record.id,
    author: name,
    avatarUrl: '',
    avatarAlt: '',
    rating: record.rating,
    content: record.comment || '',
    liked: false,
    likeCount: 0,
    date: formatDate(record.created_at),
  };
}

/* ─── Write Review Form ────────────────────────────────────────────── */

function WriteReviewForm({
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: Readonly<{
  onSubmit: (data: { customer_name: string; rating: number; comment: string }) => void;
  onClose: () => void;
  isSubmitting: boolean;
  error: string | null;
}>) {
  const { t } = useTranslation('reviews');
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    onSubmit({ customer_name: customerName, rating, comment });
  };

  const canSubmit = rating > 0 && !isSubmitting;

  return (
    <div
      className="mb-8 overflow-hidden rounded-xl p-6 md:p-8"
      style={{
        background: 'rgba(11, 32, 56, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(212, 165, 116, 0.25)',
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-1 transition-colors hover:bg-white/10"
        aria-label={t('closeForm')}
      >
        <X className="h-5 w-5" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }} />
      </button>

      <h3
        className="mb-6 text-2xl"
        style={{
          fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('shareExperience')}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer name */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('yourName')}
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('enterName')}
            required
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: 'var(--aura-bg-input, rgba(255,255,255,0.05))',
              color: 'var(--aura-text-primary, #e8e8e8)',
              border: '1px solid var(--aura-border-card, rgba(255,255,255,0.08))',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-focus, rgba(198,198,199,0.5))';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-card, rgba(255,255,255,0.08))';
            }}
          />
        </div>

        {/* Rating */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('rating')}
          </label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, idx) => {
              const starValue = idx + 1;
              const isFilled = starValue <= (hoverRating || rating);
              return (
                <button
                  key={idx}
                  type="button"
                  onMouseEnter={() => setHoverRating(starValue)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(starValue)}
                  className="transition-transform hover:scale-110"
                  aria-label={t('rateStars', { count: starValue })}
                >
                  <Star
                    className="h-6 w-6"
                    style={{
                      fill: isFilled ? 'var(--aura-tertiary, #d4a574)' : 'transparent',
                      color: isFilled
                        ? 'var(--aura-tertiary, #d4a574)'
                        : 'var(--aura-outline, #8e9097)',
                      transition: 'fill 0.15s ease, color 0.15s ease',
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('commentOptional')}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('commentPlaceholder')}
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-lg px-4 py-3 text-sm outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: 'var(--aura-bg-input, rgba(255,255,255,0.05))',
              color: 'var(--aura-text-primary, #e8e8e8)',
              border: '1px solid var(--aura-border-card, rgba(255,255,255,0.08))',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-focus, rgba(198,198,199,0.5))';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-card, rgba(255,255,255,0.08))';
            }}
          />
          <p
            className="mt-1 text-right text-xs"
            style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
          >
            {comment.length}/500
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm" style={{ color: 'var(--aura-error, #ffb4ab)' }}>
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, #c6c6c7 0%, #e3e2e3 50%, #8e9097 100%)'
              : 'var(--aura-bg-elevated, #162a3d)',
            color: canSubmit
              ? 'var(--aura-on-primary, #1a1a2e)'
              : 'var(--aura-text-disabled, #5a6270)',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" />
              {t('submitReview')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

/* ─── Main Page Component ──────────────────────────────────────────── */

export function ReviewsPage() {
  const { t } = useTranslation('reviews');
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [showForm, setShowForm] = useState(false);

  const { data: stats } = useReviewsStats();
  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useReviews(page, limit);
  const submitReview = useSubmitReview();

  const reviews = reviewsData?.data ?? [];
  const pagination = reviewsData?.pagination;
  const hasMore = pagination ? page < pagination.totalPages : false;

  /* ─── Derived ───────────────────────────────────────────────────── */

  const loadingState: LoadingStatus =
    reviewsLoading && reviews.length === 0
      ? 'loading'
      : reviewsError && reviews.length === 0
        ? 'error'
        : 'idle';

  const errorMessage: string | undefined =
    reviewsError && reviews.length === 0
      ? t('errorLoadMessage')
      : undefined;

  const reviewsPageData: ReviewsPageData = {
    aggregateRating: stats?.average_rating ?? 0,
    totalReviews: stats?.total_reviews ?? 0,
    reviews: reviews.map(reviewRecordToEntry),
  };

  /* ─── Handlers ──────────────────────────────────────────────────── */

  const handleSubmitReview = async (data: {
    customer_name: string;
    rating: number;
    comment: string;
  }) => {
    try {
      await submitReview.mutateAsync({
        order_id: 'manual',
        customer_name: data.customer_name,
        rating: data.rating,
        comment: data.comment || undefined,
      });
      setShowForm(false);
    } catch {
      // Error is surfaced via submitReview.error
    }
  };

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        color: 'var(--aura-text-primary, #e8e8e8)',
      }}
    >
      <HelmetHead
        title={t('seoTitle')}
        description={t('seoDescription')}
        canonical="/reviews"
      />

      {/* ── Write Review Form (toggled) ──────────────────────────── */}
      {showForm && (
        <div className="relative mx-auto max-w-[1200px] px-6 pt-24">
          <WriteReviewForm
            onSubmit={handleSubmitReview}
            onClose={() => setShowForm(false)}
            isSubmitting={submitReview.isPending}
            error={submitReview.error?.message ?? null}
          />
        </div>
      )}

      {/* ── StitchReviewsNew Section ─────────────────────────────── */}
      <StitchReviewsNew
        data={reviewsPageData}
        loadingState={loadingState}
        errorMessage={errorMessage}
        onWriteReview={() => setShowForm(true)}
        onToggleLike={() => {}}
        onLoadMore={() => handlePageChange(page + 1)}
      />

      {/* ── Pagination ──────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-4 px-6 pb-16"
          style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
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
            {t('pageOf', { page, totalPages: pagination.totalPages })}
          </span>

          <button
            type="button"
            disabled={!hasMore}
            onClick={() => handlePageChange(page + 1)}
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
      )}
    </div>
  );
}
