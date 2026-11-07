import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { resolveMenuDrinkImage } from '@/lib/menu-drink-images';
import { normalizeMenuItem, type MenuItem, type RawMenuItem } from '@/lib/menu-item';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   useMenu — TanStack Query hook for menu items
   GET /api/menu with category/available/search/limit/offset params.
   ═══════════════════════════════════════════════════════════════════ */

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

interface RawMenuListResponse {
  success?: boolean;
  items?: MenuItem[];
  data?: {
    categories?: Array<{ items?: RawMenuItem[] }>;
  };
  pagination?: MenuResponse['pagination'];
}

interface RawMenuItemResponse {
  success?: boolean;
  item?: RawMenuItem;
  data?: RawMenuItem;
}

export function useMenu(params?: {
  category?: string;
  available?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  tenantId?: string;
}) {
  const storeTenantId = useAuthStore((s) => s.user?.tenantId);
  const tenantId = params?.tenantId || storeTenantId;
  const queryKey =
    tenantId && tenantId !== 'default'
      ? ['menu', params, tenantId]
      : ['menu', params];
  return useQuery<MenuResponse>({
    queryKey,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set('category', params.category);
      if (params?.available !== undefined) searchParams.set('available', params.available ? 'true' : 'false');
      if (params?.search) searchParams.set('search', params.search);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      if (tenantId && tenantId !== 'default' && tenantId !== '*') searchParams.set('tenant_id', tenantId);

      const qs = searchParams.toString();
      const res = await apiFetch<RawMenuListResponse>(`/api/menu${qs ? `?${qs}` : ''}`);
      let items: MenuItem[] = [];
      if (Array.isArray(res?.items)) {
        items = res.items.map((item) => ({
          ...item,
          image_url: resolveMenuDrinkImage(item.id, item.image_url),
        }));
      } else if (Array.isArray(res?.data?.categories)) {
        items = res.data.categories.flatMap((cat) => (cat.items || []).map(normalizeMenuItem));
      }
      return {
        success: res?.success ?? true,
        items,
        pagination: res?.pagination ?? { total: items.length, limit: items.length, offset: 0 },
      };
    },
  });
}

export function useMenuItem(id: string) {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const queryKey =
    tenantId && tenantId !== 'default'
      ? ['menu', id, tenantId]
      : ['menu', id];
  return useQuery<{ success: boolean; item?: MenuItem }>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch<RawMenuItemResponse>(`/api/menu/${id}`);
      const raw = res?.item ?? res?.data;
      if (!raw) return { success: false, item: undefined };
      return {
        success: res?.success ?? true,
        item: normalizeMenuItem(raw),
      };
    },
    enabled: !!id,
  });
}
