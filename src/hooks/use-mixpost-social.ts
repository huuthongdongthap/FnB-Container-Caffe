/**
 * use-mixpost-social — Hooks for Mixpost Facebook Page promotion publishing.
 *
 * Publishes or schedules posts to connected Facebook Pages via Mixpost.
 * Surfaces 503 / configuration errors directly without masking or retrying.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';

export interface MixpostAccount {
  id: number;
  name: string;
  provider?: string;
  username?: string;
  authorized?: boolean;
}

export interface MixpostPublishPayload {
  content: string;
  accounts: number[];
  scheduled_at?: string;
  media_urls?: string[];
}

export interface MixpostPublishResult {
  success: boolean;
  postId?: string | number;
}

export interface MixpostGenerateResult {
  success: boolean;
  data: {
    content: string;
    hashtags: string[];
  };
}

export function isFacebookPageAccount(account: MixpostAccount): boolean {
  const provider = String(account.provider || '').toLowerCase();
  return provider.includes('facebook');
}

export function isMixpostNotConfiguredError(error: unknown): boolean {
  if (error instanceof ApiClientError && error.status === 503) {
    return true;
  }
  const msg = error instanceof Error ? error.message : String(error || '');
  return /mixpost not configured/i.test(msg);
}

export function useMixpostAccounts(enabled = true) {
  const session = useClientSessionScope();
  return useQuery<MixpostAccount[]>({
    queryKey: ['mixpost-accounts', session.tenantId, session.userScope],
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data?: MixpostAccount[] }>(
        '/api/mixpost/accounts',
        { silent: true },
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

export function useGeneratePromoPost() {
  return useMutation<MixpostGenerateResult, Error, string>({
    mutationFn: (promotionCode: string) =>
      apiFetch<MixpostGenerateResult>('/api/mixpost/generate', {
        method: 'POST',
        body: JSON.stringify({ source: 'promotion', id: promotionCode }),
      }),
  });
}

export function usePublishMixpostPost() {
  return useMutation<MixpostPublishResult, Error, MixpostPublishPayload>({
    mutationFn: async (payload: MixpostPublishPayload) => {
      const res = await apiFetch<MixpostPublishResult>('/api/mixpost/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res?.success || res.postId === undefined || res.postId === null || String(res.postId).trim() === '') {
        throw new Error('Mixpost did not return a post ID');
      }
      return res;
    },
  });
}
