/**
 * StitchReviewsNew — Shared type definitions
 *
 * Extracted from StitchReviewsNew.tsx for reuse across sub-components
 * and parent consumers (e.g. ReviewsPage).
 */

/* ─── Image Data ──────────────────────────────────────────────────── */

export interface ReviewImageData {
  url: string;
  alt: string;
}

/* ─── Single Review Entry ─────────────────────────────────────────── */

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

/* ─── Filter & Loading ────────────────────────────────────────────── */

export type FilterOption = 'all' | '5-star' | 'photo' | 'latest';

export type LoadingStatus = 'idle' | 'loading' | 'error';

/* ─── Page-Level Data ─────────────────────────────────────────────── */

export interface ReviewsPageData {
  aggregateRating: number;
  totalReviews: number;
  reviews: ReviewEntry[];
}

/* ─── Component Props ─────────────────────────────────────────────── */

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
