import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';
import { useSubmissionSession } from '@/lib/server-confirmed-submission';
import type { AdminOrder } from '@/hooks/use-admin';

type RefundOrder = AdminOrder & {
  payment_id?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_amount?: number | null;
  payment_transaction_id?: string | null;
  refund_amount?: number | null;
  refund_status?: string | null;
};

interface RefundApiResponse {
  success?: boolean;
  data?: {
    paymentId?: string;
    amount?: number;
    refund_status?: string;
    manual_transfer_ref?: string;
    loyalty_reversal?: {
      status?: string;
      retryable?: boolean;
      error?: string;
      message?: string;
    };
  };
}

interface LoyaltyRetryPayload {
  amount: number;
  reason: string;
  reference: string;
}

const DETERMINISTIC_HTTP_STATUSES = new Set([400, 403, 409, 422]);

function extractErrorMeta(failure: unknown): { status?: number; code?: string; message: string } {
  if (failure && typeof failure === 'object') {
    const rec = failure as { status?: unknown; code?: unknown; message?: unknown };
    return {
      status: typeof rec.status === 'number' ? rec.status : undefined,
      code: typeof rec.code === 'string' ? rec.code : undefined,
      message: typeof rec.message === 'string' ? rec.message : 'Không thể xác nhận / Cannot confirm',
    };
  }
  return {
    message: failure instanceof Error ? failure.message : 'Không thể xác nhận / Cannot confirm',
  };
}

export function ManualOrderRefund({ order, onRecorded }: { order: AdminOrder; onRecorded: () => void }) {
  const session = useSubmissionSession();
  return <RefundSession key={`${session}:${order.id}:${(order as RefundOrder).refund_amount ?? 0}`} order={order} onRecorded={onRecorded} />;
}

function RefundSession({ order, onRecorded }: { order: AdminOrder; onRecorded: () => void }) {
  const { role } = useClientSessionScope();
  const payment = order as RefundOrder;
  const paid = Number(payment.payment_amount);
  const refunded = Number(payment.refund_amount ?? 0);
  const remaining = paid - refunded;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'recorded' | 'loyalty_failed' | 'deterministic_error' | 'error'>('idle');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [loyaltyError, setLoyaltyError] = useState('');
  const [loyaltyRetryPayload, setLoyaltyRetryPayload] = useState<LoyaltyRetryPayload | null>(null);
  const locked = useRef(false);

  const isFullyRefunded = Boolean(payment.payment_id) && payment.payment_method === 'payos'
    && (payment.refund_status === 'completed' || payment.refund_status === 'refunded' || payment.payment_status === 'refunded');
  if (isFullyRefunded && status !== 'loyalty_failed') {
    return <div className="mb-3 rounded border border-border/70 bg-surface/60 px-3 py-2 text-xs text-muted">
      Đã hoàn tiền toàn bộ / Fully refunded{Number.isSafeInteger(refunded) && refunded > 0 ? `: ${refunded.toLocaleString('vi-VN')}₫` : ''}
    </div>;
  }
  if (!role || !['owner', 'manager', 'admin'].includes(role)) return null;

  const hasTransactionIdField = payment.payment_transaction_id !== undefined;
  const hasValidPayosTransactionId = !hasTransactionIdField
    || (typeof payment.payment_transaction_id === 'string' && /^\d+$/.test(payment.payment_transaction_id.trim()));

  const baseEligible = Boolean(payment.payment_id) && payment.payment_method === 'payos'
    && ['paid', 'completed', 'partially_refunded'].includes(payment.payment_status ?? '')
    && (!payment.refund_status || payment.refund_status === 'partial')
    && Number.isSafeInteger(paid) && Number.isSafeInteger(refunded) && refunded >= 0 && remaining > 0;

  if (baseEligible && !hasValidPayosTransactionId) {
    return <p role="status" className="mt-2 text-xs text-amber-300/80">
      Giao dịch PayOS chưa có mã giao dịch hợp lệ / PayOS transaction ID not verified yet
    </p>;
  }

  if (!baseEligible && status !== 'loyalty_failed') {
    return payment.refund_status ? <p role="status">Cần đối soát hoàn tiền / Refund reconciliation required</p> : null;
  }

  const valid = Number.isSafeInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= remaining
    && Boolean(reason.trim()) && Boolean(reference.trim()) && confirmed;

  async function executeRefundRequest(payload: LoyaltyRetryPayload) {
    locked.current = true;
    setStatus('pending');
    setError('');
    setErrorCode(undefined);
    setLoyaltyError('');
    try {
      const response = await apiFetch<RefundApiResponse>('/api/payments/refund', {
        method: 'POST',
        body: JSON.stringify({
          paymentId: payment.payment_id,
          orderId: order.id,
          amount: payload.amount,
          reason: payload.reason,
          manual_transfer_ref: payload.reference,
        }),
      });
      const data = response.data;
      if (response.success !== true || !data || data.paymentId !== payment.payment_id
        || data.amount !== payload.amount || data.manual_transfer_ref !== payload.reference
        || !['partial', 'completed'].includes(data.refund_status ?? '')) {
        throw new Error('Chưa xác nhận ghi nhận / Recording not confirmed');
      }
      if (data.loyalty_reversal?.status === 'failed') {
        locked.current = false;
        setLoyaltyRetryPayload(payload);
        setLoyaltyError(
          data.loyalty_reversal.message || data.loyalty_reversal.error
          || 'Hoàn tiền đã ghi nhận nhưng thu hồi điểm loyalty thất bại. / Refund recorded, but loyalty point reversal failed.',
        );
        setStatus('loyalty_failed');
        return;
      }
      setLoyaltyRetryPayload(null);
      setStatus('recorded');
      onRecorded();
    } catch (failure) {
      const meta = extractErrorMeta(failure);
      setError(meta.message);
      setErrorCode(meta.code);
      if (meta.status !== undefined && DETERMINISTIC_HTTP_STATUSES.has(meta.status)) {
        locked.current = false;
        setStatus('deterministic_error');
      } else {
        setStatus('error');
        // An uncertain financial write remains locked until reconciliation and reload.
      }
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || locked.current) return;
    await executeRefundRequest({
      amount: Number(amount),
      reason: reason.trim(),
      reference: reference.trim(),
    });
  }

  async function handleRetryLoyalty() {
    if (!loyaltyRetryPayload || locked.current) return;
    await executeRefundRequest(loyaltyRetryPayload);
  }

  const inputsDisabled = locked.current || status === 'pending' || status === 'recorded' || status === 'loyalty_failed';

  return <div className="mt-3 text-sm">
    {refunded > 0 && <p role="status">Đã hoàn một phần / Partially refunded: {refunded.toLocaleString('vi-VN')}₫</p>}
    {!open ? <button type="button" className="text-amber-300 underline" onClick={() => { setAmount(String(remaining)); setOpen(true); }}>Ghi nhận hoàn tiền / Record refund</button> :
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-3" aria-label={`Hoàn tiền / Refund ${order.id}`}>
        <p>Đã thu / Paid: {paid.toLocaleString('vi-VN')}₫ · Đã hoàn / Refunded: {refunded.toLocaleString('vi-VN')}₫ · Còn lại / Remaining: {remaining.toLocaleString('vi-VN')}₫</p>
        <p>Chỉ ghi nhận tiền đã chuyển thủ công. PayOS không tự chuyển tiền. / Records an existing manual transfer only; PayOS does not transfer funds.</p>
        <label className="block">Số tiền / Amount<input className="block w-full bg-surface p-2" type="number" min="1" max={remaining} step="1" required value={amount} disabled={inputsDisabled} onChange={e => setAmount(e.target.value)} /></label>
        <label className="block">Lý do / Reason<input className="block w-full bg-surface p-2" required maxLength={500} value={reason} disabled={inputsDisabled} onChange={e => setReason(e.target.value)} /></label>
        <label className="block">Mã chuyển khoản / Transfer reference<input className="block w-full bg-surface p-2" required maxLength={200} value={reference} disabled={inputsDisabled} onChange={e => setReference(e.target.value)} /></label>
        <label className="block"><input type="checkbox" checked={confirmed} disabled={inputsDisabled} onChange={e => setConfirmed(e.target.checked)} /> Tôi xác nhận khách đã nhận tiền / I confirm funds were transferred to the customer</label>
        {status === 'pending' && <p role="status">Đang chờ xác nhận / Awaiting confirmation</p>}
        {status === 'recorded' && <p role="status">Đã ghi nhận / Recorded</p>}
        {status === 'loyalty_failed' && (
          <div role="alert" className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">
            <p>{loyaltyError}</p>
            <button
              type="button"
              onClick={handleRetryLoyalty}
              className="rounded border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
            >
              Thử thu hồi lại điểm loyalty / Retry loyalty reversal
            </button>
          </div>
        )}
        {status === 'deterministic_error' && (
          <div role="alert" className="rounded border border-red-400/40 bg-red-500/10 p-2 text-red-200">
            {errorCode === 'REFUND_HISTORY_UNRECONCILED' ? (
              <p>
                Lịch sử hoàn tiền của cửa hàng chưa được đối soát (REFUND_HISTORY_UNRECONCILED). Vui lòng hoàn tất đối soát lịch sử hoàn tiền trước khi ghi nhận hoàn tiền mới. / Store refund history is unreconciled. Complete refund reconciliation before recording new refunds.
              </p>
            ) : (
              <p>{error}</p>
            )}
          </div>
        )}
        {status === 'error' && <p role="alert">{error} — Cần đối soát, tải lại trước khi thử tiếp. / Reconcile and reload before another attempt.</p>}
        <div className="flex flex-wrap items-center gap-3">
          {status !== 'loyalty_failed' && (
            <button type="submit" disabled={!valid || (status !== 'idle' && status !== 'deterministic_error')} className="rounded border border-border p-2 disabled:opacity-50">Xác nhận ghi nhận / Confirm recording</button>
          )}
          <button
            type="button"
            className="underline disabled:opacity-50"
            disabled={status === 'pending'}
            onClick={() => {
              if (status === 'loyalty_failed') {
                onRecorded();
              }
              if (status === 'deterministic_error') {
                setStatus('idle');
                setError('');
                setErrorCode(undefined);
              }
              setOpen(false);
            }}
          >
            Đóng / Close
          </button>
        </div>
      </form>}
  </div>;
}
