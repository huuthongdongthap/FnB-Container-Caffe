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
} from '@/hooks/use-reviews';
import { StitchReviewsNew } from '@/components/stitch';
import type { ReviewsPageData, LoadingStatus } from '@/components/stitch/StitchReviewsNew';
import { WriteReviewForm } from './ReviewsPage-write-review-form';
import { ReviewsPagination } from './ReviewsPage-pagination';
import { reviewRecordToEntry } from './ReviewsPage-utils';

export type { ReviewsPageData, LoadingStatus } from '@/components/stitch/StitchReviewsNew';

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

      <StitchReviewsNew
        data={reviewsPageData}
        loadingState={loadingState}
        errorMessage={errorMessage}
        onWriteReview={() => setShowForm(true)}
        onToggleLike={() => {}}
        onLoadMore={() => handlePageChange(page + 1)}
      />

      <ReviewsPagination
        page={page}
        totalPages={pagination?.totalPages ?? 0}
        hasMore={hasMore}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
