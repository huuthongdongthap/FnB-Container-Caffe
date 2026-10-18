import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Refund store — Zustand, no persistence.
   initiateRefund   POST /api/payments/refund
   checkRefundStatus GET /api/payments/refunds/:paymentId
   ═══════════════════════════════════════════════════════════════════ */


export type RefundStatus = 'idle' | 'pending' | 'success' | 'error';

export interface RefundState {
  paymentId: string | number | null;
  amount: number;
  reason: string;
  status: RefundStatus;
  error: string | null;
  txHash: string | null;
}

interface RefundActions {
  initiateRefund: (paymentId: string | number, amount: number, reason: string) => Promise<string | null>;
  checkRefundStatus: (paymentId: string | number) => Promise<void>;
  reset: () => void;
}

type RefundStore = RefundState & RefundActions;

const INITIAL: RefundState = {
  paymentId: null,
  amount: 0,
  reason: '',
  status: 'idle',
  error: null,
  txHash: null,
};

export const useRefundStore = create<RefundStore>((set, get) => ({
  ...INITIAL,

  initiateRefund: async (paymentId: string | number, amount: number, reason: string) => {
    set({
      paymentId,
      amount,
      reason,
      status: 'pending',
      error: null,
      txHash: null,
    });

    try {
      const body = await apiFetch<any>('/api/payments/refund', {
        method: 'POST',
        body: JSON.stringify({ paymentId, amount, reason }),
      });

      const data = body?.data ?? body;
      const hash: string | null = data?.tx_hash || data?.transactionHash || data?.txHash || null;

      set({
        status: 'success',
        txHash: hash,
        amount: data?.refundAmount ?? data?.amount ?? amount,
        reason: data?.refundReason ?? data?.reason ?? reason,
        error: null,
      });
      return hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ status: 'error', error: message });
      return null;
    }
  },

  checkRefundStatus: async (paymentId: string | number) => {
    set({ status: 'pending', error: null });

    try {
      const body = await apiFetch<any>(`/api/payments/refunds/${encodeURIComponent(String(paymentId))}`);
      const data = body?.data ?? body;
      set({
        paymentId,
        amount: data?.refundAmount ?? data?.amount ?? get().amount,
        reason: data?.refundReason ?? data?.reason ?? get().reason,
        status: data?.refundStatus === 'completed' || data?.status === 'success' ? 'success' : 'pending',
        txHash: data?.tx_hash || data?.transactionHash || data?.txHash || null,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ status: 'error', error: message });
    }
  },

  reset: () => set({ ...INITIAL }),
}));
