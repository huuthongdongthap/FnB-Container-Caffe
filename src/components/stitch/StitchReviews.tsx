/**
 * StitchReviews — AURA CAFE Guest Reviews (Stitch design)
 *
 * Dark navy glassmorphism reviews page with aggregate rating header,
 * filter chips, review card grid (highlighted + standard), like toggle,
 * and infinite scroll loading indicator.
 * Source: Stitch AI reviews/design.html export.
 * Mobile-first responsive.
 */
'use client';

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Star,
  Heart,
  PenLine,
  Loader2,
  AlertCircle,
  MessageSquareQuote,
  ChevronDown,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface ReviewImage {
  url: string;
  alt: string;
}

export interface ReviewItem {
  id: string;
  author: string;
  avatarUrl: string;
  avatarAlt: string;
  rating: number;
  content: string;
  liked: boolean;
  likeCount: number;
  date: string;
  images?: ReviewImage[];
  isHighlighted?: boolean;
  badge?: string;
}

export type FilterKey = 'all' | '5-star' | 'photo' | 'latest';

export interface ReviewsPageData {
  aggregateRating: number;
  totalReviews: number;
  reviews: ReviewItem[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchReviewsProps {
  data?: ReviewsPageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onWriteReview?: () => void;
  onFilterChange?: (filter: FilterKey) => void;
  onToggleLike?: (reviewId: string, liked: boolean) => void;
  onLoadMore?: () => void;
}

/* ─── Default Mock Data ────────────────────────────────────────────── */

const DEFAULT_REVIEWS: ReviewItem[] = [
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

/* ─── Filter config ────────────────────────────────────────────────── */

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '5-star', label: '5 Star' },
  { key: 'photo', label: 'Photo' },
  { key: 'latest', label: 'Latest' },
];

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReviewsSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      <div className="mx-auto max-w-[1200px] px-[var(--aura-container-padding,24px)] pt-24">
        {/* Header skeleton */}
        <div className="mb-12 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="flex items-center gap-4">
            <div className="h-8 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 w-6 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
              ))}
            </div>
            <div className="h-4 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          </div>
        </div>

        {/* Filter skeleton */}
        <div className="mb-6 flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-24 animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-xl"
              style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function ReviewsError({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--aura-error, #ffb4ab)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        Failed to Load Reviews
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReviewsEmpty() {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <MessageSquareQuote className="h-12 w-12" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        No Reviews Yet
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        Be the first to share your Aura Cafe experience.
      </p>
    </div>
  );
}

/* ─── Star Rating ──────────────────────────────────────────────────── */

function StarRating({ rating, size = 'default' }: { rating: number; size?: 'default' | 'sm' }) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  for (let i = 0; i < 5; i++) {
    const isFull = i < fullStars;
    const isHalf = i === fullStars && hasHalf;

    if (isFull) {
      stars.push(
        <Star
          key={i}
          className={clsx(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')}
          style={{ fill: 'var(--aura-text-secondary, #c6c6c7)', color: 'var(--aura-text-secondary, #c6c6c7)' }}
        />,
      );
    } else if (isHalf) {
      stars.push(
        <div key={i} className="relative">
          <Star
            className={clsx(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')}
            style={{ fill: 'none', color: 'var(--aura-text-secondary, #c6c6c7)' }}
          />
          <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
            <Star
              className={clsx(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')}
              style={{ fill: 'var(--aura-text-secondary, #c6c6c7)', color: 'var(--aura-text-secondary, #c6c6c7)' }}
            />
          </div>
        </div>,
      );
    } else {
      stars.push(
        <Star
          key={i}
          className={clsx(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')}
          style={{ color: 'var(--aura-outline-variant, #44474d)' }}
        />,
      );
    }
  }

  return <div className="flex gap-0.5">{stars}</div>;
}

/* ─── Sub-Components ───────────────────────────────────────────────── */

function ReviewCard({
  review,
  onToggleLike,
}: {
  review: ReviewItem;
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
      className={clsx(
        'review-card flex flex-col gap-4 overflow-hidden rounded-xl p-6 transition-all duration-300',
        review.isHighlighted && 'bronze-glow-review',
      )}
    >
      {/* Badge */}
      {review.badge && (
        <div className="flex justify-end">
          <span
            className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-tighter"
            style={{
              backgroundColor: 'var(--aura-tertiary-container, #291500)',
              color: 'var(--aura-tertiary, #efbd8a)',
            }}
          >
            {review.badge}
          </span>
        </div>
      )}

      {/* Author + Rating */}
      <div className="flex items-center gap-4">
        <div
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full"
          style={{ border: '1px solid var(--aura-outline-variant, #44474d)' }}
        >
          <img
            className="h-full w-full object-cover"
            src={review.avatarUrl}
            alt={review.avatarAlt}
            loading="lazy"
          />
        </div>
        <div>
          <h3
            className="text-lg font-headline-md"
            style={{
              color: 'var(--aura-text-primary, #e8e8e8)',
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
            }}
          >
            {review.author}
          </h3>
          <StarRating rating={review.rating} size="sm" />
        </div>
      </div>

      {/* Content */}
      <p
        className="leading-relaxed"
        style={{
          color: 'var(--aura-text-primary, #e8e8e8)',
          fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
        }}
      >
        &ldquo;{review.content}&rdquo;
      </p>

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <div
          className={clsx(
            'mt-2 grid gap-2',
            review.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {review.images.map((img, idx) => (
            <div
              key={idx}
              className="review-photo-wrapper overflow-hidden rounded-lg"
              style={{ backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))' }}
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
      <div
        className="mt-auto flex items-center justify-between pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          className="font-label-caps text-xs uppercase"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          {review.date}
        </span>
        <button
          type="button"
          onClick={handleLike}
          className={clsx(
            'flex items-center gap-1 transition-colors',
            liked
              ? 'text-[var(--aura-error, #ffb4ab)]'
              : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-error, #ffb4ab)]',
          )}
        >
          <Heart className={clsx('h-[18px] w-[18px]', liked && 'fill-current')} />
          <span className="font-label-caps text-xs">{likeCount}</span>
        </button>
      </div>
    </article>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export default function StitchReviews({
  data = DEFAULT_REVIEWS_DATA,
  loadingState = 'idle',
  errorMessage = 'An unexpected error occurred. Please try again.',
  onWriteReview,
  onFilterChange,
  onToggleLike,
  onLoadMore,
}: Readonly<StitchReviewsProps>) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const handleFilter = useCallback(
    (filter: FilterKey) => {
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
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #00142a)' }}
      >
        <ReviewsError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.reviews.length === 0) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #00142a)' }}
      >
        <ReviewsEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #00142a)',
        color: 'var(--aura-text-primary, #e8e8e8)',
      }}
    >
      <main className="mx-auto max-w-[1200px] px-[var(--aura-container-padding,24px)] pb-16 pt-24">
        {/* ── Header Aggregate & CTA ──────────────────────────────── */}
        <section className="mb-16 flex flex-col items-end justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1
              className="mb-2"
              style={{
                fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
                fontSize: 'var(--aura-text-display-lg, 48px)',
                lineHeight: '1.1',
                letterSpacing: '-0.02em',
                color: 'var(--aura-text-primary, #e8e8e8)',
              }}
            >
              Guest Experiences
            </h1>
            <div className="flex items-center gap-4">
              <span
                className="font-headline-md text-2xl"
                style={{
                  color: 'var(--aura-text-secondary, #c6c6c7)',
                  fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
                }}
              >
                {data.aggregateRating}/5
              </span>
              <StarRating rating={data.aggregateRating} />
              <span
                className="font-label-caps text-xs uppercase tracking-widest"
                style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
              >
                {data.totalReviews.toLocaleString()} Reviews
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onWriteReview}
            className="chrome-gradient-review flex items-center gap-2 rounded-full px-8 py-4 font-label-caps text-xs font-bold uppercase tracking-widest text-[var(--aura-on-primary-fixed, #0c1c30)] transition-all hover:brightness-110 active:scale-95"
          >
            <PenLine className="h-[18px] w-[18px] transition-transform group-hover:rotate-12" />
            Write a Review
          </button>
        </section>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <section className="mb-6 overflow-x-auto pb-4">
          <div className="flex min-w-max gap-4">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleFilter(filter.key)}
                className={clsx(
                  'review-filter-chip rounded-full px-6 py-2 font-label-caps text-xs uppercase tracking-widest transition-colors',
                  activeFilter === filter.key &&
                    'border text-[var(--aura-tertiary, #efbd8a)]',
                )}
                style={{
                  backgroundColor:
                    activeFilter === filter.key
                      ? 'var(--aura-bg-glass, rgba(11, 32, 56, 0.6))'
                      : 'var(--aura-bg-glass, rgba(11, 32, 56, 0.6))',
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
                    e.currentTarget.style.color = 'var(--aura-text-primary, #e8e8e8)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeFilter !== filter.key) {
                    e.currentTarget.style.color = 'var(--aura-text-secondary, #a0a8b0)';
                  }
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Review Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>

        {/* ── Loading Indicator (infinite scroll mock) ────────────── */}
        <div className="mt-12 flex flex-col items-center gap-4 opacity-40">
          <span
            className="font-label-caps text-xs uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {onLoadMore ? 'Loading more experiences' : 'Scroll to load more'}
          </span>
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'var(--aura-text-primary, #e8e8e8)', borderTopColor: 'transparent' }}
          />
        </div>
      </main>

      {/* Custom styles */}
      <style>{`
        .review-card {
          background: rgba(11, 32, 56, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(198, 198, 199, 0.15);
          border-left: 1px solid rgba(198, 198, 199, 0.15);
        }
        .review-card:hover {
          box-shadow: 0px 0px 15px rgba(212, 165, 116, 0.15);
        }
        .bronze-glow-review {
          border: 1px solid #d4a574;
          box-shadow: inset 0 0 10px rgba(212, 165, 116, 0.1);
        }
        .chrome-gradient-review {
          background: linear-gradient(135deg, #c6c6c7 0%, #e3e2e3 50%, #8e9097 100%);
        }
        .review-photo {
          filter: grayscale(0.4) contrast(1.1);
          transition: filter 0.3s ease;
        }
        .review-photo-wrapper:hover .review-photo {
          filter: grayscale(0) contrast(1);
        }
        .review-filter-chip {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
    </div>
  );
}
