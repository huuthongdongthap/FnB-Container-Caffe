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

interface RawMenuItemPayload {
  id: string;
  name: string;
  description?: string;
  priceCents?: number;
  price?: number | string;
  category: string;
  imageUrl?: string;
  image_url?: string;
  available?: boolean;
  tags?: string[];
}

interface RawMenuListResponse {
  success?: boolean;
  items?: MenuItem[];
  data?: {
    categories?: Array<{ items?: RawMenuItemPayload[] }>;
  };
  pagination?: MenuResponse['pagination'];
}

interface RawMenuItemResponse {
  success?: boolean;
  item?: RawMenuItemPayload;
  data?: RawMenuItemPayload;
}

function mapRawMenuItem(item: RawMenuItemPayload): MenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: item.priceCents ?? (typeof item.price === 'string' ? parseInt(item.price, 10) : item.price) ?? 0,
    category: item.category,
    image_url: item.imageUrl ?? item.image_url ?? '',
    available: Boolean(item.available),
    tags: Array.isArray(item.tags) ? item.tags : [],
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
      const res = await apiFetch<RawMenuListResponse>(`/api/menu${qs ? `?${qs}` : ''}`);
      let items: MenuItem[] = [];
      if (Array.isArray(res?.items)) {
        items = res.items;
      } else if (Array.isArray(res?.data?.categories)) {
        items = res.data.categories.flatMap((cat) => (cat.items || []).map(mapRawMenuItem));
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
  return useQuery<{ success: boolean; item?: MenuItem }>({
    queryKey: ['menu', id],
    queryFn: async () => {
      const res = await apiFetch<RawMenuItemResponse>(`/api/menu/${id}`);
      const raw = res?.item ?? res?.data;
      if (!raw) return { success: false, item: undefined };
      return {
        success: res?.success ?? true,
        item: mapRawMenuItem(raw),
      };
    },
    enabled: !!id,
  });
}
