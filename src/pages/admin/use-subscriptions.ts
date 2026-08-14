import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './subscription-api';
import type { SubscriptionRecord, SubscriptionStats } from './subscription-types';

export function useSubscriptions() {
  const queryClient = useQueryClient();
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const statsQuery = useQuery<{ success: boolean; data: SubscriptionStats }>({
    queryKey: ['admin-subscription-stats'],
    queryFn: () => apiFetch('/api/subscriptions/stats'),
  });

  const subsQuery = useQuery<{ success: boolean; data: SubscriptionRecord[] }>({
    queryKey: ['admin-subscriptions'],
    queryFn: () => apiFetch('/api/subscriptions?all=1'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/api/subscriptions/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-stats'] });
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
