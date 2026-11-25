import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  pending_loyalty_reversal?: boolean | null;
  pending_loyalty_transfer_ref?: string | null;
  pending_loyalty_refund_amount?: number | null;
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

interface UnreconciledRefundSummary {
  payment_id: string;
  order_id: string;
  amount: number;
  refund_amount: number | null;
  refund_status: string | null;
  refunded_at: string | null;
}

interface ReadinessApiResponse {
  success?: boolean;
  data?: {
    ready?: boolean;
    unreconciledCount?: number;
    unreconciledRefunds?: UnreconciledRefundSummary[];
  };
}

interface LoyaltyRetryPayload {
  amount: number;
  reason: string;
  reference: string;
}

const DETERMINISTIC_HTTP_STATUSES = new Set([400, 403, 409, 422]);

function extractErrorMeta(failure: unknown, fallbackMessage: string): { status?: number; code?: string; message: string } {
  if (failure && typeof failure === 'object') {
    const rec = failure as { status?: unknown; code?: unknown; message?: unknown };
    return {
      status: typeof rec.status === 'number' ? rec.status : undefined,
      code: typeof rec.code === 'string' ? rec.code : undefined,
      message: typeof rec.message === 'string' ? rec.message : fallbackMessage,
    };
  }
  return {
    message: failure instanceof Error ? failure.message : fallbackMessage,
  };
}

export function ManualOrderRefund({ order, onRecorded }: { order: AdminOrder; onRecorded: () => void }) {
  const session = useSubmissionSession();
  return <RefundSession key={`${session}:${order.id}:${(order as RefundOrder).refund_amount ?? 0}`} order={order} onRecorded={onRecorded} />;
}

function RefundSession({ order, onRecorded }: { order: AdminOrder; onRecorded: () => void }) {
  const { t } = useTranslation();
  const { role } = useClientSessionScope();
  const payment = order as RefundOrder;
  const paid = Number(payment.payment_amount);
  const refunded = Number(payment.refund_amount ?? 0);
  const remaining = paid - refunded;
  const persistedPendingRef =
    order.pendingLoyaltyTransferRef ?? payment.pending_loyalty_transfer_ref ?? null;
  const rawPersistedPendingAmount = Number(
    order.pendingLoyaltyRefundAmount ?? payment.pending_loyalty_refund_amount,
  );
  const persistedPendingAmount =
    Number.isSafeInteger(rawPersistedPendingAmount) && rawPersistedPendingAmount > 0
      ? rawPersistedPendingAmount
      : refunded > 0
        ? refunded
        : paid;
  const hasPersistedPendingLoyalty = Boolean(
    (order.pendingLoyaltyReversal ?? payment.pending_loyalty_reversal) && persistedPendingRef,
  );

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'recorded' | 'loyalty_failed' | 'deterministic_error' | 'error'>(
    hasPersistedPendingLoyalty ? 'loyalty_failed' : 'idle',
  );
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [loyaltyError, setLoyaltyError] = useState('');
  const [loyaltyRetryPayload, setLoyaltyRetryPayload] = useState<LoyaltyRetryPayload | null>(
    hasPersistedPendingLoyalty && persistedPendingRef
      ? {
          amount: persistedPendingAmount,
          reason: t('orderMgmt.refund.retryLoyaltyReason', { defaultValue: 'Thu hồi lại điểm loyalty sau hoàn tiền' }),
          reference: persistedPendingRef,
        }
      : null,
  );
  const [reconciling, setReconciling] = useState(false);
  const [reconcileNotice, setReconcileNotice] = useState('');
  const [readinessInspection, setReadinessInspection] = useState<{
    inspected: boolean;
    unreconciledCount: number;
    unreconciledRefunds: UnreconciledRefundSummary[];
  } | null>(null);
  const [acknowledgeLegacyChecked, setAcknowledgeLegacyChecked] = useState(false);
  const locked = useRef(false);

  const canManageRefund = Boolean(role && ['owner', 'manager', 'admin', 'super_admin'].includes(role));
  const normalizedMethod = String(payment.payment_method ?? '').trim().toLowerCase();
  const isCashOrCod = normalizedMethod === 'cod' || normalizedMethod === 'cash';
  const isSupportedMethod = normalizedMethod === 'payos' || isCashOrCod;

  const isFullyRefunded = Boolean(payment.payment_id) && isSupportedMethod
    && (payment.refund_status === 'completed' || payment.refund_status === 'refunded' || payment.payment_status === 'refunded');

  if (isFullyRefunded && status !== 'loyalty_failed') {
    return (
      <div className="mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
        {t('orderMgmt.refund.fullyRefunded', { defaultValue: 'Đã hoàn tiền toàn bộ' })}
        {Number.isSafeInteger(refunded) && refunded > 0 ? `: ${refunded.toLocaleString('vi-VN')} ₫` : ''}
      </div>
    );
  }

  if (!canManageRefund) return null;

  const hasTransactionIdField = payment.payment_transaction_id !== undefined;
  const hasValidPayosTransactionId = isCashOrCod
    || !hasTransactionIdField
    || (typeof payment.payment_transaction_id === 'string' && /^\d+$/.test(payment.payment_transaction_id.trim()));

  const baseEligible = Boolean(payment.payment_id) && isSupportedMethod
    && ['paid', 'completed', 'partially_refunded'].includes(payment.payment_status ?? '')
    && (!payment.refund_status || payment.refund_status === 'partial')
    && Number.isSafeInteger(paid) && Number.isSafeInteger(refunded) && refunded >= 0 && remaining > 0;

  if (baseEligible && !hasValidPayosTransactionId) {
    return (
      <p role="status" className="mt-1 text-xs text-amber-300/80">
        {t('orderMgmt.refund.invalidPayosTx', { defaultValue: 'Giao dịch PayOS chưa có mã giao dịch hợp lệ' })}
      </p>
    );
  }

  if (!baseEligible && status !== 'loyalty_failed') {
    return payment.refund_status ? (
      <p role="status" className="text-xs text-amber-300">
        {t('orderMgmt.refund.reconciliationRequired', { defaultValue: 'Cần đối soát hoàn tiền' })}
      </p>
    ) : null;
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
        throw new Error(t('orderMgmt.refund.notConfirmed', { defaultValue: 'Chưa xác nhận ghi nhận hoàn tiền' }));
      }
      if (data.loyalty_reversal?.status === 'failed') {
        locked.current = false;
        setLoyaltyRetryPayload(payload);
        setLoyaltyError(
          data.loyalty_reversal.message || data.loyalty_reversal.error
          || t('orderMgmt.refund.loyaltyFailed', {
            defaultValue: 'Hoàn tiền đã ghi nhận nhưng thu hồi điểm loyalty thất bại.',
          }),
        );
        setStatus('loyalty_failed');
        return;
      }
      setLoyaltyRetryPayload(null);
      setStatus('recorded');
      onRecorded();
    } catch (failure) {
      const meta = extractErrorMeta(
        failure,
        t('orderMgmt.refund.cannotConfirm', { defaultValue: 'Không thể xác nhận hoàn tiền' }),
      );
      setError(meta.message);
      setErrorCode(meta.code);
      if (meta.status !== undefined && DETERMINISTIC_HTTP_STATUSES.has(meta.status)) {
        locked.current = false;
        setStatus('deterministic_error');
      } else {
        setStatus('error');
      }
    }
  }

  async function handleReconcileReadiness() {
    setReconciling(true);
    setReconcileNotice('');
    try {
      const requiresLegacyAck =
        readinessInspection?.inspected === true && readinessInspection.unreconciledCount > 0;

      if (!requiresLegacyAck) {
        const checkRes = await apiFetch<ReadinessApiResponse>('/api/payments/refund-readiness');
        const list = Array.isArray(checkRes?.data?.unreconciledRefunds)
          ? checkRes.data.unreconciledRefunds
          : [];
        const count = Math.max(Number(checkRes?.data?.unreconciledCount ?? 0), list.length);
        if (count > 0) {
          setReadinessInspection({
            inspected: true,
            unreconciledCount: count,
            unreconciledRefunds: list,
          });
          setAcknowledgeLegacyChecked(false);
          return;
        }
      } else if (!acknowledgeLegacyChecked) {
        return;
      }

      const res = await apiFetch<ReadinessApiResponse>('/api/payments/refund-readiness/reconcile', {
        method: 'POST',
        body: JSON.stringify(requiresLegacyAck ? { acknowledgeLegacy: true } : {}),
      });
      if (res?.success) {
        setStatus('idle');
        setError('');
        setErrorCode(undefined);
        setReadinessInspection(null);
        setAcknowledgeLegacyChecked(false);
        setReconcileNotice(
          t('orderMgmt.refund.reconcileSuccess', {
            defaultValue: 'Đã hoàn tất đối soát lịch sử hoàn tiền. Bạn có thể bấm xác nhận lại.',
          }),
        );
      }
    } catch (failure) {
      const meta = extractErrorMeta(
        failure,
        t('orderMgmt.refund.reconcileFailed', { defaultValue: 'Không thể đối soát lịch sử hoàn tiền' }),
      );
      setError(meta.message);
    } finally {
      setReconciling(false);
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

  return (
    <div className="inline-flex flex-wrap items-center gap-2 text-xs">
      {refunded > 0 && (
        <span role="status" className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-200">
          {t('orderMgmt.refund.partiallyRefunded', { defaultValue: 'Đã hoàn một phần' })}: {refunded.toLocaleString('vi-VN')} ₫
        </span>
      )}

      {status === 'loyalty_failed' && !open && (
        <button
          type="button"
          onClick={handleRetryLoyalty}
          className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
        >
          {t('orderMgmt.refund.retryLoyalty', { defaultValue: 'Thử thu hồi lại điểm loyalty / Retry loyalty reversal' })}
        </button>
      )}

      {baseEligible && !open && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
          onClick={() => {
            setAmount(String(remaining));
            setReconcileNotice('');
            setOpen(true);
          }}
        >
          {t('orderMgmt.refund.recordButton', { defaultValue: 'Ghi nhận hoàn tiền' })}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`${t('orderMgmt.refund.title', { defaultValue: 'Hoàn tiền' })} ${order.id}`}
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-3 rounded-xl border border-white/15 bg-[#0A1A2E] p-5 text-sm text-white shadow-2xl"
            aria-label={`Hoàn tiền / Refund ${order.id}`}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-semibold text-base">
                {t('orderMgmt.refund.title', { defaultValue: 'Ghi nhận hoàn tiền' })} · {order.id}
              </h3>
              <button
                type="button"
                disabled={status === 'pending'}
                onClick={() => {
                  if (status === 'loyalty_failed') onRecorded();
                  if (status === 'deterministic_error') {
                    setStatus('idle');
                    setError('');
                    setErrorCode(undefined);
                    setReadinessInspection(null);
                    setAcknowledgeLegacyChecked(false);
                  }
                  setOpen(false);
                }}
                className="rounded px-2 py-0.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label={t('common.closeModal', { defaultValue: 'Tắt hộp thoại' })}
              >
                ×
              </button>
            </div>

            <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
              {t('orderMgmt.refund.paid', { defaultValue: 'Đã thu' })}: <strong>{paid.toLocaleString('vi-VN')} ₫</strong>
              {' · '}
              {t('orderMgmt.refund.refunded', { defaultValue: 'Đã hoàn' })}: <strong>{refunded.toLocaleString('vi-VN')} ₫</strong>
              {' · '}
              {t('orderMgmt.refund.remaining', { defaultValue: 'Còn lại' })}: <strong>{remaining.toLocaleString('vi-VN')} ₫</strong>
            </div>

            <p className="text-xs text-slate-400">
              {isCashOrCod
                ? t('orderMgmt.refund.cashNotice', {
                    defaultValue: 'Ghi nhận hoàn trả tiền mặt tại quầy và tự động bù trừ đối soát ca trực.',
                  })
                : t('orderMgmt.refund.manualNotice', {
                    defaultValue: 'Chỉ ghi nhận tiền đã chuyển thủ công. PayOS không tự chuyển tiền.',
                  })}
            </p>

            <label className="block space-y-1 text-xs">
              <span className="text-slate-300">{t('orderMgmt.refund.amount', { defaultValue: 'Số tiền' })}</span>
              <input
                className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                type="number"
                min="1"
                max={remaining}
                step="1"
                required
                value={amount}
                disabled={inputsDisabled}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="text-slate-300">{t('orderMgmt.refund.reason', { defaultValue: 'Lý do' })}</span>
              <input
                className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                required
                maxLength={500}
                value={reason}
                disabled={inputsDisabled}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="text-slate-300">
                {isCashOrCod
                  ? t('orderMgmt.refund.cashReference', { defaultValue: 'Mã phiếu chi / Mã tham chiếu' })
                  : t('orderMgmt.refund.reference', { defaultValue: 'Mã chuyển khoản' })}
              </span>
              <input
                className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
                required
                maxLength={200}
                value={reference}
                disabled={inputsDisabled}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>

            <label className="flex items-start gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmed}
                disabled={inputsDisabled}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {isCashOrCod
                  ? t('orderMgmt.refund.confirmCashRefund', {
                      defaultValue: 'Tôi xác nhận khách đã nhận tiền mặt hoàn trả',
                    })
                  : t('orderMgmt.refund.confirmTransfer', {
                      defaultValue: 'Tôi xác nhận khách đã nhận tiền chuyển khoản hoàn trả',
                    })}
              </span>
            </label>

            {reconcileNotice && (
              <p role="status" className="rounded border border-emerald-400/40 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                {reconcileNotice}
              </p>
            )}
            {status === 'pending' && (
              <p role="status" className="text-xs text-slate-300">
                {t('orderMgmt.refund.awaitingConfirmation', { defaultValue: 'Đang chờ xác nhận...' })}
              </p>
            )}
            {status === 'recorded' && (
              <p role="status" className="text-xs text-emerald-300">
                {t('orderMgmt.refund.recorded', { defaultValue: 'Đã ghi nhận hoàn tiền' })}
              </p>
            )}
            {status === 'loyalty_failed' && (
              <div role="alert" className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                <p>{loyaltyError}</p>
                <button
                  type="button"
                  onClick={handleRetryLoyalty}
                  className="rounded border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
                >
                  {t('orderMgmt.refund.retryLoyalty', { defaultValue: 'Thử thu hồi lại điểm loyalty / Retry loyalty reversal' })}
                </button>
              </div>
            )}
            {status === 'deterministic_error' && (
              <div role="alert" className="space-y-2 rounded border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-200">
                {errorCode === 'REFUND_HISTORY_UNRECONCILED' ? (
                  <>
                    <p>
                      {t('orderMgmt.refund.unreconciledError', {
                        defaultValue:
                          'Lịch sử hoàn tiền của cửa hàng chưa được đối soát (REFUND_HISTORY_UNRECONCILED). Vui lòng kiểm tra và xác nhận đối soát để bật tính năng ghi nhận hoàn tiền.',
                      })}
                    </p>
                    {readinessInspection?.inspected && readinessInspection.unreconciledCount > 0 && (
                      <div className="space-y-2 rounded border border-amber-400/40 bg-amber-500/10 p-2 text-amber-100">
                        <p className="font-semibold">
                          {t('orderMgmt.refund.unreconciledLegacyCount', {
                            defaultValue: `Phát hiện ${readinessInspection.unreconciledCount} giao dịch hoàn tiền cũ chưa có chứng từ chuyển khoản:`,
                            count: readinessInspection.unreconciledCount,
                          })}
                        </p>
                        {readinessInspection.unreconciledRefunds.length > 0 && (
                          <ul className="max-h-28 list-disc space-y-1 overflow-y-auto pl-4 text-[11px] text-amber-200">
                            {readinessInspection.unreconciledRefunds.map((item) => (
                              <li key={item.payment_id}>
                                #{item.order_id} ({item.payment_id}) —{' '}
                                {Number(item.refund_amount ?? item.amount ?? 0).toLocaleString('vi-VN')} ₫ (
                                {item.refund_status ?? 'legacy'})
                              </li>
                            ))}
                          </ul>
                        )}
                        <label className="flex items-start gap-2 text-xs text-amber-100">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={acknowledgeLegacyChecked}
                            disabled={reconciling}
                            onChange={(e) => setAcknowledgeLegacyChecked(e.target.checked)}
                          />
                          <span>
                            {t('orderMgmt.refund.acknowledgeLegacyConfirm', {
                              defaultValue:
                                'Tôi đã rà soát các giao dịch hoàn tiền cũ nêu trên và xác nhận cho phép đối soát lịch sử',
                            })}
                          </span>
                        </label>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={
                        reconciling ||
                        Boolean(
                          readinessInspection?.inspected &&
                            readinessInspection.unreconciledCount > 0 &&
                            !acknowledgeLegacyChecked,
                        )
                      }
                      onClick={handleReconcileReadiness}
                      className="rounded border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                    >
                      {reconciling
                        ? t('orderMgmt.refund.reconciling', { defaultValue: 'Đang đối soát...' })
                        : readinessInspection?.inspected && readinessInspection.unreconciledCount > 0
                          ? t('orderMgmt.refund.confirmLegacyReconcile', {
                              defaultValue: 'Xác nhận đã kiểm tra và hoàn tất đối soát',
                            })
                          : t('orderMgmt.refund.reconcileNow', {
                              defaultValue: 'Kiểm tra & đối soát lịch sử hoàn tiền',
                            })}
                    </button>
                  </>
                ) : (
                  <p>{error}</p>
                )}
              </div>
            )}
            {status === 'error' && (
              <p role="alert" className="rounded border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-200">
                {error} — {t('orderMgmt.refund.reconcileReload', { defaultValue: 'Cần đối soát và tải lại trang trước khi thử tiếp.' })}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
                disabled={status === 'pending'}
                onClick={() => {
                  if (status === 'loyalty_failed') {
                    onRecorded();
                  }
                  if (status === 'deterministic_error') {
                    setStatus('idle');
                    setError('');
                    setErrorCode(undefined);
                    setReadinessInspection(null);
                    setAcknowledgeLegacyChecked(false);
                  }
                  setOpen(false);
                }}
              >
                {t('common.close', { defaultValue: 'Đóng' })}
              </button>
              {status !== 'loyalty_failed' && (
                <button
                  type="submit"
                  disabled={!valid || (status !== 'idle' && status !== 'deterministic_error')}
                  className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#0A1A2E] hover:brightness-110 disabled:opacity-40"
                >
                  {t('orderMgmt.refund.confirmButton', { defaultValue: 'Xác nhận ghi nhận' })}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
