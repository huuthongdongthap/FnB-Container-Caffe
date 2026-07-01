import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface Promotion {
  id: string;
  code: string;
  percent: number;
  maxDiscount: number;
  minOrder: number;
  expiresAt: string;
  usageCount: number;
  usageLimit: number;
  icon: string;
  isFeatured: boolean;
}

interface PromotionsResponse {
  success: boolean;
  promotions: Promotion[];
}

export function usePromotions() {
  return useQuery<Promotion[]>({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await apiFetch<PromotionsResponse>('/api/promotions');
      return res.promotions;
    },
  });
}

export function usePromotionByCode(code: string) {
  return useQuery<Promotion>({
    queryKey: ['promotion', code],
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; promotion: Promotion }>(`/api/promotions/${code}`);
      return res.promotion;
    },
    enabled: !!code,
  });
}
