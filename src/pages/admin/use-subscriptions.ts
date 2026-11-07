import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientSessionScope } from '@/lib/client-session';
import { apiFetch } from './subscription-api';
import type { SubscriptionRecord, SubscriptionStats } from './subscription-types';

export function useSubscriptions() {
  const queryClient = useQueryClient();
  const session = useClientSessionScope();
  const statsKey = ['admin-subscription-stats', session.tenantId, session.userScope] as const;
  const subsKey = ['admin-subscriptions', session.tenantId, session.userScope] as const;
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    setCancelSubId(null);
    setCancelReason('');
  }, [session.tenantId, session.userScope]);

  const statsQuery = useQuery<{ success: boolean; data: SubscriptionStats }>({
    queryKey: statsKey,
    queryFn: () => apiFetch('/api/subscriptions/stats'),
  });

  const subsQuery = useQuery<{ success: boolean; data: SubscriptionRecord[] }>({
    queryKey: subsKey,
    queryFn: () => apiFetch('/api/subscriptions?all=1'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/api/subscriptions/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subsKey });
      queryClient.invalidateQueries({ queryKey: statsKey });
      setCancelSubId(null);
      setCancelReason('');
    },
  });

  return {
    statsQuery,
    stats: statsQuery.data?.data,
    subsQuery,
    subscriptions: subsQuery.data?.data ?? [],
    cancelSubId,
    setCancelSubId,
    cancelReason,
    setCancelReason,
    cancelMutation,
  };
}
