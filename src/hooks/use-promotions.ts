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
      const res = await apiFetch<any>('/api/promotions');
      const list = (Array.isArray(res?.data) ? res.data : res?.promotions) || [];
      return list.map((item: any) => ({
        id: item.id || item.code,
        code: item.code,
        percent: item.percent,
        maxDiscount: item.maxDiscount ?? item.max_discount ?? 0,
        minOrder: item.minOrder ?? item.min_order ?? 0,
        expiresAt: item.expiresAt ?? item.expires_at ?? '',
        usageCount: item.usageCount ?? item.usage_count ?? 0,
        usageLimit: item.usageLimit ?? item.usage_limit ?? 0,
        icon: item.icon || 'Sparkles',
        isFeatured: item.isFeatured ?? false,
      }));
    },
  });
}

export function usePromotionByCode(code: string) {
  return useQuery<Promotion>({
    queryKey: ['promotion', code],
    queryFn: async () => {
      const res = await apiFetch<any>(`/api/promotions/${code}`);
      const item = res?.data || res?.promotion;
      if (!item) return null as any;
      return {
        id: item.id || item.code,
        code: item.code,
        percent: item.percent,
        maxDiscount: item.maxDiscount ?? item.max_discount ?? 0,
        minOrder: item.minOrder ?? item.min_order ?? 0,
        expiresAt: item.expiresAt ?? item.expires_at ?? '',
        usageCount: item.usageCount ?? item.usage_count ?? 0,
        usageLimit: item.usageLimit ?? item.usage_limit ?? 0,
        icon: item.icon || 'Sparkles',
        isFeatured: item.isFeatured ?? false,
      };
    },
    enabled: !!code,
  });
}
