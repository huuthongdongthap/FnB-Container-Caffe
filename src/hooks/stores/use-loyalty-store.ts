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
  parseCashbackHistory,
} from './loyalty-store-helpers';
import { useAuthStore, type AuthUser } from './use-auth-store';

import type {
  Reward,
  PointsHistoryEntry,
  LoyaltyTierLadderItem,
  NextTierInfo,
  RedeemedVoucher,
  CashbackTransactionEntry,
} from './loyalty-store-types';
export type {
  Reward,
  PointsHistoryEntry,
  LoyaltyTierLadderItem,
  NextTierInfo,
  RedeemedVoucher,
  CashbackTransactionEntry,
} from './loyalty-store-types';

/* ═══════════════════════════════════════════════════════════════════
   Loyalty store — Zustand with manual localStorage persistence.
   Uses apiFetch from api-client.ts for httpOnly cookie auth + error handling.
   Cashback rate is derived from the API tier_config, not hardcoded.
   ═══════════════════════════════════════════════════════════════════ */

interface PhoneAuthResponseShape {
  success?: boolean;
  token?: string;
  customerToken?: string;
  customer?: Partial<ClientSessionUser> & { id?: string };
  user?: Partial<ClientSessionUser> & { id?: string };
  data?: {
    token?: string;
    customerToken?: string;
    customer?: Partial<ClientSessionUser> & { id?: string };
    user?: Partial<ClientSessionUser> & { id?: string };
  };
}

interface LoyaltyState {
  tier: string;
  points: number;
  lifetimePoints: number;
  cashbackRate: number;
  cashbackBalance: number;
  cashbackTotalEarned: number;
  cashbackTotalSpent: number;
  cashbackExpiring7d: number;
  nextTier: NextTierInfo | null;
  tierLadder: LoyaltyTierLadderItem[];
  rewards: Reward[];
  myVouchers: RedeemedVoucher[];
  lastRedeemedVoucher: RedeemedVoucher | null;
  history: PointsHistoryEntry[];
  cashbackHistory: CashbackTransactionEntry[];
  loading: boolean;
  error: string | null;

  fetchLoyalty: () => Promise<void>;
  fetchPublicCatalog: () => Promise<void>;
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
  cashbackTotalEarned: 0,
  cashbackTotalSpent: 0,
  cashbackExpiring7d: 0,
  nextTier: null,
  tierLadder: [],
  rewards: [],
  myVouchers: [],
  lastRedeemedVoucher: null,
  history: [],
  cashbackHistory: [],
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

      let cashbackHistory: CashbackTransactionEntry[] = [];
      try {
        const cbBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/cashback');
        const cbData = cbBody.data || cbBody;
        const rawCb = Array.isArray(cbData) ? cbData : [];
        cashbackHistory = parseCashbackHistory(rawCb);
      } catch { /* cashback history is optional */ }

      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) return;
      const {
        tier: tierVal,
        points: pointsVal,
        lifetimePoints: lifetimePointsVal,
        cashbackRate: cashbackRateVal,
        cashbackBalance: cashbackBalanceVal,
        cashbackTotalEarned: cashbackTotalEarnedVal,
        cashbackTotalSpent: cashbackTotalSpentVal,
        cashbackExpiring7d: cashbackExpiring7dVal,
        nextTier: nextTierVal,
      } = parseLoyaltySummary(data);
      persistLoyalty(tierVal, pointsVal, cashbackRateVal);
      set({
        tier: tierVal,
        points: pointsVal,
        lifetimePoints: lifetimePointsVal,
        cashbackRate: cashbackRateVal,
        cashbackBalance: cashbackBalanceVal,
        cashbackTotalEarned: cashbackTotalEarnedVal,
        cashbackTotalSpent: cashbackTotalSpentVal,
        cashbackExpiring7d: cashbackExpiring7dVal,
        nextTier: nextTierVal,
        tierLadder,
        rewards,
        myVouchers,
        history,
        cashbackHistory,
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

  fetchPublicCatalog: async () => {
    let tierLadder: LoyaltyTierLadderItem[] = [];
    let rewards: Reward[] = [];
    try {
      const tiersBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/tiers', { silent: true });
      const tiersData = tiersBody?.data || tiersBody;
      if (Array.isArray(tiersData)) {
        tierLadder = parseTierLadder(tiersData, '');
      }
    } catch { /* public tiers optional */ }

    try {
      const rewardsBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/rewards', { silent: true });
      const rewardsData = rewardsBody?.data || rewardsBody;
      if (Array.isArray(rewardsData)) {
        rewards = parseRewards(rewardsData);
      }
    } catch { /* public rewards optional */ }

    set((state) => ({
      tierLadder: tierLadder.length > 0 ? tierLadder : state.tierLadder,
      rewards: rewards.length > 0 ? rewards : state.rewards,
    }));
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
      const res = await apiFetch<PhoneAuthResponseShape>('/api/loyalty/phone-auth', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const token = res?.customerToken || res?.token || res?.data?.customerToken || res?.data?.token;
      const rawUser = res?.customer || res?.user || res?.data?.customer || res?.data?.user;
      if (token && rawUser?.id) {
        const sessionUser: ClientSessionUser = {
          id: String(rawUser.id),
          name: String(rawUser.name || phone),
          email: String(rawUser.email || ''),
          phone: String(rawUser.phone || phone),
          role: String(rawUser.role || 'customer'),
          ...(rawUser.tenantId ? { tenantId: rawUser.tenantId } : {}),
          ...(rawUser.tenant_id ? { tenant_id: rawUser.tenant_id } : {}),
        };
        saveClientSession(token, sessionUser);
        useAuthStore.setState((state) => ({
          user: sessionUser as AuthUser,
          loading: false,
          error: null,
          sessionVersion: state.sessionVersion + 1,
        }));
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
      cashbackTotalEarned: 0,
      cashbackTotalSpent: 0,
      cashbackExpiring7d: 0,
      nextTier: null,
      tierLadder: [],
      rewards: [],
      myVouchers: [],
      lastRedeemedVoucher: null,
      history: [],
      cashbackHistory: [],
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
