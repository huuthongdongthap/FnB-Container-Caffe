import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';
import { useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BirthdayConfig {
  discountPercent: number;
  freeItemEnabled: boolean;
  earlyWindowDays: number;
  lateWindowDays: number;
  autoSendEnabled: boolean;
}

export interface BirthdayConfigUpdate {
  discountPercent?: number;
  freeItemEnabled?: boolean;
  earlyWindowDays?: number;
  lateWindowDays?: number;
  autoSendEnabled?: boolean;
}

const CONFIG_QUERY_KEY = ['admin-birthday-config'] as const;

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useBirthdayAdmin() {
  const queryClient = useQueryClient();
  const session = useClientSessionScope();
  const configQueryKey = [...CONFIG_QUERY_KEY, session.tenantId, session.userScope] as const;

  const {
    data: config,
    isLoading,
    error,
    refetch,
  } = useQuery<BirthdayConfig>({
    queryKey: configQueryKey,
    queryFn: () => apiFetch<BirthdayConfig>('/api/admin/birthday/config'),
    staleTime: 30_000,
  });

  const updateMutation = useMutation<BirthdayConfig, Error, BirthdayConfigUpdate>({
    mutationFn: (updates) =>
      apiFetch<BirthdayConfig>('/api/admin/birthday/config', {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(configQueryKey, updated);
    },
  });

  const save = useCallback(
    (updates: BirthdayConfigUpdate) => updateMutation.mutateAsync(updates),
    [updateMutation],
  );

  return {
    config,
    isLoading,
    error: error as Error | null,
    refetch,
    save,
    isSaving: updateMutation.isPending,
    saveError: updateMutation.error as Error | null,
  };
}
