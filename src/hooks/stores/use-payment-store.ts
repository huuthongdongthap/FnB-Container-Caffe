import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Payment store — Zustand, no persistence.
   Uses apiFetch for httpOnly cookie auth.
   ═══════════════════════════════════════════════════════════════════ */

interface PaymentState {
  paymentLink: string | null;
  loading: boolean;
  error: string | null;
  retryCount: number;

  createPaymentLink: (orderId: string, amount: number) => Promise<string | null>;
  retryCreatePaymentLink: (orderId: string, amount: number, maxRetries?: number) => Promise<string | null>;
  clearPaymentError: () => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  paymentLink: null,
  loading: false,
  error: null,
  retryCount: 0,

  createPaymentLink: async (orderId: string, amount: number) => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ checkoutUrl?: string; checkout_url?: string; payment?: { checkoutUrl?: string }; url?: string }>(
        '/api/payment/create-link',
        {
          method: 'POST',
          body: JSON.stringify({ order_id: orderId, amount }),
        },
      );

      const url: string | null = body.checkoutUrl || body.checkout_url || body.payment?.checkoutUrl || body.url || null;
      set({ paymentLink: url, loading: false, error: null });
      return url;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
      return null;
    }
  },

  retryCreatePaymentLink: async (orderId: string, amount: number, maxRetries = 3) => {
    set({ retryCount: 0 });
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      set({ retryCount: attempt + 1 });
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
      try {
        const url = await get().createPaymentLink(orderId, amount);
        if (url) {
          set({ retryCount: 0 });
          return url;
        }
      } catch {
        // createPaymentLink handles its own errors; continue retry loop
      }
    }
    set({ error: get().error || 'Không thể tạo liên kết thanh toán sau 3 lần thử' });
    return null;
  },

  clearPaymentError: () => set({ error: null, retryCount: 0 }),
}));