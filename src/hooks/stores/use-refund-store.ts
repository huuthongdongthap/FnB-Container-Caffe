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

      const hash: string | null = body.tx_hash || body.transactionHash || body.txHash || null;

      set({ status: 'success', txHash: hash, error: null });
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
      const body = await apiFetch<any>(`/api/payments/refunds/${paymentId}`);
      set({
        paymentId,
        amount: body.amount ?? get().amount,
        reason: body.reason ?? get().reason,
        status: 'success',
        txHash: body.tx_hash || body.transactionHash || body.txHash || null,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ status: 'error', error: message });
    }
  },

  reset: () => set({ ...INITIAL }),
}));
