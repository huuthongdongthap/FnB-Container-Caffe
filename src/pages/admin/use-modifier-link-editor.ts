import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientSessionScope } from '@/lib/client-session';
import { apiFetch } from './menu-api';
import type { ProductModifierLink } from './types';

/**
 * Product ↔ modifier-group linking for the menu admin page.
 *
 * Kept separate from `useModifierManager` because the surface is anchored on a
 * product (which group does this drink need?) rather than on a group (which
 * drinks use this group?). The queries follow the same anchor.
 */

/** Groups linked to one product, per the link endpoint's response shape. */
export function useProductGroups(productId: string | null) {
  const session = useClientSessionScope();
  return useQuery<{ success: boolean; data: ProductModifierLink[] }>({
    queryKey: ['admin-product-groups', session.tenantId, session.userScope, productId],
    queryFn: () => apiFetch(`/api/menu-modifiers/products/${productId}/groups`),
    enabled: productId !== null,
  });
}

export function useModifierLinkEditor() {
  const queryClient = useQueryClient();
  const session = useClientSessionScope();
  const [productId, setProductId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setProductId('');
    setErrors({});
  }, [session.tenantId, session.userScope]);

  const productGroupsQuery = useProductGroups(productId || null);
  const linkedGroupIds = new Set((productGroupsQuery.data?.data ?? []).map((l) => l.group_id));

  function invalidateLinks() {
    queryClient.invalidateQueries({
      queryKey: ['admin-product-groups', session.tenantId, session.userScope],
    });
  }

  const linkMutation = useMutation({
    mutationFn: (vars: { productId: string; groupId: string }) =>
      apiFetch(`/api/menu-modifiers/products/${vars.productId}/groups`, {
        method: 'POST',
        body: JSON.stringify({ group_id: vars.groupId }),
      }),
    onSuccess: () => invalidateLinks(),
    onError: (err: Error) => setErrors({ _form: err.message }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (vars: { productId: string; groupId: string }) =>
      apiFetch(`/api/menu-modifiers/products/${vars.productId}/groups/${vars.groupId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidateLinks(),
    onError: (err: Error) => setErrors({ _form: err.message }),
  });

  function toggleLink(groupId: string) {
    if (!productId) {
      setErrors({ _form: 'adminMenu.productLinksNeedProduct' });
      return;
    }
    setErrors({});
    // Optimistic on the linked set rather than refetching: the toggle is
    // idempotent, and a failed call surfaces via the mutation's error state.
    if (linkedGroupIds.has(groupId)) {
      unlinkMutation.mutate({ productId, groupId });
    } else {
      linkMutation.mutate({ productId, groupId });
    }
  }

  return {
    productId,
    setProductId,
    errors,
    productGroupsQuery,
    linkedGroupIds,
    toggleLink,
    linkMutation,
    unlinkMutation,
  };
}
