import { useState } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useReviews, useReviewsStats } from '@/hooks/use-reviews';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { RatingStars } from '@/components/reviews/RatingStars';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function ReviewSkeletons({ count = 6 }: { count?: number }) {
 return (
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {Array.from({ length: count }).map((_, i) => (
 <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-4">
 <div className="flex items-start gap-3">
 <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
 <div className="flex-1 space-y-2">
 <Skeleton className="h-4 w-32" />
 <Skeleton className="h-3 w-20" />
 <Skeleton className="mt-2 h-3 w-full" />
 <Skeleton className="h-3 w-3/4" />
 </div>
 </div>
 </div>
 ))}
 </div>
 );
}

export function ReviewsPage() {
 const [page, setPage] = useState(1);
 const [limit] = useState(12);

 const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useReviewsStats();
 const { data: reviewsData, isLoading: reviewsLoading, isError: reviewsError, refetch: refetchReviews } = useReviews(page, limit);

 const reviews = reviewsData?.data ?? [];
 const pagination = reviewsData?.pagination;
 const hasMore = pagination ? page < pagination.totalPages : false;

 return (
 <>
 <HelmetHead
 title="Đánh giá khách hàng"
 description="Xem đánh giá và nhận xét từ khách hàng của AURA CAFE — Container Caffe Sa Đéc"
 canonical="/reviews"
 />
 <div className="min-h-screen bg-gradient-to-b from-[#050D1A] via-[#0A1A2E] to-[#0F172A]">
 <div className="mx-auto max-w-6xl px-4 py-12">
 {/* Header */}
 <div className="mb-10 text-center">
 <h1 className="font-[EB_Garamond,serif] text-3xl font-bold text-chrome-bright sm:text-4xl">
 Khách hàng nói gì về chúng tôi
 </h1>
 <p className="mt-2 text-sm text-chrome-light/60">
 Đánh giá và cảm nhận từ thực khách đã trải nghiệm tại AURA CAFE
 </p>
 </div>

 {/* Stats summary */}
 {statsLoading && (
 <div className="mb-10 flex items-center justify-center gap-6">
 <Skeleton className="h-16 w-32" />
 <Skeleton className="h-16 w-32" />
 </div>
 )}

 {statsError && (
 <div className="mb-10 text-center">
 <p className="text-sm text-chrome-light/50">Không thể tải thống kê</p>
 <Button variant="ghost" size="sm" onClick={() => refetchStats()} className="mt-2">
 Thử lại
 </Button>
 </div>
 )}

 {!statsLoading && !statsError && stats && (
 <div className="mb-10">
 <div className="mx-auto flex max-w-md items-center justify-center gap-8 rounded-2xl border border-white/5 bg-white/5 px-8 py-6">
 <div className="text-center">
 <p className="font-[EB_Garamond,serif] text-4xl font-bold text-chrome-bright">
 {stats.average_rating.toFixed(1)}
 </p>
 <div className="mt-1 flex justify-center">
 <RatingStars rating={Math.round(stats.average_rating)} size="sm" />
 </div>
 <p className="mt-1 text-xs text-chrome-light/40">
 {stats.average_rating.toFixed(1)} / 5.0
 </p>
 </div>
 <div className="h-12 w-px bg-white/10" />
 <div className="text-center">
 <p className="font-[EB_Garamond,serif] text-4xl font-bold text-chrome-bright">
 {stats.total_reviews}
 </p>
 <p className="mt-1 text-xs text-chrome-light/40">
 {stats.total_reviews === 1 ? 'đánh giá' : 'đánh giá'}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Reviews grid */}
 {reviewsLoading && <ReviewSkeletons count={Math.min(limit, 6)} />}

 {reviewsError && (
 <div className="text-center py-16">
 <p className="text-chrome-light/50">Không thể tải danh sách đánh giá</p>
 <Button variant="ghost" size="sm" onClick={() => refetchReviews()} className="mt-3">
 Thử lại
 </Button>
 </div>
 )}

 {!reviewsLoading && !reviewsError && reviews.length === 0 && (
 <div className="py-16 text-center">
 <span className="text-5xl" role="img" aria-label="coffee">&#9749;</span>
 <p className="mt-4 font-[EB_Garamond,serif] text-xl font-semibold text-chrome-bright">
 Chưa có đánh giá nào
 </p>
 <p className="mt-1 text-sm text-chrome-light/50">
 Hãy là người đầu tiên đánh giá trải nghiệm tại AURA CAFE!
 </p>
 </div>
 )}

 {!reviewsLoading && !reviewsError && reviews.length > 0 && (
 <>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {reviews.map((review) => (
 <ReviewCard key={review.id} review={review} />
 ))}
 </div>

 {/* Pagination */}
 {pagination && pagination.totalPages > 1 && (
 <div className="mt-8 flex items-center justify-center gap-4">
 <Button
 variant="ghost"
 size="sm"
 disabled={page <= 1}
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 >
 &larr; Trang trước
 </Button>
 <span className="text-sm text-chrome-light/50">
 Trang {page} / {pagination.totalPages}
 </span>
 <Button
 variant="ghost"
 size="sm"
 disabled={!hasMore}
 onClick={() => setPage((p) => p + 1)}
 >
 Trang sau &rarr;
 </Button>
 </div>
 )}
 </>
 )}
 </div>
 </div>
 </>
 );
}
