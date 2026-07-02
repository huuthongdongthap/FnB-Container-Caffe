/**
 * use-campaigns-admin — hook for Campaigns Manager admin page
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export type CampaignTrigger = 'welcome' | 'birthday' | 'winback' | 'post_visit' | 'cashback_expiry';
export type CampaignChannel = 'sms' | 'email' | 'zalo';

export interface TriggerMeta {
  label: string;
  label_vn: string;
  description: string;
  default_channels: CampaignChannel[];
  timing_hint: string;
}

export interface CampaignConfig {
  trigger: CampaignTrigger;
  is_active: number;
  channels: CampaignChannel[];
  timing: string | null;
  updated_at: string | null;
  meta: TriggerMeta | null;
}

export interface CampaignStats {
  total_sent: number;
  success_count: number;
  success_rate: number;
  last_run_at: string | null;
  unique_customers: number;
}

export interface CampaignConfigUpdate {
  is_active?: number;
  channels?: CampaignChannel[];
}

export interface CampaignAdminState {
  campaigns: CampaignConfig[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface CampaignStatsMap {
  [trigger: string]: CampaignStats;
}

// ── Query keys ───────────────────────────────────────────────────────

const CAMPAIGNS_KEY = ['admin-campaigns'] as const;
const CAMPAIGN_STATS_KEY = ['admin-campaign-stats'] as const;

// ── Hook ─────────────────────────────────────────────────────────────

export function useCampaignsAdmin() {
  const queryClient = useQueryClient();

  // Fetch all campaign configs
  const campaignsQuery = useQuery<{ success: boolean; data: CampaignConfig[] }>({
    queryKey: CAMPAIGNS_KEY,
    queryFn: () => apiFetch('/api/campaigns'),
    staleTime: 30_000,
  });

  // Fetch campaign stats
  const statsQuery = useQuery<{ success: boolean; data: CampaignStatsMap }>({
    queryKey: CAMPAIGN_STATS_KEY,
    queryFn: () => apiFetch('/api/campaigns/stats/all'),
    staleTime: 15_000,
  });

  // Create/update campaign
  const saveMutation = useMutation<{ success: boolean; data: CampaignConfig }, Error, {
    trigger: CampaignTrigger;
    updates: CampaignConfigUpdate;
  }>({
    mutationFn: ({ trigger, updates }) =>
      apiFetch(`/api/campaigns/${trigger}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
    },
  });

  // Delete campaign (reset to defaults)
  const deleteMutation = useMutation<{ success: boolean; data: null }, Error, CampaignTrigger>({
    mutationFn: (trigger) =>
      apiFetch(`/api/campaigns/${trigger}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
    },
  });

  const updateCampaign = useCallback(
    (trigger: CampaignTrigger, updates: CampaignConfigUpdate) =>
      saveMutation.mutateAsync({ trigger, updates }),
    [saveMutation],
  );

  const deleteCampaign = useCallback(
    (trigger: CampaignTrigger) => deleteMutation.mutateAsync(trigger),
    [deleteMutation],
  );

  return {
    // Queries
    campaigns: campaignsQuery.data?.data ?? [],
    isLoading: campaignsQuery.isLoading,
    error: campaignsQuery.error as Error | null,
    refetch: campaignsQuery.refetch,

    // Stats
    stats: statsQuery.data?.data ?? ({} as CampaignStatsMap),
    statsLoading: statsQuery.isLoading,

    // Mutations
    updateCampaign,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error as Error | null,

    deleteCampaign,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error as Error | null,
  };
}
