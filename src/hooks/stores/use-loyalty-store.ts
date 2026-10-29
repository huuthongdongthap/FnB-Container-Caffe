import { create } from 'zustand';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { readClientSession, saveClientSession, subscribeClientSession, type ClientSessionUser } from '@/lib/client-session';
import { loadInitialLoyalty, persistLoyalty, parsePointsHistory, parseRewards, parseLoyaltySummary, parseTierLadder } from './loyalty-store-helpers';

import type { Reward, PointsHistoryEntry, LoyaltyTierLadderItem } from './loyalty-store-types';
export type { Reward, PointsHistoryEntry, LoyaltyTierLadderItem } from './loyalty-store-types';

/* ═══════════════════════════════════════════════════════════════════
   Loyalty store — Zustand with manual localStorage persistence.
   Uses apiFetch from api-client.ts for httpOnly cookie auth + error handling.
   Cashback rate is derived from the API tier_config, not hardcoded.
   ═══════════════════════════════════════════════════════════════════ */

interface LoyaltyState {
  tier: string;
  points: number;
  cashbackRate: number;
  tierLadder: LoyaltyTierLadderItem[];
  rewards: Reward[];
  history: PointsHistoryEntry[];
  loading: boolean;
  error: string | null;

  fetchLoyalty: () => Promise<void>;
  redeemReward: (rewardId: string) => Promise<void>;
  calculateCashback: (amount: number) => number;
  phoneAuth: (phone: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

const initial = loadInitialLoyalty();

export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
  tier: initial?.tier ?? 'bronze',
  points: initial?.points ?? 0,
  cashbackRate: initial?.cashbackRate ?? 3,
  tierLadder: [],
  rewards: [],
  history: [],
  loading: false,
  error: null,

  fetchLoyalty: async () => {
    const sessionToken = readClientSession().token;
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

      let tierLadder: LoyaltyTierLadderItem[] = [];
      try {
        const tiersBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/tiers');
        const tiersData = tiersBody.data || tiersBody;
        const rawTiers = Array.isArray(tiersData) ? tiersData : [];
        tierLadder = parseTierLadder(rawTiers, parseLoyaltySummary(data).tier);
      } catch { /* tier ladder is optional */ }

      if (readClientSession().token !== sessionToken) return;
      const { tier: tierVal, points: pointsVal, cashbackRate: cashbackRateVal } = parseLoyaltySummary(data);
      persistLoyalty(tierVal, pointsVal, cashbackRateVal);
      set({
        tier: tierVal,
        points: pointsVal,
        cashbackRate: cashbackRateVal,
        tierLadder,
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

      persistLoyalty(get().tier, pointsRemaining, get().cashbackRate);
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
    if (amount <= 0 || cashbackRate <= 0) return 0;
    const rate = cashbackRate < 1 ? cashbackRate : cashbackRate / 100;
    return Math.round(amount * rate);
  },

  phoneAuth: async (phone: string) => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch<any>('/api/loyalty/phone-auth', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      const token = res?.customerToken || res?.token || res?.data?.customerToken || res?.data?.token;
      const user = (res?.user || res?.data?.user) as ClientSessionUser | undefined;
      if (token && user) {
        saveClientSession(token, user);
      } else if (token && typeof window !== 'undefined') {
        window.localStorage.setItem('aura_auth_token', token);
      }
      set({ loading: false, error: null });
    } catch (err) {
      if (err instanceof ApiClientError) {
        set({ loading: false, error: err.message || 'Phone auth failed' });
      } else {
        set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
      }
    }
  },

  reset: () => set({
    tier: 'bronze',
    points: 0,
    cashbackRate: 3,
    tierLadder: [],
    rewards: [],
    history: [],
    loading: false,
    error: null,
  }),

  clearError: () => set({ error: null }),
}));

if (typeof window !== 'undefined') {
  subscribeClientSession((session) => {
    if (!session.token) {
      useLoyaltyStore.getState().reset();
    }
  });
}
