import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Checkin store — Zustand for loyalty checkin submission.
   Pattern: matches use-auth-store.ts — manual fetch, no middleware.
   ═══════════════════════════════════════════════════════════════════ */


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
      const body = await apiFetch<any>('/api/loyalty/checkin', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneClean }),
      });

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
