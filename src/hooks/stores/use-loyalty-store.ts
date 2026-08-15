import { create } from 'zustand';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { loadInitialLoyalty, persistLoyalty, parsePointsHistory, parseRewards, parseLoyaltySummary } from './loyalty-store-helpers';

import type { Reward, PointsHistoryEntry } from './loyalty-store-types';
export type { Reward, PointsHistoryEntry } from './loyalty-store-types';

/* ═══════════════════════════════════════════════════════════════════
   Loyalty store — Zustand with manual localStorage persistence.
   Uses apiFetch from api-client.ts for httpOnly cookie auth + error handling.
   Cashback rate is derived from the API tier_config, not hardcoded.
   ═══════════════════════════════════════════════════════════════════ */

interface LoyaltyState {
  tier: string;
  points: number;
  cashbackRate: number;
  rewards: Reward[];
  history: PointsHistoryEntry[];
  loading: boolean;
  error: string | null;

  fetchLoyalty: () => Promise<void>;
  redeemReward: (rewardId: string) => Promise<void>;
  calculateCashback: (amount: number) => number;
  phoneAuth: (phone: string) => Promise<void>;
  clearError: () => void;
}

const initial = loadInitialLoyalty();

export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
  tier: initial?.tier ?? 'bronze',
  points: initial?.points ?? 0,
  cashbackRate: initial?.cashbackRate ?? 3,
  rewards: [],
  history: [],
  loading: false,
  error: null,

  fetchLoyalty: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ success: boolean; data: Record<string, unknown> }>('/api/loyalty/summary');
      const data = body.data || body;

      let history: PointsHistoryEntry[] = [];
      try {
        const pointsBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/points');
        const pointsData = pointsBody.data || pointsBody;
        const rawEntries = Array.isArray(pointsData) ? pointsData : [];
        history = parsePointsHistory(rawEntries);
      } catch { /* points history is optional */ }

      let rewards: Reward[] = [];
      try {
        const rewardsBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/rewards');
        const rewardsData = rewardsBody.data || rewardsBody;
        const rawRewards = Array.isArray(rewardsData) ? rewardsData : [];
        rewards = parseRewards(rawRewards);
      } catch { /* rewards are optional */ }

      const { tier: tierVal, points: pointsVal, cashbackRate: cashbackRateVal } = parseLoyaltySummary(data);
      persistLoyalty(tierVal, pointsVal, cashbackRateVal);
      set({
        tier: tierVal,
        points: pointsVal,
        cashbackRate: cashbackRateVal,
        rewards,
        history,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          set({ loading: false, error: 'Session expired. Vui lòng đăng nhập lại.' });
          return;
        }
        set({ loading: false, error: err.message || 'Failed to load loyalty data' });
      } else {
        set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
      }
    }
  },

  redeemReward: async (rewardId: string) => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ success: boolean; data: Record<string, unknown> }>('/api/loyalty/redeem', {
        method: 'POST',
        body: JSON.stringify({ reward_id: rewardId }),
      });
      const data = body.data || body;
      const pointsRemaining = Number(data.points_remaining ?? data.points ?? get().points);

      set({ points: pointsRemaining, loading: false, error: null });
    } catch (err) {
      if (err instanceof ApiClientError) {
        set({ loading: false, error: err.message || 'Redeem failed' });
      } else {
        set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
      }
    }
  },

  calculateCashback: (amount: number): number => {
    const { cashbackRate } = get();
    if (amount <= 0) return 0;
    return Math.round(amount * (cashbackRate / 100));
  },

  phoneAuth: async (phone: string) => {
    set({ loading: true, error: null });
    try {
      await apiFetch('/api/loyalty/phone-auth', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      set({ loading: false, error: null });
    } catch (err) {
      if (err instanceof ApiClientError) {
        set({ loading: false, error: err.message || 'Phone auth failed' });
      } else {
        set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
      }
    }
  },

  clearError: () => set({ error: null }),
}));
