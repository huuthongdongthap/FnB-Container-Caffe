/**
 * StitchReviewsNew — AURA CAFE Guest Reviews (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy glassmorphism reviews section with aggregate rating header,
 * filter chips, review card grid (highlighted + standard), like toggle,
 * and infinite scroll loading indicator.
 * Source: Stitch AI reviews/design.html export (exact match).
 * Mobile-first responsive. Named export.
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Heart, Pencil, Loader2, AlertCircle, MessageSquareQuote } from 'lucide-react';

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
    avatarAlt: 'A sophisticated close-up portrait of an elegant woman with minimalist jewelry, dimly lit by warm amber cafe lights. The background is a blurred dark navy industrial interior. The overall mood is high-end, nocturnal, and refined, maintaining the Aura Cafe luxury aesthetic.',
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
        alt: 'A dark, cinematic shot of a perfectly crafted latte with intricate foam art, placed on a black marble table. Soft bronze highlights catch the rim of the glass. The background shows blurred industrial piping and dark navy walls of a high-end luxury cafe.',
      },
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDY0kZTzu_eDCzdeNtwOb5PDzk6AfBvfpyjeWYa5QzAiHJ-V7rJxv6OhovjTg1Ca882ie74XGdCsyf9DJuMbTBSChCk_g466fqeUEM8buyQg6-QN3uEko28b9oLrb9QJBycRc3Mph8WR4k4kdHoWKQ78slLnQqlORIUn0U9qs3H1Ei6Xi4C6iVwaMnkXjBdk_FpN18e_pQEV9uHpz12Eb1QdQPytGC2_P5hW4zauK1GcNBAptGSjej-2LKVGjjtKRlDeaJKOb77MdA',
        alt: 'Interior shot of Aura Cafe showing a minimalist glass partition reflecting low-key warm lighting. The architectural design features raw concrete textures and polished chrome accents. The atmosphere is nocturnal, moody, and extremely high-end industrial luxury.',
      },
    ],
  },
  {
    id: 'r2',
    author: 'Julian Thorne',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAZtfpoH6WXtP2CbmVXqWYVHvMv1WpAHWf3ikBODhROUfMIAcbI3qyrYLJv3OcWHqisRWfcFHuCpk5WFsQe70rdircMLzWc7RhOjzohSt9jsTqKoLReJYP5ENxiXCSSj-DBaCevpGYshcEb_QZnJrT26FLzSb5x28saeqJza6bITZwrOG8_YP2TWM44GNVTdC6dZ1lYrWIdriA54bV8b48wOswGqPsMTL_vJZJ5t_YUAh8FnRQ5ceQ4EGbJmf_Grap0nBsO0iVUVZU',
    avatarAlt: 'Portrait of a well-groomed man in a dark charcoal turtleneck, looking away thoughtfully. Soft, directional side-lighting in a dark setting. The aesthetic is modern industrial luxury, fitting for a guest of Aura Cafe.',
    rating: 4,
    content:
      'A masterclass in atmosphere. The lighting design alone is worth the reservation. Perfect for late-night meetings where privacy and aesthetics are paramount.',
    liked: false,
    likeCount: 18,
    date: 'Oct 12, 2023',
    images: [
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBkfvITRussIW0rvnfjcteP4oPrgMESCj_3jKFknxAbcunHPHF88S5dZD2S3ybXK5KxveDqm99bXCiJT6L2_ko1AipvopRS8Y6fgVcUkE1O7jSEhDw34b_I6kQ49pR_-7I0ryKgwWkBk1OvmaZFnLVbyX4hnEvWzb_88hZJijVKL_ygD8dIt7pvuto86_uyzrEn8ucykKvla9s5kc8ZGNEn-jG0IALJe3QIpuThXsyLHJ18oIRjKvC5avIA44wfXVRkNUzm42Yij2k',
        alt: 'Wide angle shot of a dark cafe interior featuring large floor-to-ceiling windows with a nocturnal city view. Interior is decorated with geometric bronze light fixtures and dark wood tables. The visual style is industrial luxury with a heavy focus on deep blues and metallic highlights.',
      },
    ],
  },
  {
    id: 'r3',
    author: 'Sienna Ray',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC3uNkiVtFXChMrZPskDLX_8x0PhSJEqRnuXrCpQa-sY1LGVZhx2s9L3s7bWuhlwoxucXLb_G5ZY0Vn__PlasXzU8cjRc2TO4bmk3Zy-aZjiOjk35xl3SDNHTJnoKsPekuoJRTEKz4tkZa1tMTJmJpoeuHJlIIGDb-WRR2FBHagn6eIo1yi7GMMDumYYXp7_OrzCqNRfS9h508qD48W1Idx-7yosjk-hyvR9yfcno_PUtVqlrDOWzxCMm5PC3UseljrIXW6Z2HUl9U',
    avatarAlt: 'Close up of a creative professional woman with sleek dark hair, lit by the glow of a tablet in a dark, atmospheric environment. High contrast lighting, industrial luxury style, deep navy and silver tones.',
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
    avatarAlt: 'Portrait of an older man with silver hair and a sharp navy blazer, sitting in a high-end cafe chair. The background is blurred with metallic accents and dark blue textures. Atmospheric industrial luxury lighting.',
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
    avatarAlt: 'Stylized portrait of a young man with glasses, looking at a menu. Reflection of a neon chrome sign on his glasses. Moody lighting, dark blue environment, industrial luxury aesthetic.',
    rating: 5,
    content:
      'Unreal aesthetics. Every corner is a photograph waiting to happen. The Dark Velvet latte is a must-try.',
    liked: false,
    likeCount: 89,
    date: 'Sep 28, 2023',
    images: [
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8u_4wEl-rwdM8Hd9TgLS0ObzY6HdeIWjzv_PSQGKLNOueo8BoU59WNmUTimKCNUBdsSq0VXiQ4wDRhn0AggL4fDq1bT4829jW4woP05iP6g7ycQnIq25y9JU-KYLTU8ujLEOMJyijEvvgvBLhtfwkYqdQ-BfFsBNlMIxO0bms-ilqVJ49Xl8W80pcK3FR0rwm7WspFFUOHGG2ELxNLJEf8GJpSYIJ3I91UF9idV71wiVLuusdwJGvxNSoY_2PO-O8Ff0SNhBv6UQ',
        alt: 'Macro shot of a dark chocolate dessert with gold leaf topping, served on a textured silver plate. The plate sits on a dark industrial mesh table. Lighting is dramatic and low-key with bronze reflections. High-end food photography.',
      },
    ],
  },
  {
    id: 'r6',
    author: 'Elena K.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA8N1q8_L2ppbrtWF0UX06qbfE8r_UqN3Ft929qG0S3rczb4bOFZUaEFDUW3Nev4IpPEvsZql0ILR9Z5pCcQEwkUYiTJ4IgFTn6BgL-gxWcReSIDMEbUfE8d4Uhu7OLSZEE1rOoS_zEJW6LnHMsFV4VtejIX6ZaQ4nNuDxZcYQeooKDENOWTLT20MTPslqJoRIokPU1XdsZlud_6TEdBXpNfDZ7oQpO0gr19NNuAp-WMe2t9d5MbPjy571ysrcd0lgqe_wl4W7XW0o',
    avatarAlt: 'Modern minimalist portrait of a woman with a sharp bob haircut, silhouetted against a softly lit glass wall. Industrial luxury vibes, monochromatic blue palette with chrome touches.',
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

/* ─── Half Star Component (for aggregate rating 4.9) ───────────────── */

function HalfStar({ className = 'h-5 w-5', color = '#c6c6c7' }: { className?: string; color?: string }) {
  return (
    <div className="relative" style={{ width: className.includes('w-') ? undefined : '1.25rem', height: className.includes('h-') ? undefined : '1.25rem' }}>
      <Star className={className} style={{ color }} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
        <Star className={className} fill={color} style={{ color }} />
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReviewsSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A1A2E' }}>
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

function ReviewsError({ message }: { message: string }) {
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
      <AlertCircle className="h-12 w-12" style={{ color: '#ffb4ab' }} />
      <h3 className="text-xl font-semibold" style={{ fontFamily: "'EB Garamond', Georgia, serif", color: '#b8c7e2' }}>
        {t('stitch.failedToLoadReviews', { defaultValue: 'Failed to load reviews' })}
      </h3>
      <p style={{ color: '#c5c6cd' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReviewsEmpty() {
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
      <h3 className="text-xl font-semibold" style={{ fontFamily: "'EB Garamond', Georgia, serif", color: '#b8c7e2' }}>
        {t('stitch.noReviewsYet', { defaultValue: 'No reviews yet' })}
      </h3>
      <p style={{ color: '#c5c6cd' }}>{t('stitch.beFirstToShare', { defaultValue: 'Be the first to share your experience' })}</p>
    </div>
  );
}

/* ─── Star Rating Display (for review cards) ───────────────────────── */

function ReviewStars({ rating, sm = false }: { rating: number; sm?: boolean }) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const starSize = sm ? 'h-[14px] w-[14px]' : 'h-5 w-5';

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Star
          key={i}
          className={starSize}
          fill="#c6c6c7"
          style={{ color: '#c6c6c7' }}
        />,
      );
    } else {
      stars.push(
        <Star
          key={i}
          className={starSize}
          style={{ color: '#44474d' }}
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

  const cardClasses = review.isHighlighted
    ? 'glass-card bronze-glow rounded-xl flex flex-col gap-4 relative overflow-hidden group'
    : 'glass-card rounded-xl flex flex-col gap-4';

  return (
    <article
      className={cardClasses}
      style={{ padding: '32px' }}
      aria-label={`Review by ${review.author}, ${review.rating} out of 5 stars`}
    >
      {/* Badge (highlighted card only) */}
      {review.badge && (
        <div className="absolute right-0 top-0 p-3">
          <span
            className="rounded-full px-2 py-1 text-[10px] uppercase tracking-tighter font-bold"
            style={{
              backgroundColor: '#291500',
              color: '#efbd8a',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
            }}
          >
            {review.badge}
          </span>
        </div>
      )}

      {/* Author + Avatar + Stars */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: 'rgba(68, 71, 77, 0.3)' }}>
          <img
            className="h-full w-full object-cover"
            src={review.avatarUrl}
            alt={review.avatarAlt}
            loading="lazy"
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold" style={{ fontFamily: "'EB Garamond', Georgia, serif", color: '#b8c7e2' }}>
            {review.author}
          </h3>
          <ReviewStars rating={review.rating} sm />
        </div>
      </div>

      {/* Quote Content */}
      <p className="leading-relaxed" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '16px', lineHeight: '1.6', fontWeight: 400, color: review.isHighlighted ? '#d3e4ff' : '#c5c6cd' }}>
        &ldquo;{review.content}&rdquo;
      </p>

      {/* Images Grid */}
      {review.images && review.images.length > 0 && (
        <div
          className={`grid gap-2 mt-2 ${review.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
        >
          {review.images.map((img, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-lg glass-card"
              style={review.images!.length === 1 ? { height: '160px' } : { height: '128px' }}
            >
              <img
                className="review-photo w-full h-full object-cover"
                src={img.url}
                alt={img.alt}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer: Date + Like */}
      <div className="mt-auto flex items-center justify-between pt-4 border-t" style={{ borderColor: 'rgba(68, 71, 77, 0.1)' }}>
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", lineHeight: '1.0', letterSpacing: '0.1em', color: '#c5c6cd' }}
        >
          {review.date}
        </span>
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1 transition-colors ${liked ? 'text-[#ffb4ab]' : 'text-[#c5c6cd] hover:text-[#ffb4ab]'}`}
          aria-label={liked ? 'Unlike this review' : 'Like this review'}
          aria-pressed={liked}
        >
          <Heart className="text-lg" fill={liked ? 'currentColor' : 'none'} />
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", lineHeight: '1.0', letterSpacing: '0.1em' }}
          >
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

  const resolvedErrorMessage = errorMessage ?? t('stitch.unexpectedError', { defaultValue: 'An unexpected error occurred' });

  const FILTERS: { key: FilterOption; label: string }[] = [
    { key: 'all', label: t('stitch.filterAll', { defaultValue: 'All' }) },
    { key: '5-star', label: t('stitch.filter5Star', { defaultValue: '5 Star' }) },
    { key: 'photo', label: t('stitch.filterPhoto', { defaultValue: 'Photo' }) },
    { key: 'latest', label: t('stitch.filterLatest', { defaultValue: 'Latest' }) },
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

  /* Compute aggregate display stars */
  const fullStars = Math.floor(data?.aggregateRating ?? 0);
  const hasHalf = (data?.aggregateRating ?? 0) - fullStars >= 0.5;

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ReviewsSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#0A1A2E' }}>
        <ReviewsError message={resolvedErrorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.reviews.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#0A1A2E' }}>
        <ReviewsEmpty />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden antialiased" style={{ backgroundColor: '#0A1A2E', color: '#d3e4ff' }}>
      {/* ── Top Navigation Shell (matches HTML EXACTLY) ───────────────── */}
      <header
        className="fixed top-0 z-50 h-16 w-full shadow-sm"
        style={{
          backgroundColor: 'rgba(11, 32, 56, 0.6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(68, 71, 77, 0.2)',
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between px-6">
          {/* Brand */}
          <span
            className="text-2xl font-bold"
            style={{ fontFamily: "'EB Garamond', Georgia, serif", lineHeight: '1.3', fontWeight: 500, color: '#b8c7e2' }}
          >
            Aura Cafe
          </span>

          {/* Desktop Nav */}
          <nav className="hidden gap-8 md:flex">
            <a
              className="transition-colors"
              href="/menu"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '16px', lineHeight: '1.6', fontWeight: 400, color: '#c5c6cd' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#b8c7e2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('stitch.navMenu', { defaultValue: 'Menu' })}
            </a>
            <a
              className="transition-colors"
              href="/table-reservation"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '16px', lineHeight: '1.6', fontWeight: 400, color: '#c5c6cd' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#b8c7e2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('stitch.navReservations', { defaultValue: 'Reservations' })}
            </a>
            <a
              href="/reviews"
              className="pb-1 font-bold"
              style={{
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: '16px',
                lineHeight: '1.6',
                fontWeight: 700,
                color: '#efbd8a',
                borderBottom: '2px solid #efbd8a',
              }}
            >
              {t('stitch.navReviews', { defaultValue: 'Reviews' })}
            </a>
            <a
              className="transition-colors"
              href="/about"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '16px', lineHeight: '1.6', fontWeight: 400, color: '#c5c6cd' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#b8c7e2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('stitch.navGallery', { defaultValue: 'Gallery' })}
            </a>
          </nav>

          {/* Book a Table (chrome gradient) */}
          <button
            type="button"
            className="chrome-gradient rounded-full px-6 py-2 text-[#0c1c30] uppercase transition-transform active:scale-95"
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: '12px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
            aria-label={t('stitch.bookATable', { defaultValue: 'Book a Table' })}
          >
            {t('stitch.bookATable', { defaultValue: 'Book a Table' })}
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1200px] px-6 pb-16" style={{ paddingTop: '96px' }}>
        {/* ── Header Aggregate & CTA (matches HTML EXACTLY) ─────────── */}
        <section className="flex flex-col items-end justify-between gap-4 mb-16 md:flex-row md:items-center">
          <div>
            <h1
              className="mb-2"
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: '48px',
                lineHeight: '1.1',
                letterSpacing: '-0.02em',
                fontWeight: 500,
                color: '#b8c7e2',
              }}
            >
              {t('stitch.guestExperiences', { defaultValue: 'Guest Experiences' })}
            </h1>
            <div className="flex items-center gap-4">
              <span
                style={{
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontSize: '24px',
                  lineHeight: '1.3',
                  fontWeight: 500,
                  color: '#c6c6c7',
                }}
              >
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
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontSize: '12px',
                  lineHeight: '1.0',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                  color: '#c5c6cd',
                }}
              >
                {data.totalReviews.toLocaleString()} {t('stitch.reviews', { defaultValue: 'Reviews' })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onWriteReview}
            className="chrome-gradient group flex items-center gap-2 rounded-full px-8 py-4 text-[#0c1c30] uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: '12px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
            aria-label={t('stitch.writeAReview', { defaultValue: 'Write a Review' })}
          >
            <Pencil className="h-[18px] w-[18px] transition-transform group-hover:rotate-12" />
            {t('stitch.writeAReview', { defaultValue: 'Write a Review' })}
          </button>
        </section>

        {/* ── Filters Section (matches HTML EXACTLY) ──────────────── */}
        <section className="mb-8 overflow-x-auto pb-4" aria-label="Review filters">
          <div className="flex min-w-max gap-4">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleFilter(filter.key)}
                className={`glass-card rounded-full px-6 py-2 uppercase tracking-widest transition-colors ${
                  activeFilter === filter.key
                    ? 'border border-[#efbd8a]/30 text-[#efbd8a]'
                    : 'text-[#c5c6cd] hover:text-[#b8c7e2]'
                }`}
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontSize: '12px',
                  lineHeight: '1.0',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                }}
                aria-pressed={activeFilter === filter.key}
                aria-label={`Filter by ${filter.label}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Review Grid (matches HTML EXACTLY) ──────────────────── */}
        <div
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
          role="feed"
          aria-label={t('stitch.guestExperiences', { defaultValue: 'Guest Experiences' })}
        >
          {visibleReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>

        {/* ── Scroll Indicator / Loading (matches HTML EXACTLY) ────── */}
        <div className="mt-8 flex flex-col items-center gap-4 opacity-40" aria-hidden={!onLoadMore}>
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              lineHeight: '1.0',
              letterSpacing: '0.1em',
            }}
          >
            {onLoadMore
              ? t('stitch.loadingMoreExperiences', { defaultValue: 'Loading more experiences' })
              : t('stitch.scrollToLoadMore', { defaultValue: 'Scroll to load more' })}
          </span>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8c7e2] border-t-transparent" />
        </div>
      </main>

      {/* ── Footer Shell (matches HTML EXACTLY) ──────────────────────── */}
      <footer className="mt-16 w-full border-t" style={{ borderColor: 'rgba(68, 71, 77, 0.1)', backgroundColor: '#000f22' }}>
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between px-6 py-8 md:flex-row">
          <span
            className="mb-4 text-2xl font-bold md:mb-0"
            style={{ fontFamily: "'EB Garamond', Georgia, serif", lineHeight: '1.3', fontWeight: 500, color: '#b8c7e2' }}
          >
            Aura Cafe
          </span>
          <div className="mb-4 flex flex-wrap justify-center gap-8 md:mb-0">
            <a
              className="transition-all hover:underline"
              href="#"
              style={{
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: '12px',
                lineHeight: '1.0',
                letterSpacing: '0.1em',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#c5c6cd',
                textDecorationColor: '#efbd8a',
                textUnderlineOffset: '4px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#d3e4ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('stitch.footerPrivacy', { defaultValue: 'Privacy Policy' })}
            </a>
            <a
              className="transition-all hover:underline"
              href="#"
              style={{
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: '12px',
                lineHeight: '1.0',
                letterSpacing: '0.1em',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#c5c6cd',
                textDecorationColor: '#efbd8a',
                textUnderlineOffset: '4px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#d3e4ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('stitch.footerTerms', { defaultValue: 'Terms of Service' })}
            </a>
            <a
              className="transition-all hover:underline"
              href="#"
              style={{
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: '12px',
                lineHeight: '1.0',
                letterSpacing: '0.1em',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#c5c6cd',
                textDecorationColor: '#efbd8a',
                textUnderlineOffset: '4px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#d3e4ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('stitch.footerContact', { defaultValue: 'Contact Us' })}
            </a>
            <a
              className="transition-all hover:underline"
              href="#"
              style={{
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: '12px',
                lineHeight: '1.0',
                letterSpacing: '0.1em',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#c5c6cd',
                textDecorationColor: '#efbd8a',
                textUnderlineOffset: '4px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#d3e4ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('stitch.footerPressKit', { defaultValue: 'Press Kit' })}
            </a>
          </div>
          <span
            className="uppercase tracking-widest opacity-60"
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: '12px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              fontWeight: 600,
              color: '#c5c6cd',
            }}
          >
            {t('stitch.footerCopyright', { defaultValue: '© 2024 Aura Cafe. Precision. Darkness. Luxury.' })}
          </span>
        </div>
      </footer>

      {/* ── Custom CSS Classes (EXACT match to HTML) ─────────────────── */}
      <style>{`
        /* Glass card */
        .glass-card {
          background: rgba(11, 32, 56, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(198, 198, 199, 0.15);
          border-left: 1px solid rgba(198, 198, 199, 0.15);
          border-right: 1px solid transparent;
          border-bottom: 1px solid transparent;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .glass-card:hover {
          transform: translateY(-4px);
          box-shadow: 0px 0px 15px rgba(212, 165, 116, 0.15);
        }

        /* Bronze glow for highlighted card */
        .bronze-glow {
          border: 1px solid #d4a574;
          box-shadow: inset 0 0 10px rgba(212, 165, 116, 0.1);
        }

        /* Chrome gradient for buttons */
        .chrome-gradient {
          background: linear-gradient(135deg, #c6c6c7 0%, #e3e2e3 50%, #8e9097 100%);
        }

        /* Photo hover effects */
        .review-photo {
          filter: grayscale(0.4) contrast(1.1);
          transition: filter 0.3s ease;
        }
        .review-photo:hover {
          filter: grayscale(0) contrast(1);
        }

        /* Custom scrollbar */
        .reviews-scrollbar::-webkit-scrollbar { width: 6px; }
        .reviews-scrollbar::-webkit-scrollbar-track { background: #000f22; }
        .reviews-scrollbar::-webkit-scrollbar-thumb { background: #44474d; border-radius: 10px; }
      `}</style>
    </div>
  );
}
