import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { readClientSession, subscribeClientSession } from '@/lib/client-session';

/* ═══════════════════════════════════════════════════════════════════
   Referral store — Zustand with manual localStorage persistence.
   Uses apiFetch for httpOnly cookie auth.
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
  reset: () => void;
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
    const sessionToken = readClientSession().token;
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ data: Record<string, unknown> }>('/api/loyalty/referral/stats');
      if (readClientSession().token !== sessionToken) return;

      const data = body.data || body;

      const raw: Record<string, unknown> =
        typeof data === 'object' && data !== null && !('data' in data)
          ? (data as Record<string, unknown>)
          : ((data as { data?: Record<string, unknown> }).data ?? {});

      let referralCode: string = (raw.referral_code as string) ?? get().referralCode ?? '';
      if (!referralCode) {
        try {
          const codeRes = await apiFetch<{ data?: { referral_code?: string; code?: string }; referral_code?: string; code?: string }>(
            '/api/loyalty/referral/code',
            { method: 'POST' },
          );
          referralCode =
            codeRes?.data?.referral_code ??
            codeRes?.data?.code ??
            codeRes?.referral_code ??
            codeRes?.code ??
            '';
        } catch {
          // Non-fatal: code provisioning fallback optional
        }
      }
      const totalReferrals: number = (raw.total_referrals as number) ?? 0;
      const cashbackEarned: number = (raw.total_cashback_earned_vnd as number) ?? 0;
      const codeUsage: number = (raw.code_usage as number) ?? 0;
      const recentReferrals: RecentReferral[] = ((raw.recent_referrals as Array<Record<string, unknown>>) ?? []).map((r) => ({
        id: String(r.id),
        referredName: (r.referred_name as string) || (r.referred_phone as string) || 'An danh',
        status: String(r.status),
        cashbackAwarded: Number(r.cashback_awarded_vnd ?? 0),
        createdAt: String(r.created_at),
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
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ success?: boolean; error?: string; message?: string }>('/api/loyalty/referral/apply', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });

      if (body.success === false || body.error) {
        set({ loading: false, error: body.error || body.message || 'Invalid referral code' });
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

  reset: () => set({
    referralCode: null,
    referralCount: 0,
    cashbackEarned: 0,
    codeUsage: 0,
    recentReferrals: [],
    loading: false,
    error: null,
  }),

  clearError: () => set({ error: null }),
}));

if (typeof window !== 'undefined') {
  subscribeClientSession((session) => {
    if (!session.token) {
      useReferralStore.getState().reset();
    }
  });
}
