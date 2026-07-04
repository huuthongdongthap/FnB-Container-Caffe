import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Referral store — Zustand with manual localStorage persistence.
   Uses raw fetch (not apiFetch) to avoid circular dependencies.
   Reads auth token from useAuthStore.getState().token.
   Referral endpoints are at /api/loyalty/referral/* (NOT /api/referrals/*)
   ═══════════════════════════════════════════════════════════════════ */

const REFERRAL_KEY = 'aura_referral';

export { REFERRAL_CASHBACK_VND } from '../use-referral';

export interface RecentReferral {
  id: string;
  referredName: string;
  status: string;
  cashbackAwarded: number;
  createdAt: string;
}

interface ReferralState {
  referralCode: string | null;
  referralCount: number;
  cashbackEarned: number;
  codeUsage: number;
  recentReferrals: RecentReferral[];
  loading: boolean;
  error: string | null;

  fetchReferralData: () => Promise<void>;
  applyReferralCode: (code: string) => Promise<void>;
  copyReferralLink: () => string;
  clearError: () => void;
}

interface StoredReferral {
  referralCode: string;
  referralCount: number;
  cashbackEarned: number;
}

function loadInitial(): StoredReferral | null {
  try {
    const raw = localStorage.getItem(REFERRAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.referralCode) return parsed as StoredReferral;
    }
  } catch { /* ignore parse errors */ }
  return null;
}

function persist(data: StoredReferral): void {
  try {
    localStorage.setItem(REFERRAL_KEY, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

const initial = loadInitial();

export const useReferralStore = create<ReferralState>((set, get) => ({
  referralCode: initial?.referralCode ?? null,
  referralCount: initial?.referralCount ?? 0,
  cashbackEarned: initial?.cashbackEarned ?? 0,
  codeUsage: 0,
  recentReferrals: [],
  loading: false,
  error: null,

  fetchReferralData: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated. Vui lòng đăng nhập.', loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/loyalty/referral/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Session expired. Vui lòng đăng nhập lại.' });
        return;
      }

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Failed to load referral data' });
        return;
      }

      const data = body.data || body;

      const referralCode: string = data.referral_code ?? get().referralCode ?? '';
      const totalReferrals: number = data.total_referrals ?? 0;
      const cashbackEarned: number = data.total_cashback_earned_vnd ?? 0;
      const codeUsage: number = data.code_usage ?? 0;
      const rawReferrals: Array<{
        id: string;
        referred_name?: string;
        referred_phone?: string;
        status: string;
        cashback_awarded_vnd?: number;
        created_at: string;
      }> = data.recent_referrals ?? [];

      const recentReferrals: RecentReferral[] = rawReferrals.map((r) => ({
        id: r.id,
        referredName: r.referred_name || r.referred_phone || 'An danh',
        status: r.status,
        cashbackAwarded: r.cashback_awarded_vnd || 0,
        createdAt: r.created_at,
      }));

      persist({ referralCode, referralCount: totalReferrals, cashbackEarned });
      set({
        referralCode,
        referralCount: totalReferrals,
        cashbackEarned,
        codeUsage,
        recentReferrals,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  applyReferralCode: async (code: string) => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated. Vui lòng đăng nhập.' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/loyalty/referral/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Invalid referral code' });
        return;
      }

      // Refresh referral stats after applying
      set({ loading: false, error: null });
      await get().fetchReferralData();
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  copyReferralLink: (): string => {
    const { referralCode } = get();
    if (!referralCode) return '';
    return `${window.location.origin}/referral?ref=${referralCode}`;
  },

  clearError: () => set({ error: null }),
}));
