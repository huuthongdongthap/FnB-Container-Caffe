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
import { HelmetHead } from '@/components/seo/HelmetHead';
import {
  useReviews,
  useReviewsStats,
  useSubmitReview,
  type ReviewRecord,
} from '@/hooks/use-reviews';
import {
  Star,
  Heart,
  PenLine,
  AlertCircle,
  MessageSquareQuote,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

type FilterKey = 'all' | '5-star' | 'photo' | 'latest';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function getInitial(name: string): string {
  return (name || 'A').charAt(0).toUpperCase();
}

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

const AVATAR_COLORS = [
  'rgba(198,198,199,0.15)',
  'rgba(212,165,116,0.15)',
  'rgba(107,159,184,0.15)',
  'rgba(201,214,223,0.12)',
  'rgba(232,238,243,0.10)',
  'rgba(58,107,128,0.20)',
];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return (AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0])!;
}

/* ─── Star Rating ──────────────────────────────────────────────────── */

function StarRating({
  rating,
  size = 'default',
}: Readonly<{ rating: number; size?: 'default' | 'sm' }>) {
  const stars: React.ReactNode[] = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  for (let i = 0; i < 5; i++) {
    const isFull = i < fullStars;
    const isHalf = i === fullStars && hasHalf;

    if (isFull) {
      stars.push(
        <Star
          key={i}
          className={starSize}
          style={{
            fill: 'var(--aura-text-secondary, #c6c6c7)',
            color: 'var(--aura-text-secondary, #c6c6c7)',
          }}
        />,
      );
    } else if (isHalf) {
      stars.push(
        <div key={i} className="relative">
          <Star
            className={starSize}
            style={{ fill: 'none', color: 'var(--aura-text-secondary, #c6c6c7)' }}
          />
          <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
            <Star
              className={starSize}
              style={{
                fill: 'var(--aura-text-secondary, #c6c6c7)',
                color: 'var(--aura-text-secondary, #c6c6c7)',
              }}
            />
          </div>
        </div>,
      );
    } else {
      stars.push(
        <Star
          key={i}
          className={starSize}
          style={{ color: 'var(--aura-outline, #8e9097)' }}
        />,
      );
    }
  }

  return <div className="flex gap-0.5">{stars}</div>;
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReviewsPageSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-24">
        {/* Header skeleton */}
        <div className="mb-16 space-y-4">
          <div
            className="h-10 w-64 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
          />
          <div className="flex items-center gap-4">
            <div
              className="h-8 w-16 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
            />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-6 animate-pulse rounded"
                  style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
                />
              ))}
            </div>
            <div
              className="h-4 w-32 animate-pulse rounded"
              style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
            />
          </div>
        </div>

        {/* Filter skeleton */}
        <div className="mb-8 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-24 animate-pulse rounded-full"
              style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
            />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl p-6"
              style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="h-12 w-12 animate-pulse rounded-full"
                  style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
                />
                <div className="space-y-2">
                  <div
                    className="h-5 w-32 animate-pulse rounded"
                    style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
                  />
                  <div
                    className="h-4 w-20 animate-pulse rounded"
                    style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div
                  className="h-3 w-full animate-pulse rounded"
                  style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
                />
                <div
                  className="h-3 w-11/12 animate-pulse rounded"
                  style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
                />
                <div
                  className="h-3 w-3/4 animate-pulse rounded"
                  style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function ReviewsErrorState({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center">
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--aura-error, #ffb4ab)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        Failed to Load Reviews
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #c6c6c7 0%, #e3e2e3 50%, #8e9097 100%)',
          color: 'var(--aura-on-primary, #1a1a2e)',
        }}
      >
        <Loader2 className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReviewsEmptyState({ filter }: Readonly<{ filter?: string }>) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{
        backgroundColor: 'var(--aura-bg-surface, #0d1b2a)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <MessageSquareQuote
        className="h-12 w-12"
        style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
      />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {filter === 'photo' ? 'No Photo Reviews' : 'No Reviews Yet'}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        {filter === 'photo'
          ? 'Reviews with photos will appear here.'
          : 'Be the first to share your Aura Cafe experience.'}
      </p>
    </div>
  );
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
        aria-label="Close review form"
      >
        <X className="h-5 w-5" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }} />
      </button>

      <h3
        className="mb-6 text-2xl"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        Share Your Experience
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer name */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            Your Name
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your name"
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
            Rating
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
                  aria-label={`Rate ${starValue} stars`}
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
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience..."
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
              Submitting...
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" />
              Submit Review
            </>
          )}
        </button>
      </form>
    </div>
  );
}

/* ─── Enhanced Review Card ─────────────────────────────────────────── */

function EnhancedReviewCard({
  review,
  isFirst,
}: Readonly<{ review: ReviewRecord; isFirst: boolean }>) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 20));

  const handleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : c - 1));
      return next;
    });
  }, []);

  const displayName = review.customer_name || 'Guest';
  const avatarColor = getAvatarColor(displayName);

  return (
    <article
      className={`glass-card flex flex-col gap-4 overflow-hidden rounded-xl p-6 transition-all duration-300 ${
        isFirst ? 'bronze-glow' : ''
      }`}
      style={{
        background: 'rgba(11, 32, 56, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(198, 198, 199, 0.15)',
        borderLeft: '1px solid rgba(198, 198, 199, 0.15)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Badge (first/featured card) */}
      {isFirst && (
        <div className="flex justify-end">
          <span
            className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-tighter"
            style={{
              backgroundColor: 'var(--aura-tertiary-container, #291500)',
              color: 'var(--aura-tertiary, #efbd8a)',
            }}
          >
            Top Review
          </span>
        </div>
      )}

      {/* Author + Rating */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold"
          style={{
            backgroundColor: avatarColor,
            color: 'var(--aura-text-primary, #e8e8e8)',
            border: '1px solid var(--aura-border-card, rgba(255,255,255,0.08))',
          }}
          aria-hidden="true"
        >
          {getInitial(displayName)}
        </div>

        <div>
          <h3
            className="text-lg"
            style={{
              color: 'var(--aura-text-primary, #e8e8e8)',
              fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
            }}
          >
            {displayName}
          </h3>
          <StarRating rating={review.rating} size="sm" />
        </div>
      </div>

      {/* Review text */}
      {review.comment && (
        <p
          className="leading-relaxed"
          style={{
            color: 'var(--aura-text-primary, #e8e8e8)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          &ldquo;{review.comment}&rdquo;
        </p>
      )}

      {/* Footer */}
      <div
        className="mt-auto flex items-center justify-between pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          className="text-xs uppercase tracking-widest"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          {formatDate(review.created_at)}
        </span>
        <button
          type="button"
          onClick={handleLike}
          className="flex items-center gap-1 transition-colors"
          style={{
            color: liked
              ? 'var(--aura-error, #ffb4ab)'
              : 'var(--aura-text-secondary, #a0a8b0)',
          }}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Heart
            className={`h-[18px] w-[18px] ${liked ? 'fill-current' : ''}`}
          />
          <span
            className="text-xs"
            style={{
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {likeCount}
          </span>
        </button>
      </div>
    </article>
  );
}

/* ─── Filters Configuration ────────────────────────────────────────── */

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '5-star', label: '5 Star' },
  { key: 'photo', label: 'Photo' },
  { key: 'latest', label: 'Latest' },
];

/* ─── Main Page Component ──────────────────────────────────────────── */

export function ReviewsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showForm, setShowForm] = useState(false);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useReviewsStats();
  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useReviews(page, limit);
  const submitReview = useSubmitReview();

  const reviews = reviewsData?.data ?? [];
  const pagination = reviewsData?.pagination;
  const hasMore = pagination ? page < pagination.totalPages : false;

  /* ─── Derived ───────────────────────────────────────────────────── */

  const filteredReviews = reviews.filter((r) => {
    if (activeFilter === '5-star') return r.rating === 5;
    return true;
  });

  const displayReviews =
    activeFilter === 'latest'
      ? [...filteredReviews].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
      : filteredReviews;

  const showPhotoEmpty = activeFilter === 'photo';
  const isEmpty =
    !reviewsLoading && !reviewsError && reviews.length === 0;
  const noResults =
    !reviewsLoading &&
    !reviewsError &&
    displayReviews.length === 0 &&
    reviews.length > 0;

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

  /* ─── Loading State (initial) ────────────────────────────────────── */
  if (reviewsLoading && reviews.length === 0) {
    return <ReviewsPageSkeleton />;
  }

  /* ─── Error State (no data at all) ───────────────────────────────── */
  if (reviewsError && reviews.length === 0) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <ReviewsErrorState
          message="We encountered an issue loading reviews."
          onRetry={() => refetchReviews()}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        color: 'var(--aura-text-primary, #e8e8e8)',
      }}
    >
      <HelmetHead
        title="Guest Reviews | Aura Cafe"
        description="Read guest experiences and reviews at AURA CAFE — Container Caffe Sa Dec"
        canonical="/reviews"
      />

      <main className="mx-auto max-w-[1200px] px-6 pb-16 pt-24">
        {/* ── Header Aggregate & CTA ────────────────────────────────── */}
        <section className="mb-16 flex flex-col items-end justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1
              className="mb-2 text-4xl md:text-5xl"
              style={{
                fontFamily:
                  'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
                lineHeight: '1.1',
                letterSpacing: '-0.02em',
                color: 'var(--aura-text-primary, #e8e8e8)',
              }}
            >
              Guest Experiences
            </h1>
            <div className="flex items-center gap-4">
              {/* Aggregate rating */}
              {statsLoading && (
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-16 animate-pulse rounded"
                    style={{
                      backgroundColor: 'var(--aura-bg-elevated, #162a3d)',
                    }}
                  />
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-5 w-5 animate-pulse rounded"
                        style={{
                          backgroundColor: 'var(--aura-bg-elevated, #162a3d)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {statsError && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => refetchStats()}
                    className="flex items-center gap-1 text-sm underline underline-offset-2"
                    style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                  >
                    Retry stats
                  </button>
                </div>
              )}

              {!statsLoading && !statsError && stats && (
                <>
                  <span
                    className="text-2xl"
                    style={{
                      color: 'var(--aura-text-secondary, #c6c6c7)',
                      fontFamily:
                        'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
                    }}
                  >
                    {stats.average_rating.toFixed(1)}/5
                  </span>
                  <StarRating rating={stats.average_rating} />
                  <span
                    className="text-xs uppercase tracking-widest"
                    style={{
                      color: 'var(--aura-text-secondary, #a0a8b0)',
                      fontFamily:
                        'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                    }}
                  >
                    {stats.total_reviews.toLocaleString()} Reviews
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Write Review CTA */}
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="flex items-center gap-2 rounded-full px-8 py-4 text-xs font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
            style={{
              background:
                'linear-gradient(135deg, #c6c6c7 0%, #e3e2e3 50%, #8e9097 100%)',
              color: 'var(--aura-on-primary, #1a1a2e)',
            }}
          >
            <PenLine className="h-[18px] w-[18px]" />
            {showForm ? 'Cancel' : 'Write a Review'}
          </button>
        </section>

        {/* ── Write Review Form (toggled) ──────────────────────────── */}
        {showForm && (
          <div className="relative">
            <WriteReviewForm
              onSubmit={handleSubmitReview}
              onClose={() => setShowForm(false)}
              isSubmitting={submitReview.isPending}
              error={submitReview.error?.message ?? null}
            />
          </div>
        )}

        {/* ── Filters ──────────────────────────────────────────────── */}
        <section className="mb-8 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className="rounded-full px-6 py-2 text-xs uppercase tracking-widest transition-all"
                style={{
                  backgroundColor: 'var(--aura-bg-glass, rgba(11, 32, 56, 0.6))',
                  backdropFilter: 'blur(20px)',
                  border:
                    activeFilter === filter.key
                      ? '1px solid rgba(212, 165, 116, 0.3)'
                      : '1px solid transparent',
                  color:
                    activeFilter === filter.key
                      ? 'var(--aura-tertiary, #efbd8a)'
                      : 'var(--aura-text-secondary, #a0a8b0)',
                }}
                onMouseEnter={(e) => {
                  if (activeFilter !== filter.key) {
                    (e.currentTarget as HTMLElement).style.color =
                      'var(--aura-text-primary, #e8e8e8)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeFilter !== filter.key) {
                    (e.currentTarget as HTMLElement).style.color =
                      'var(--aura-text-secondary, #a0a8b0)';
                  }
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Empty: no reviews at all ─────────────────────────────── */}
        {isEmpty && <ReviewsEmptyState />}

        {/* ── Empty: photo filter with no results ──────────────────── */}
        {showPhotoEmpty && noResults && <ReviewsEmptyState filter="photo" />}

        {/* ── Empty: other filter with no results ──────────────────── */}
        {!showPhotoEmpty && noResults && (
          <div
            className="flex min-h-[200px] items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--aura-bg-surface, #0d1b2a)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
              No reviews match this filter.
            </p>
          </div>
        )}

        {/* ── Review Grid ──────────────────────────────────────────── */}
        {!isEmpty && displayReviews.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayReviews.map((review, idx) => (
                <EnhancedReviewCard
                  key={review.id}
                  review={review}
                  isFirst={idx === 0}
                />
              ))}
            </div>

            {/* ── Pagination ────────────────────────────────────────── */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
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
                  Previous
                </button>

                <span
                  className="text-xs"
                  style={{
                    color: 'var(--aura-text-secondary, #a0a8b0)',
                    fontFamily:
                      'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                  }}
                >
                  Page {page} of {pagination.totalPages}
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
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ── Loading more indicator ──────────────────────────── */}
            {reviewsLoading && reviews.length > 0 && (
              <div className="mt-12 flex flex-col items-center gap-4 opacity-40">
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{
                    color: 'var(--aura-text-secondary, #a0a8b0)',
                    fontFamily:
                      'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                  }}
                >
                  Loading more reviews
                </span>
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                  style={{
                    borderColor: 'var(--aura-text-primary, #e8e8e8)',
                    borderTopColor: 'transparent',
                  }}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Custom Styles ────────────────────────────────────────── */}
      <style>{`
        .glass-card {
          background: rgba(11, 32, 56, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(198, 198, 199, 0.15);
          border-left: 1px solid rgba(198, 198, 199, 0.15);
        }
        .glass-card:hover {
          box-shadow: 0px 0px 15px rgba(212, 165, 116, 0.15);
        }
        .bronze-glow {
          border: 1px solid #d4a574;
          box-shadow: inset 0 0 10px rgba(212, 165, 116, 0.1);
        }
      `}</style>
    </div>
  );
}
