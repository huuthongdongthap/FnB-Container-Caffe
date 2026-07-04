import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { apiFetch, ApiClientError } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Loyalty store — Zustand with manual localStorage persistence.
   Uses apiFetch from api-client.ts for consistent auth + error handling.
   Reads auth token from useAuthStore.getState().token.
   Cashback rate is derived from the API tier_config, not hardcoded.
   ═══════════════════════════════════════════════════════════════════ */

const LOYALTY_KEY = 'aura_loyalty';

export interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string;
  description: string;
}

export interface PointsHistoryEntry {
  id: string;
  date: string;
  reason: string;
  points: number;
  balance: number;
}

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

interface StoredLoyalty {
  tier: string;
  points: number;
  cashbackRate: number;
}

function loadInitialLoyalty(): StoredLoyalty | null {
  try {
    const raw = localStorage.getItem(LOYALTY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.tier !== undefined) return parsed as StoredLoyalty;
    }
  } catch { /* ignore parse errors */ }
  return null;
}

function persistLoyalty(tier: string, points: number, cashbackRate: number): void {
  try {
    localStorage.setItem(LOYALTY_KEY, JSON.stringify({ tier, points, cashbackRate }));
  } catch { /* storage full or unavailable */ }
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
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated. Vui lòng đăng nhập.', loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      // Fetch loyalty summary — returns tier, points, tier_config, wallet
      const body = await apiFetch<{ success: boolean; data: Record<string, unknown> }>('/api/loyalty/summary');
      const data = body.data || body;

      // Fetch points history (separate endpoint, optional)
      let history: PointsHistoryEntry[] = [];
      try {
        const pointsBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/points');
        const pointsData = pointsBody.data || pointsBody;
        const rawEntries = Array.isArray(pointsData) ? pointsData : [];
        history = rawEntries.map((entry: Record<string, unknown>) => ({
          id: String(entry.id || ''),
          date: String(entry.created_at || entry.date || ''),
          reason: String(entry.reason || ''),
          points: Number(entry.points_change ?? entry.points ?? 0),
          balance: Number(entry.balance_after ?? entry.balance ?? 0),
        }));
      } catch { /* points history is optional */ }

      // Fetch available rewards (separate endpoint, optional)
      let rewards: Reward[] = [];
      try {
        const rewardsBody = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/api/loyalty/rewards');
        const rewardsData = rewardsBody.data || rewardsBody;
        const rawRewards = Array.isArray(rewardsData) ? rewardsData : [];
        rewards = rawRewards.map((r: Record<string, unknown>) => ({
          id: String(r.id || ''),
          name: String(r.title || r.name || ''),
          cost: Number(r.point_cost ?? r.cost ?? 0),
          icon: String(r.icon || '🎁'),
          description: String(r.description || ''),
        }));
      } catch { /* rewards are optional */ }

      // Map API response fields (snake_case from D1) to store camelCase fields
      const tierVal: string = (data.tier as string) || 'bronze';
      // Summary handler returns total_points (not points)
      const pointsVal: number = Number(data.total_points ?? data.points ?? 0);
      // Cashback rate comes from tier_config row returned by summary handler
      const tierConfig = data.tier_config as Record<string, unknown> | undefined;
      const cashbackRateVal: number = Number(
        (data.cashbackRate as number) ??
        (tierConfig?.cashback_rate as number) ??
        3
      );

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
          // apiFetch already called logout() internally — just surface the message
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
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated.' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ success: boolean; data: Record<string, unknown> }>('/api/loyalty/redeem', {
        method: 'POST',
        body: JSON.stringify({ reward_id: rewardId }),
      });
      const data = body.data || body;
      // API returns points_remaining (snake_case)
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
