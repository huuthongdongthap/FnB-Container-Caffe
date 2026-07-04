import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Loyalty store — Zustand with manual localStorage persistence.
   Uses raw fetch (not apiFetch) to avoid circular dependencies.
   Reads auth token from useAuthStore.getState().token.
   ═══════════════════════════════════════════════════════════════════ */

const LOYALTY_KEY = 'aura_loyalty';

/** Tier cashback rates (matching loyalty calculator) */
const TIER_CASHBACK: Record<string, number> = {
  bronze: 3,
  silver: 5,
  gold: 7,
  platinum: 10,
};

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
      const res = await fetch(`${API_BASE}/api/loyalty/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Session expired. Vui lòng đăng nhập lại.' });
        return;
      }

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Failed to load loyalty data' });
        return;
      }

      const data = body.data || body;

      // Attempt to also fetch points history
      let history: PointsHistoryEntry[] = [];
      try {
        const pointsRes = await fetch(`${API_BASE}/api/loyalty/points`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (pointsRes.ok) {
          const pointsBody = await pointsRes.json();
          const pointsData = pointsBody.data || pointsBody;
          history = pointsData.history || pointsData.entries || [];
        }
      } catch { /* points history is optional */ }

      const tierVal: string = data.tier || 'bronze';
      const pointsVal: number = data.points ?? 0;
      const cashbackRateVal: number = data.cashbackRate ?? TIER_CASHBACK[tierVal] ?? 3;
      const rewardsVal: Reward[] = data.rewards || data.availableRewards || [];

      persistLoyalty(tierVal, pointsVal, cashbackRateVal);
      set({
        tier: tierVal,
        points: pointsVal,
        cashbackRate: cashbackRateVal,
        rewards: rewardsVal,
        history,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
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
      const res = await fetch(`${API_BASE}/api/loyalty/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rewardId }),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Redeem failed' });
        return;
      }

      const data = body.data || body;
      const pointsRemaining = data.pointsRemaining ?? data.points ?? (get().points - (data.cost ?? 0));

      set({ points: pointsRemaining, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
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
      const res = await fetch(`${API_BASE}/api/loyalty/phone-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Phone auth failed' });
        return;
      }

      // If phone auth returns a customer token, we could store it
      // For now, just mark success
      set({ loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  clearError: () => set({ error: null }),
}));
