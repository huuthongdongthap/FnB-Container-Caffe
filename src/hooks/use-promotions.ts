import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface Promotion {
  id: string;
  code: string;
  percent: number;
  maxDiscount: number;
  minOrder: number;
  expiresAt: string;
  startsAt?: string;
  isActive?: boolean;
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
  startsAt?: string;
  starts_at?: string;
  isActive?: boolean | number;
  is_active?: boolean | number;
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

export function isPromotionActive(item: RawPromotion, now = Date.now()): boolean {
  const activeFlag = item.isActive ?? item.is_active;
  if (activeFlag !== undefined && (activeFlag === 0 || activeFlag === false)) {
    return false;
  }
  if (String(item.code || '').toUpperCase() === 'WELCOME') {
    return true;
  }

  const startsAt = item.startsAt ?? item.starts_at;
  if (startsAt) {
    const startMs = Date.parse(startsAt);
    if (!Number.isNaN(startMs) && startMs > now) {
      return false;
    }
  }

  const expiresAt = item.expiresAt ?? item.expires_at;
  if (expiresAt) {
    const normalizedExpiry = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt)
      ? `${expiresAt}T23:59:59.999Z`
      : expiresAt;
    const expiryMs = Date.parse(normalizedExpiry);
    if (!Number.isNaN(expiryMs) && expiryMs < now) {
      return false;
    }
  }

  return true;
}

export function mapRawPromotion(item: RawPromotion): Promotion {
  const activeFlag = item.isActive ?? item.is_active;
  return {
    id: item.id || item.code,
    code: item.code,
    percent: item.percent,
    maxDiscount: item.maxDiscount ?? item.max_discount ?? 0,
    minOrder: item.minOrder ?? item.min_order ?? 0,
    expiresAt: item.expiresAt ?? item.expires_at ?? '',
    startsAt: item.startsAt ?? item.starts_at,
    isActive: activeFlag === undefined ? isPromotionActive(item) : Boolean(activeFlag) && isPromotionActive(item),
    usageCount: item.usageCount ?? item.usage_count ?? 0,
    usageLimit: item.usageLimit ?? item.usage_limit ?? 0,
    icon: item.icon || 'Sparkles',
    isFeatured: item.isFeatured ?? false,
  };
}

export function usePromotions(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;
  return useQuery<Promotion[]>({
    queryKey: activeOnly ? ['promotions'] : ['promotions', { activeOnly: false }],
    queryFn: async () => {
      const res = await apiFetch<PromotionsResponse>('/api/promotions');
      const list = (Array.isArray(res?.data) ? res.data : res?.promotions) || [];
      const filtered = activeOnly ? list.filter((item) => isPromotionActive(item)) : list;
      return filtered.map(mapRawPromotion);
    },
  });
}

export function usePromotionByCode(code: string) {
  return useQuery<Promotion | null>({
    queryKey: ['promotion', code],
    queryFn: async () => {
      const res = await apiFetch<SinglePromotionResponse>(`/api/promotions/${code}`);
      const item = res?.data || res?.promotion;
      if (!item || !isPromotionActive(item)) return null;
      return mapRawPromotion(item);
    },
    enabled: !!code,
  });
}
