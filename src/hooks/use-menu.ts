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
      return apiFetch<MenuResponse>(`/api/menu${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useFeaturedMenu() {
  return useMenu({ available: true, limit: 6 });
}

export function useMenuItem(id: number) {
  return useQuery<{ success: boolean; item: MenuItem }>({
    queryKey: ['menu', id],
    queryFn: () => apiFetch(`/api/menu/${id}`),
    enabled: !!id,
  });
}
