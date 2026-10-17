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

interface RawPromotion {
  id?: string;
  code: string;
  percent: number;
  maxDiscount?: number;
  max_discount?: number;
  minOrder?: number;
  min_order?: number;
  expiresAt?: string;
  expires_at?: string;
  usageCount?: number;
  usage_count?: number;
  usageLimit?: number;
  usage_limit?: number;
  icon?: string;
  isFeatured?: boolean;
}

interface PromotionsResponse {
  success?: boolean;
  data?: RawPromotion[];
  promotions?: RawPromotion[];
}

interface SinglePromotionResponse {
  success?: boolean;
  data?: RawPromotion;
  promotion?: RawPromotion;
}

function mapRawPromotion(item: RawPromotion): Promotion {
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
}

export function usePromotions() {
  return useQuery<Promotion[]>({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await apiFetch<PromotionsResponse>('/api/promotions');
      const list = (Array.isArray(res?.data) ? res.data : res?.promotions) || [];
      return list.map(mapRawPromotion);
    },
  });
}

export function usePromotionByCode(code: string) {
  return useQuery<Promotion | null>({
    queryKey: ['promotion', code],
    queryFn: async () => {
      const res = await apiFetch<SinglePromotionResponse>(`/api/promotions/${code}`);
      const item = res?.data || res?.promotion;
      if (!item) return null;
      return mapRawPromotion(item);
    },
    enabled: !!code,
  });
}
