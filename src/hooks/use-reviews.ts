import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
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
  order_id?: string;
  rating: number;
  comment?: string;
  customer_name?: string;
}

interface SubmitReviewResponse {
  success: boolean;
  data: ReviewRecord;
}

export const reviewFormSchema = z.object({
  order_id: z.string().optional(),
  rating: z.number().int().min(1, 'Vui lòng chọn số sao').max(5),
  comment: z.string().max(500, 'Nhận xét tối đa 500 ký tự').optional(),
  customer_name: z.string().min(1, 'Tên không được để trống').max(100).optional(),
});

export function useReviewsStats() {
  const tenantId = useAuthStore((s) => s.user?.tenantId) || 'default';
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  return useQuery<StatsResponse['data']>({
    queryKey: sessionVersion > 0 ? ['reviews-stats', tenantId, sessionVersion] : ['reviews-stats', tenantId],
    queryFn: async () => {
      const res = await apiFetch<StatsResponse>('/api/reviews/stats');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useReviews(page = 1, limit = 20) {
  const tenantId = useAuthStore((s) => s.user?.tenantId) || 'default';
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  return useQuery<ReviewsResponse>({
    queryKey: sessionVersion > 0 ? ['reviews', page, limit, tenantId, sessionVersion] : ['reviews', page, limit, tenantId],
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
      const requestBody = {
        ...parsed.data,
        order_id: parsed.data.order_id || payload.order_id || 'general',
      };
      return apiFetch<SubmitReviewResponse>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['reviews-stats'] });
    },
  });
}
