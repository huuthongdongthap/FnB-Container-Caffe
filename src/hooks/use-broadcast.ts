/**
 * use-broadcast — Broadcast messaging hook
 * Fetches segments and sends broadcast messages.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface Segment {
  id: string;
  name: string;
  count: number;
}

export interface BroadcastPayload {
  segment: string;
  channel: 'zns' | 'sms' | 'email' | 'all';
  title: string;
  message: string;
}

export interface BroadcastResult {
  success: boolean;
  sent_count?: number;
  failed_count?: number;
  total?: number;
  pending?: boolean;
  channels?: string[];
  skipped?: Record<string, string>;
}

/**
 * Fetch all customer segments with counts.
 */
export function useSegments() {
  return useQuery<Segment[]>({
    queryKey: ['broadcast-segments'],
    queryFn: () =>
      apiFetch<{ data: Segment[] }>('/api/customers/segments').then((r) => r.data),
    staleTime: 60_000,
  });
}

/**
 * Send a broadcast message to a segment.
 */
export function useSendBroadcast() {
  return useMutation<BroadcastResult, Error, BroadcastPayload>({
    mutationFn: (payload: BroadcastPayload) =>
      apiFetch<BroadcastResult>('/api/broadcast/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}
