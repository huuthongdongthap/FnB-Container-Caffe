import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   Refund store — Zustand, no persistence.
   initiateRefund   POST /api/payments/refund
   checkRefundStatus GET /api/payments/refunds/:paymentId
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

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
    const token = useAuthStore.getState().token;

    if (!token) {
      set({ status: 'error', error: 'Vui lòng đăng nhập để thực hiện hoàn tiền.' });
      return null;
    }

    set({
      paymentId,
      amount,
      reason,
      status: 'pending',
      error: null,
      txHash: null,
    });

    try {
      const res = await fetch(`${API_BASE}/api/payments/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentId, amount, reason }),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ status: 'error', error: body.message || `Hoàn tiền thất bại (${res.status})` });
        return null;
      }

      const hash: string | null = body.tx_hash || body.transactionHash || body.txHash || null;

      set({ status: 'success', txHash: hash, error: null });
      return hash;
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Lỗi kết nối' });
      return null;
    }
  },

  checkRefundStatus: async (paymentId: string | number) => {
    const token = useAuthStore.getState().token;

    if (!token) {
      set({ status: 'error', error: 'Vui lòng đăng nhập.' });
      return;
    }

    set({ status: 'pending', error: null });

    try {
      const res = await fetch(`${API_BASE}/api/payments/refunds/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ status: 'error', error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ status: 'error', error: body.message || 'Không thể kiểm tra trạng thái hoàn tiền' });
        return;
      }

      const body = await res.json();
      set({
        paymentId,
        amount: body.amount ?? get().amount,
        reason: body.reason ?? get().reason,
        status: 'success',
        txHash: body.tx_hash || body.transactionHash || body.txHash || null,
        error: null,
      });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  reset: () => set({ ...INITIAL }),
}));
