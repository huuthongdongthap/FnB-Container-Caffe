/**
 * StitchReviewsNew — AURA CAFE Guest Reviews (Stitch design, New version)
 *
 * Dark navy glassmorphism reviews section with aggregate rating header,
 * filter chips, review card grid (highlighted + standard), like toggle,
 * and infinite scroll loading indicator.
 * Source: Stitch AI reviews/design.html export.
 * Mobile-first responsive. Named export.
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface ReviewImageData {
  url: string;
  alt: string;
}

export interface ReviewEntry {
  id: string;
  author: string;
  avatarUrl: string;
  avatarAlt: string;
  rating: number;
  content: string;
  liked: boolean;
  likeCount: number;
  date: string;
  images?: ReviewImageData[];
  isHighlighted?: boolean;
  badge?: string;
}

export type FilterOption = 'all' | '5-star' | 'photo' | 'latest';

export interface ReviewsPageData {
  aggregateRating: number;
  totalReviews: number;
  reviews: ReviewEntry[];
}

export type LoadingStatus = 'idle' | 'loading' | 'error';

export interface StitchReviewsNewProps {
  /** Reviews page data with aggregate rating and entries */
  data?: ReviewsPageData;
  /** Current loading state */
  loadingState?: LoadingStatus;
  /** Custom error message */
  errorMessage?: string;
  /** Callback when "Write a Review" is clicked */
  onWriteReview?: () => void;
  /** Callback when filter changes */
  onFilterChange?: (filter: FilterOption) => void;
  /** Callback when like is toggled */
  onToggleLike?: (reviewId: string, liked: boolean) => void;
  /** Callback when loading more reviews */
  onLoadMore?: () => void;
}

/* ─── Default Mock Data ────────────────────────────────────────────── */

const DEFAULT_REVIEWS: ReviewEntry[] = [
  {
    id: 'r1',
    author: 'Isabella Vane',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBRZTGRw_I-Xip7jYDLvA8Lt6wHWaFWzBe-xuoc31GO6nB9rYfPxwntNHW1AoFtTOse2NOwrHOgcZ2opcWNDeiy-7niEXlpjPWe_b1XifqZnlew6SYL1C0SkLXAx4YLlpYldf2nHydS6L3IcerPDA8off3jyd8tyhWr4oAz5IGrocg-6tIQq2f7VS1cwXMkQnR3PQHjzwjXTNbMVgliBSo0-jbi2cnDxJEaXbw0R3fHodRRDSO4eA2Po157DGe5qH6DPuekbrrR748',
    avatarAlt: 'Elegant woman with minimalist jewelry in amber cafe lighting',
    rating: 5,
    content:
      'The midnight espresso selection is unparalleled. The industrial architecture of the space creates a cocoon of luxury that makes every visit feel like a secret ritual. The texture of the velvet seating against the cold steel is pure sensory genius.',
    liked: true,
    likeCount: 42,
    date: 'Oct 14, 2023',
    isHighlighted: true,
    badge: "Chef's Choice",
    images: [
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIkJkLEhh-JIpZhIAzqfMhhYbYnd1pfAjiUu7WCfxGO-hkBGjkWkxrysLkQFz7Wk6Dquqde11XlB8vqlCkScep50xLHZLl1dqtyvhzIaTqdhhGk2nUvb1OLaYKqr33X5vgGc1xRoNkmsHooRsxRt4Gq3YdXzPNkWoePeYxfjBER26Gh1XnVBGVAId6AK37X8G0If0vZXcqGYMGPl_GOKt3TTS39-Zmqu1rIWOu9PtobvagRB-e_UcM51EUA8VemSiJoasQiUKAj5A',
        alt: 'Latte with intricate foam art on black marble table',
      },
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDY0kZTzu_eDCzdeNtwOb5PDzk6AfBvfpyjeWYa5QzAiHJ-V7rJxv6OhovjTg1Ca882ie74XGdCsyf9DJuMbTBSChCk_g466fqeUEM8buyQg6-QN3uEko28b9oLrb9QJBycRc3Mph8WR4k4kdHoWKQ78slLnQqlORIUn0U9qs3H1Ei6Xi4C6iVwaMnkXjBdk_FpN18e_pQEV9uHpz12Eb1QdQPytGC2_P5hW4zauK1GcNBAptGSjej-2LKVGjjtKRlDeaJKOb77MdA',
        alt: 'Interior showing minimalist glass partition with warm lighting',
      },
    ],
  },
  {
    id: 'r2',
    author: 'Julian Thorne',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAZtfpoH6WXtP2CbmVXqWYVHvMv1WpAHWf3ikBODhROUfMIAcbI3qyrYLJv3OcWHqisRWfcFHuCpk5WFsQe70rdircMLzWc7RhOjzohSt9jsTqKoLReJYP5ENxiXCSSj-DBaCevpGYshcEb_QZnJrT26FLzSb5x28saeqJza6bITZwrOG8_YP2TWM44GNVTdC6dZ1lYrWIdriA54bV8b48wOswGqPsMTL_vJZJ5t_YUAh8FnRQ5ceQ4EGbJmf_Grap0nBsO0iVUVZU',
    avatarAlt: 'Man in dark charcoal turtleneck with thoughtful expression',
    rating: 4,
    content:
      'A masterclass in atmosphere. The lighting design alone is worth the reservation. Perfect for late-night meetings where privacy and aesthetics are paramount.',
    liked: false,
    likeCount: 18,
    date: 'Oct 12, 2023',
    images: [
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBkfvITRussIW0rvnfjcteP4oPrgMESCj_3jKFknxAbcunHPHF88S5dZD2S3ybXK5KxveDqm99bXCiJT6L2_ko1AipvopRS8Y6fgVcUkE1O7jSEhDw34b_I6kQ49pR_-7I0ryKgwWkBk1OvmaZFnLVbyX4hnEvWzb_88hZJijVKL_ygD8dIt7pvuto86_uyzrEn8ucykKvla9s5kc8ZGNEn-jG0IALJe3QIpuThXsyLHJ18oIRjKvC5avIA44wfXVRkNUzm42Yij2k',
        alt: 'Wide angle cafe interior with floor-to-ceiling windows and city view',
      },
    ],
  },
  {
    id: 'r3',
    author: 'Sienna Ray',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC3uNkiVtFXChMrZPskDLX_8x0PhSJEqRnuXrCpQa-sY1LGVZhx2s9L3s7bWuhlwoxucXLb_G5ZY0Vn__PlasXzU8cjRc2TO4bmk3Zy-aZjiOjk35xl3SDNHTJnoKsPekuoJRTEKz4tkZa1tMTJmJpoeuHJlIIGDb-WRR2FBHagn6eIo1yi7GMMDumYYXp7_OrzCqNRfS9h508qD48W1Idx-7yosjk-hyvR9yfcno_PUtVqlrDOWzxCMm5PC3UseljrIXW6Z2HUl9U',
    avatarAlt: 'Creative professional woman lit by tablet glow in dark setting',
    rating: 5,
    content:
      'The smoked truffle croissant is a revelation. I\'ve never seen such attention to detail in cafe service. It feels more like a private lounge than a cafe.',
    liked: false,
    likeCount: 24,
    date: 'Oct 09, 2023',
  },
  {
    id: 'r4',
    author: 'Marcus Sterling',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDCl21e8B8y_p-chcJY0g2yge7sAlLGi5f_QHyHyaY4iMCAHb-2z8t_oxKXnEqtb-GD2cDynmx-sBVNU7WcYQFauwW-G9hjPihKhK6EJfSbLzz17WFI3_gMqjZC_M1f-4klxSRrgUI3DSfA8d8mRZiYtxfRb3LNP2iGytC9uPRcKV2D9VE9KzHE05RNo_zaYKhg2BjWG5U1nKA-hVuIF-l7h55H5jTa-M3uHo6DyNqVMl16v5T1fgEntSfOATE86AaikwXpZf1kGeY',
    avatarAlt: 'Older man with silver hair in sharp navy blazer',
    rating: 5,
    content:
      'Aura provides the precision I require. Quiet, dark, and perfectly balanced. The architecture speaks to a forgotten era of high-end craftsmanship.',
    liked: false,
    likeCount: 12,
    date: 'Oct 05, 2023',
  },
  {
    id: 'r5',
    author: 'Leo Chen',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDdewO5H_wE6ciuCLdEe-S0Yb_1lKWv8GO97Zc-CmoTk3R4X3YnIGR3kUfW9EPphByxWknPs4Yce-TR8UUdhylWFISZYwe33NI2HiKkXN1fZ8GGynkDb7PvriY6OcxKebVoiiweb3S8VYRkh-ZIBAAcsCcbIWV2fNAmJabnKyQIYp6seJc5-PnfGH8or8kKf9BHcnnw8vTFGuVZ2y0z14ah-tyGl3Wo294HGCs8mcEo1cbvEylyzTx_w6EZsvE0B90V5S1z0IJlNMA',
    avatarAlt: 'Young man with glasses, neon chrome reflection on lenses',
    rating: 5,
    content:
      'Unreal aesthetics. Every corner is a photograph waiting to happen. The Dark Velvet latte is a must-try.',
    liked: false,
    likeCount: 89,
    date: 'Sep 28, 2023',
    images: [
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8u_4wEl-rwdM8Hd9TgLS0ObzY6HdeIWjzv_PSQGKLNOueo8BoU59WNmUTimKCNUBdsSq0VXiQ4wDRhn0AggL4fDq1bT4829jW4woP05iP6g7ycQnIq25y9JU-KYLTU8ujLEOMJyijEvvgvBLhtfwkYqdQ-BfFsBNlMIxO0bms-ilqVJ49Xl8W80pcK3FR0rwm7WspFFUOHGG2ELxNLJEf8GJpSYIJ3I91UF9idV71wiVLuusdwJGvxNSoY_2PO-O8Ff0SNhBv6UQ',
        alt: 'Macro shot of dark chocolate dessert with gold leaf',
      },
    ],
  },
  {
    id: 'r6',
    author: 'Elena K.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA8N1q8_L2ppbrtWF0UX06qbfE8r_UqN3Ft929qG0S3rczb4bOFZUaEFDUW3Nev4IpPEvsZql0ILR9Z5pCcQEwkUYiTJ4IgFTn6BgL-gxWcReSIDMEbUfE8d4Uhu7OLSZEE1rOoS_zEJW6LnHMsFV4VtejIX6ZaQ4nNuDxZcYQeooKDENOWTLT20MTPslqJoRIokPU1XdsZlud_6TEdBXpNfDZ7oQpO0gr19NNuAp-WMe2t9d5MbPjy571ysrcd0lgqe_wl4W7XW0o',
    avatarAlt: 'Woman with sharp bob haircut silhouetted against glass wall',
    rating: 4,
    content:
      'The acoustic dampening here is incredible. Even when full, it maintains this serene, heavy silence that is so rare in the city.',
    liked: false,
    likeCount: 5,
    date: 'Sep 25, 2023',
  },
];

const DEFAULT_REVIEWS_DATA: ReviewsPageData = {
  aggregateRating: 4.9,
  totalReviews: 1248,
  reviews: DEFAULT_REVIEWS,
};

/* ─── Inline SVGs ──────────────────────────────────────────────────── */

function StarIcon({
  filled = false,
  className = 'h-5 w-5',
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function HeartIcon({
  filled = false,
  className = 'h-5 w-5',
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function PenIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function SpinnerIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function AlertIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

function QuoteIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  );
}

/* ─── Star Rating ──────────────────────────────────────────────────── */

function StarRating({
  rating,
  size = 'default',
}: {
  rating: number;
  size?: 'default' | 'sm';
}) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <StarIcon
          key={i}
          filled
          className={`${iconClass} text-[var(--aura-primary, #c6c6c7)]`}
        />,
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <div key={i} className="relative">
          <StarIcon className={`${iconClass} text-[var(--aura-primary, #c6c6c7)]`} />
          <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
            <StarIcon filled className={`${iconClass} text-[var(--aura-primary, #c6c6c7)]`} />
          </div>
        </div>,
      );
    } else {
      stars.push(
        <StarIcon
          key={i}
          className={`${iconClass} text-[#44474d]`}
        />,
      );
    }
  }

  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {stars}
    </div>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReviewsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)]">
      <div className="mx-auto max-w-[1200px] px-6 pt-24">
        {/* Header skeleton */}
        <div className="mb-12 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-[#162a3d]" />
          <div className="flex items-center gap-4">
            <div className="h-8 w-16 animate-pulse rounded bg-[#162a3d]" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 w-6 animate-pulse rounded bg-[#162a3d]" />
              ))}
            </div>
            <div className="h-4 w-32 animate-pulse rounded bg-[#162a3d]" />
          </div>
        </div>

        {/* Filter skeleton */}
        <div className="mb-6 flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-[#162a3d]" />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-xl bg-[#162a3d]" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function ReviewsError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[var(--aura-bg-surface, #071c33)]/80 p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      <AlertIcon className="h-12 w-12 text-[#ffb4ab]" />
      <h3 className="font-display text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]">
        {t('stitch.failedToLoadReviews')}
      </h3>
      <p className="text-[var(--aura-text-secondary, #a0a8b0)]">{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReviewsEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[var(--aura-bg-surface, #071c33)]/80 p-8 text-center"
      role="status"
    >
      <QuoteIcon className="h-12 w-12 text-[#5a6270]" />
      <h3 className="font-display text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]">
        {t('stitch.noReviewsYet')}
      </h3>
      <p className="text-[var(--aura-text-secondary, #a0a8b0)]">{t('stitch.beFirstToShare')}</p>
    </div>
  );
}

/* ─── Review Card ──────────────────────────────────────────────────── */

function ReviewCard({
  review,
  onToggleLike,
}: {
  review: ReviewEntry;
  onToggleLike?: (id: string, liked: boolean) => void;
}) {
  const [liked, setLiked] = useState(review.liked);
  const [likeCount, setLikeCount] = useState(review.likeCount);

  const handleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : c - 1));
      onToggleLike?.(review.id, next);
      return next;
    });
  }, [review.id, onToggleLike]);

  return (
    <article
      className={
        `flex flex-col gap-4 overflow-hidden rounded-xl bg-[#0b2038]/60 p-6 transition-all duration-300 hover:shadow-[0_0_15px_rgba(212,165,116,0.15)] ` +
        `backdrop-blur-xl ` +
        (review.isHighlighted
          ? 'border border-[#d4a574] shadow-[inset_0_0_10px_rgba(212,165,116,0.1)]'
          : 'border-t border-[var(--aura-primary, #c6c6c7)]/15 border-l border-[var(--aura-primary, #c6c6c7)]/15 border-r border-transparent border-b border-transparent')
      }
      aria-label={`Review by ${review.author}, ${review.rating} out of 5 stars`}
    >
      {/* Badge */}
      {review.badge && (
        <div className="flex justify-end">
          <span
            className="rounded-full bg-[#291500] px-2 py-1 text-[10px] font-bold uppercase tracking-tighter text-[#efbd8a]"
          >
            {review.badge}
          </span>
        </div>
      )}

      {/* Author + Rating */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#44474d]/30">
          <img
            className="h-full w-full object-cover"
            src={review.avatarUrl}
            alt={review.avatarAlt}
            loading="lazy"
          />
        </div>
        <div>
          <h3 className="font-display text-lg text-[var(--aura-text-primary, #e8e8e8)]">
            {review.author}
          </h3>
          <StarRating rating={review.rating} size="sm" />
        </div>
      </div>

      {/* Content */}
      <p className="font-body leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)]">
        &ldquo;{review.content}&rdquo;
      </p>

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <div
          className={`mt-2 grid gap-2 ${
            review.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {review.images.map((img, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-lg bg-white/[0.03]"
            >
              <img
                className="review-photo h-32 w-full object-cover md:h-40"
                src={img.url}
                alt={img.alt}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
        <span className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
          {review.date}
        </span>
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1 transition-colors ${
            liked
              ? 'text-[#ffb4ab]'
              : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[#ffb4ab]'
          }`}
          aria-label={liked ? 'Unlike this review' : 'Like this review'}
          aria-pressed={liked}
        >
          <HeartIcon filled={liked} className="h-[18px] w-[18px]" />
          <span className="font-body text-xs font-semibold uppercase tracking-widest">
            {likeCount}
          </span>
        </button>
      </div>
    </article>
  );
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
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const resolvedErrorMessage = errorMessage ?? t('stitch.unexpectedError');

  const FILTERS: { key: FilterOption; label: string }[] = [
    { key: 'all', label: t('stitch.filterAll') },
    { key: '5-star', label: t('stitch.filter5Star') },
    { key: 'photo', label: t('stitch.filterPhoto') },
    { key: 'latest', label: t('stitch.filterLatest') },
  ];

  const handleFilter = useCallback(
    (filter: FilterOption) => {
      setActiveFilter(filter);
      onFilterChange?.(filter);
    },
    [onFilterChange],
  );

  const filteredReviews = useCallback(() => {
    if (!data) return [];
    let items = data.reviews;

    if (activeFilter === '5-star') {
      items = items.filter((r) => r.rating === 5);
    } else if (activeFilter === 'photo') {
      items = items.filter((r) => r.images && r.images.length > 0);
    } else if (activeFilter === 'latest') {
      items = [...items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }

    return items;
  }, [data, activeFilter]);

  const visibleReviews = filteredReviews();

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ReviewsSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)] p-6">
        <ReviewsError message={resolvedErrorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.reviews.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)] p-6">
        <ReviewsEmpty />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] text-[var(--aura-text-primary, #e8e8e8)]">
      <main className="mx-auto max-w-[1200px] px-6 pb-16 pt-24">
        {/* ── Header Aggregate & CTA ──────────────────────────────── */}
        <section className="mb-16 flex flex-col items-end justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 font-display text-4xl leading-tight tracking-[-0.02em] md:text-5xl md:leading-tight text-[var(--aura-text-primary, #e8e8e8)]">
              {t('stitch.guestExperiences')}
            </h1>
            <div className="flex items-center gap-4">
              <span className="font-display text-2xl text-[var(--aura-primary, #c6c6c7)]">
                {data.aggregateRating}/5
              </span>
              <StarRating rating={data.aggregateRating} />
              <span className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
                {data.totalReviews.toLocaleString()} {t('stitch.reviews')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onWriteReview}
            className="chrome-gradient-btn flex items-center gap-2 rounded-full px-8 py-4 font-body text-xs font-bold uppercase tracking-widest text-[#0c1c30] transition-all duration-300 hover:brightness-110 active:scale-95"
            aria-label={t('stitch.writeAReview')}
          >
            <PenIcon className="h-[18px] w-[18px]" />
            {t('stitch.writeAReview')}
          </button>
        </section>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <section className="mb-6 overflow-x-auto pb-4" aria-label="Review filters">
          <div className="flex min-w-max gap-4">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleFilter(filter.key)}
                className={`rounded-full bg-[#0b2038]/60 px-6 py-2 font-body text-xs font-semibold uppercase tracking-[0.1em] backdrop-blur-xl transition-all duration-300 ${
                  activeFilter === filter.key
                    ? 'border border-[#d4a574]/30 text-[#efbd8a]'
                    : 'border border-transparent text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-text-primary, #e8e8e8)]'
                }`}
                aria-pressed={activeFilter === filter.key}
                aria-label={`Filter by ${filter.label}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Review Grid ─────────────────────────────────────────── */}
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          role="feed"
          aria-label={t('stitch.guestExperiences')}
        >
          {visibleReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>

        {/* ── Loading Indicator (infinite scroll mock) ────────────── */}
        <div className="mt-12 flex flex-col items-center gap-4 opacity-40" aria-hidden={!onLoadMore}>
          <span className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
            {onLoadMore ? t('stitch.loadingMoreExperiences') : t('stitch.scrollToLoadMore')}
          </span>
          <SpinnerIcon className="h-8 w-8 text-[var(--aura-text-primary, #e8e8e8)]" />
        </div>
      </main>

      {/* Custom styles for photo and chrome gradient */}
      <style>{`
        .review-photo {
          filter: grayscale(0.4) contrast(1.1);
          transition: filter 0.3s ease;
        }
        .review-photo:hover {
          filter: grayscale(0) contrast(1);
        }
        .chrome-gradient-btn {
          background: linear-gradient(135deg, var(--aura-primary, #c6c6c7) 0%, #e3e2e3 50%, #8e9097 100%);
        }
      `}</style>
    </div>
  );
}
