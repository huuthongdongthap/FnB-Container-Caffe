import { create } from 'zustand';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import {
  readSessionSnapshot,
  isSameSessionSnapshot,
  saveClientSession,
  subscribeSessionChange,
  type ClientSessionUser,
} from '@/lib/client-session';
import {
  loadInitialLoyalty,
  persistLoyalty,
  parsePointsHistory,
  parseRewards,
  parseMyRewards,
  parseLoyaltySummary,
  parseTierLadder,
} from './loyalty-store-helpers';

import type {
  Reward,
  PointsHistoryEntry,
  LoyaltyTierLadderItem,
  NextTierInfo,
  RedeemedVoucher,
} from './loyalty-store-types';
export type {
  Reward,
  PointsHistoryEntry,
  LoyaltyTierLadderItem,
  NextTierInfo,
  RedeemedVoucher,
} from './loyalty-store-types';

/* ═══════════════════════════════════════════════════════════════════
   Loyalty store — Zustand with manual localStorage persistence.
   Uses apiFetch from api-client.ts for httpOnly cookie auth + error handling.
   Cashback rate is derived from the API tier_config, not hardcoded.
   ═══════════════════════════════════════════════════════════════════ */

interface LoyaltyState {
  tier: string;
  points: number;
  lifetimePoints: number;
  cashbackRate: number;
  cashbackBalance: number;
  nextTier: NextTierInfo | null;
  tierLadder: LoyaltyTierLadderItem[];
  rewards: Reward[];
  myVouchers: RedeemedVoucher[];
  lastRedeemedVoucher: RedeemedVoucher | null;
  history: PointsHistoryEntry[];
  loading: boolean;
  error: string | null;

  fetchLoyalty: () => Promise<void>;
  redeemReward: (rewardId: string) => Promise<RedeemedVoucher | null>;
  calculateCashback: (amount: number) => number;
  phoneAuth: (phone: string, otp?: string) => Promise<void>;
  clearLastRedeemedVoucher: () => void;
  reset: () => void;
  clearError: () => void;
}

const initial = loadInitialLoyalty();

export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
  tier: initial?.tier ?? 'bronze',
  points: initial?.points ?? 0,
  lifetimePoints: initial?.points ?? 0,
  cashbackRate: initial?.cashbackRate ?? 3,
  cashbackBalance: 0,
  nextTier: null,
  tierLadder: [],
  rewards: [],
  myVouchers: [],
  lastRedeemedVoucher: null,
  history: [],
  loading: false,
  error: null,

  fetchLoyalty: async () => {
    const sessionSnap = readSessionSnapshot();
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

      let myVouchers: RedeemedVoucher[] = [];
      try {
        const myRewardsBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/my-rewards');
        const myRewardsData = myRewardsBody.data || myRewardsBody;
        const rawMyRewards = Array.isArray(myRewardsData) ? myRewardsData : [];
        myVouchers = parseMyRewards(rawMyRewards);
      } catch { /* my-rewards is optional */ }

      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) return;
      const {
        tier: tierVal,
        points: pointsVal,
        lifetimePoints: lifetimePointsVal,
        cashbackRate: cashbackRateVal,
        cashbackBalance: cashbackBalanceVal,
        nextTier: nextTierVal,
      } = parseLoyaltySummary(data);
      persistLoyalty(tierVal, pointsVal, cashbackRateVal);
      set({
        tier: tierVal,
        points: pointsVal,
        lifetimePoints: lifetimePointsVal,
        cashbackRate: cashbackRateVal,
        cashbackBalance: cashbackBalanceVal,
        nextTier: nextTierVal,
        tierLadder,
        rewards,
        myVouchers,
        history,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) return;
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

  redeemReward: async (rewardId: string): Promise<RedeemedVoucher | null> => {
    const sessionSnap = readSessionSnapshot();
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ success: boolean; data: Record<string, unknown> }>('/api/loyalty/redeem', {
        method: 'POST',
        body: JSON.stringify({ reward_id: rewardId }),
      });
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) return null;
      const data = body.data || body;
      const pointsRemaining = Number(data.points_remaining ?? data.newBalance ?? data.points ?? get().points);
      const code = String(data.voucherCode ?? data.code ?? '').trim();
      const expiresAt = data.expiresAt ? String(data.expiresAt) : data.expires_at ? String(data.expires_at) : null;
      const rewardTitle =
        typeof data.reward === 'string'
          ? data.reward
          : typeof data.reward === 'object' && data.reward !== null
            ? String((data.reward as Record<string, unknown>).name ?? (data.reward as Record<string, unknown>).title ?? code)
            : (get().rewards.find((r) => r.id === rewardId)?.name ?? code);
      const redeemedVoucher: RedeemedVoucher | null = code
        ? {
            id: String(data.transactionId ?? data.id ?? code),
            rewardId,
            code,
            title: rewardTitle,
            status: 'active',
            expiresAt,
            createdAt: new Date().toISOString(),
          }
        : null;

      persistLoyalty(get().tier, pointsRemaining, get().cashbackRate);
      set((state) => ({
        points: pointsRemaining,
        myVouchers: redeemedVoucher
          ? [redeemedVoucher, ...state.myVouchers.filter((v) => v.code !== redeemedVoucher.code)]
          : state.myVouchers,
        lastRedeemedVoucher: redeemedVoucher,
        loading: false,
        error: null,
      }));
      return redeemedVoucher;
    } catch (err) {
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) return null;
      if (err instanceof ApiClientError) {
        set({ loading: false, error: err.message || 'Redeem failed' });
      } else {
        set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
      }
      return null;
    }
  },

  clearLastRedeemedVoucher: () => set({ lastRedeemedVoucher: null }),

  calculateCashback: (amount: number): number => {
    const { cashbackRate } = get();
    if (amount <= 0 || cashbackRate <= 0) return 0;
    const rate = cashbackRate < 1 ? cashbackRate : cashbackRate / 100;
    return Math.round(amount * rate);
  },

  phoneAuth: async (phone: string, otp?: string) => {
    set({ loading: true, error: null });
    try {
      const payload = otp ? { phone, otp } : { phone };
      const res = await apiFetch<any>('/api/loyalty/phone-auth', {
        method: 'POST',
        body: JSON.stringify(payload),
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

  reset: () => {
    try {
      localStorage.removeItem('aura_loyalty');
    } catch { /* ignore */ }
    set({
      tier: 'bronze',
      points: 0,
      lifetimePoints: 0,
      cashbackRate: 3,
      cashbackBalance: 0,
      nextTier: null,
      tierLadder: [],
      rewards: [],
      myVouchers: [],
      lastRedeemedVoucher: null,
      history: [],
      loading: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));

// Reset loyalty state whenever the active session token, user, or tenant changes
// so points, tier ladder, and reward history never bleed across accounts.
if (typeof window !== 'undefined') {
  subscribeSessionChange(() => {
    useLoyaltyStore.getState().reset();
  });
}
