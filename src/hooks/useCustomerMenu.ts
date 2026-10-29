import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { resolveMenuDrinkImage } from '@/lib/menu-drink-images';
import type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory } from '@aura/domain-catalog';

export type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory };

export function useCustomerMenu(opts?: { includeUnavailable?: boolean; category?: string; locale?: string }) {
  return useQuery<CustomerMenu>({
    queryKey: ['customer-menu', opts],
    queryFn: () => apiClient.getCustomerMenu(opts),
    select: (menu) => ({
      ...menu,
      categories: menu.categories.map((category) => ({
        ...category,
        items: category.items.map((item) => ({
          ...item,
          imageUrl: resolveMenuDrinkImage(item.id, item.imageUrl),
        })),
      })),
    }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useCustomerMenuItem(id: string) {
  return useQuery<CustomerMenuItem>({
    queryKey: ['customer-menu', 'item', id],
    queryFn: () => apiClient.getMenuItem(id),
    select: (item) => ({ ...item, imageUrl: resolveMenuDrinkImage(item.id, item.imageUrl) }),
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
