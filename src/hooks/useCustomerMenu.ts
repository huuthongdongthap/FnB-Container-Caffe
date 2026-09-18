import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory } from '@aura/domain-catalog';

export type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory };

export function useCustomerMenu(opts?: { includeUnavailable?: boolean; category?: string; locale?: string }) {
  return useQuery<CustomerMenu>({
    queryKey: ['customer-menu', opts],
    queryFn: () => apiClient.getCustomerMenu(opts),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useCustomerMenuItem(id: string) {
  return useQuery<CustomerMenuItem>({
    queryKey: ['customer-menu', 'item', id],
    queryFn: () => apiClient.getMenuItem(id),
    enabled: !!id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}