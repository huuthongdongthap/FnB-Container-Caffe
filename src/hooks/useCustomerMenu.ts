import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';
import { resolveMenuDrinkImage } from '@/lib/menu-drink-images';
import type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory } from '@aura/domain-catalog';

export type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory };

export function useCustomerMenu(opts?: { includeUnavailable?: boolean; category?: string; locale?: string }) {
  const session = useClientSessionScope();
  return useQuery<CustomerMenu>({
    queryKey: ['customer-menu', session.tenantId, opts],
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
