import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════
   useReviews — TanStack Query hook for customer reviews
   GET /api/reviews, GET /api/reviews/stats, POST /api/reviews
   ═══════════════════════════════════════════════════════════════════ */

export interface ReviewRecord {
  id: string;
  order_id: string;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
}

interface ReviewsResponse {
  success: boolean;
  data: ReviewRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface StatsResponse {
  success: boolean;
  data: {
    total_reviews: number;
    average_rating: number;
  };
}

interface SubmitReviewPayload {
  order_id: string;
  rating: number;
  comment?: string;
  customer_name?: string;
}

interface SubmitReviewResponse {
  success: boolean;
  data: ReviewRecord;
}

export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, 'Vui lòng chọn số sao').max(5),
  comment: z.string().max(500, 'Nhận xét tối đa 500 ký tự').optional(),
  customer_name: z.string().min(1, 'Tên không được để trống').max(100).optional(),
});

export function useReviewsStats() {
  return useQuery<StatsResponse['data']>({
    queryKey: ['reviews-stats'],
    queryFn: async () => {
      const res = await apiFetch<StatsResponse>('/api/reviews/stats');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useReviews(page = 1, limit = 20) {
  return useQuery<ReviewsResponse>({
    queryKey: ['reviews', page, limit],
    queryFn: async () => {
      return apiFetch<ReviewsResponse>(`/api/reviews?page=${page}&limit=${limit}`);
    },
    staleTime: 30_000,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation<SubmitReviewResponse, Error, SubmitReviewPayload>({
    mutationFn: async (payload) => {
      const parsed = reviewFormSchema.safeParse(payload);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ';
        throw new Error(firstError);
      }
      return apiFetch<SubmitReviewResponse>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['reviews-stats'] });
    },
  });
}
