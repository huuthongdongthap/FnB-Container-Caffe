import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface ReferralData {
  referral_code: string | null;
  total_referrals: number;
  total_cashback_earned_vnd: number;
  total_points_earned_legacy: number;
  code_usage: number;
  recent_referrals: Array<{
    id: string;
    referred_name: string;
    referred_phone: string;
    status: string;
    cashback_awarded_vnd: number;
    created_at: string;
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/** Flat 10,000đ cashback per successful referral (v3 model) */
export const REFERRAL_CASHBACK_VND = 10000;

/** Minimum first order amount for referral reward */
export const REFERRAL_MIN_ORDER = 20000;

export function useReferralStats() {
  return useQuery<ReferralData>({
    queryKey: ['referral-stats'],
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<ReferralData>>('/api/loyalty/referral/stats');
      return res.data;
    },
  });
}

export function useApplyReferralCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const res = await apiFetch<ApiResponse<{ referrer_cashback_pending: number; min_order_required: number; message: string }>>(
        '/api/loyalty/referral/apply',
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['referral-stats'] });
    },
  });
}
