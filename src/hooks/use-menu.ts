import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   useMenu — TanStack Query hook for menu items
   GET /api/menu with category/available/search/limit/offset params.
   ═══════════════════════════════════════════════════════════════════ */

import type { MenuItem } from './stores/use-menu-store';

export type { MenuItem };

interface MenuResponse {
  success: boolean;
  items: MenuItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export function useMenu(params?: {
  category?: string;
  available?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<MenuResponse>({
    queryKey: ['menu', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set('category', params.category);
      if (params?.available !== undefined) searchParams.set('available', params.available ? 'true' : 'false');
      if (params?.search) searchParams.set('search', params.search);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));

      const qs = searchParams.toString();
      const res = await apiFetch<any>(`/api/menu${qs ? `?${qs}` : ''}`);
      let items: MenuItem[] = [];
      if (Array.isArray(res?.items)) {
        items = res.items;
      } else if (Array.isArray(res?.data?.categories)) {
        items = res.data.categories.flatMap((cat: any) => (cat.items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? '',
          price: item.priceCents ?? (typeof item.price === 'string' ? parseInt(item.price, 10) : item.price) ?? 0,
          category: item.category,
          image_url: item.imageUrl ?? item.image_url ?? '',
          available: Boolean(item.available),
          tags: Array.isArray(item.tags) ? item.tags : [],
        })));
      }
      return {
        success: res?.success ?? true,
        items,
        pagination: res?.pagination ?? { total: items.length, limit: items.length, offset: 0 },
      };
    },
  });
}

export function useFeaturedMenu() {
  return useMenu({ available: true, limit: 6 });
}

export function useMenuItem(id: string) {
  return useQuery<{ success: boolean; item: MenuItem }>({
    queryKey: ['menu', id],
    queryFn: async () => {
      const res = await apiFetch<any>(`/api/menu/${id}`);
      const raw = res?.item ?? res?.data;
      if (!raw) return { success: false, item: undefined as any };
      return {
        success: res?.success ?? true,
        item: {
          id: raw.id,
          name: raw.name,
          description: raw.description ?? '',
          price: raw.priceCents ?? (typeof raw.price === 'string' ? parseInt(raw.price, 10) : raw.price) ?? 0,
          category: raw.category,
          image_url: raw.imageUrl ?? raw.image_url ?? '',
          available: Boolean(raw.available),
          tags: Array.isArray(raw.tags) ? raw.tags : [],
        },
      };
    },
    enabled: !!id,
  });
}
