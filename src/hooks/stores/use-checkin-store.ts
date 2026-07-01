import { create } from 'zustand';

/* ═══════════════════════════════════════════════════════════════════
   Checkin store — Zustand for loyalty checkin submission.
   Pattern: matches use-auth-store.ts — manual fetch, no middleware.
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

const VIETNAMESE_PHONE_REGEX = /^(0\d{9,10})$/;

export interface CheckinResult {
  points: number;
  reward: string;
}

interface CheckinState {
  checkinResult: CheckinResult | null;
  loading: boolean;
  error: string | null;

  submitCheckin: (phone: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useCheckinStore = create<CheckinState>((set) => ({
  checkinResult: null,
  loading: false,
  error: null,

  submitCheckin: async (phone) => {
    // Client-side validation
    const phoneClean = phone.replace(/[\s.\-]/g, '');
    if (!VIETNAMESE_PHONE_REGEX.test(phoneClean)) {
      set({
        checkinResult: null,
        loading: false,
        error: 'Số điện thoại không hợp lệ. Vui lòng nhập số di động Việt Nam (VD: 0901234567)',
      });
      return;
    }

    set({ loading: true, error: null, checkinResult: null });
    try {
      const res = await fetch(`${API_BASE}/api/loyalty/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneClean }),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Check-in thất bại' });
        return;
      }

      set({
        checkinResult: {
          points: body.data?.points ?? 0,
          reward: body.data?.reward ?? 'Đã ghi nhận',
        },
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    checkinResult: null,
    loading: false,
    error: null,
  }),
}));
