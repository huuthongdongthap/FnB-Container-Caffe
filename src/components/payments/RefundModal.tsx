'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useRefundStore } from '@/tree/payments/use-refund-store';
import { CheckCircle, AlertCircle, Loader2, Clock } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   RefundModal — Modal for initiating payment refunds.
   States: idle (form), loading (spinner), success (green banner),
           error (inline with retry or contact-support).
   Supports partial refunds with remaining-balance preview.
   ═══════════════════════════════════════════════════════════════════ */

interface RefundPayment {
  id: string;
  orderId: string;
  amount: number;
  customerName: string;
}

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: RefundPayment;
  onRefundComplete: () => void;
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

export function RefundModal({ isOpen, onClose, payment, onRefundComplete }: RefundModalProps) {
  const { status, error, txHash, initiateRefund, reset } = useRefundStore();

  const [localAmount, setLocalAmount] = useState('');
  const [localReason, setLocalReason] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Reset local state when modal opens ── */

  useEffect(() => {
    if (isOpen) {
      setLocalAmount(payment.amount.toString());
      setLocalReason('');
      setAmountError(null);
      setShowTimeoutNotice(false);
      reset();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen, payment.amount, reset]);

  /* ── Timeout notice: show after 20s of pending ── */

  useEffect(() => {
    if (status === 'pending') {
      timeoutRef.current = setTimeout(() => {
        setShowTimeoutNotice(true);
      }, 20_000);
    } else {
      setShowTimeoutNotice(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status]);

  /* ── Notify parent on success ── */

  const handleCompleteRef = useRef(onRefundComplete);
  handleCompleteRef.current = onRefundComplete;

  useEffect(() => {
    if (status === 'success' && isOpen) {
      handleCompleteRef.current();
    }
  }, [status, isOpen]);

  /* ── Handlers ── */

  const handleClose = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    reset();
    onClose();
  }, [onClose, reset]);

  const validateAmount = useCallback((): boolean => {
    const amount = Number(localAmount);
    if (!localAmount || isNaN(amount) || amount <= 0) {
      setAmountError('Số tiền hoàn phải lớn hơn 0');
      return false;
    }
    if (amount > payment.amount) {
      setAmountError(
        `Số tiền hoàn không thể vượt quá số dư ${formatVND(payment.amount)}`,
      );
      return false;
    }
    setAmountError(null);
    return true;
  }, [localAmount, payment.amount]);

  const handleSubmit = async () => {
    if (!validateAmount()) return;
    await initiateRefund(payment.id, Number(localAmount), localReason);
  };

  /* ── Derived values ── */

  const parsedAmount = Number(localAmount);
  const remainingBalance = payment.amount - (parsedAmount || 0);
  const isPartialRefund = remainingBalance > 0 && parsedAmount > 0 && parsedAmount <= payment.amount;
  const isLoading = status === 'pending';

  const isRetryable = error
    ? !/đã được|xử lý rồi|không tìm thấy|không hợp lệ|đã hoàn|đã tồn tại/i.test(error)
    : false;

  /* ================================================================ */

  return (
    <Modal open={isOpen} onClose={handleClose} title="Hoàn tiền">
      <div className="space-y-4">
        {/* ── Payment summary ── */}
        <div className="space-y-1 rounded-lg border border-border bg-[var(--aura-bg-input)] p-3">
          <p className="text-sm text-muted">
            Khách hàng:{' '}
            <span className="font-medium text-foreground">{payment.customerName}</span>
          </p>
          <p className="text-sm text-muted">
            Mã đơn:{' '}
            <span className="font-medium text-foreground">{payment.orderId}</span>
          </p>
          <p className="text-sm text-muted">
            Số dư thanh toán:{' '}
            <span className="font-medium text-foreground">{formatVND(payment.amount)}</span>
          </p>
        </div>

        {/* ── Loading state ── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted">Đang xử lý hoàn tiền...</p>
            {showTimeoutNotice && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-300">
                  Yêu cầu đang chờ xử lý từ cổng thanh toán. Hệ thống sẽ tự động cập
                  nhật khi hoàn tất.
                </p>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleClose} className="mt-2">
              Đóng
            </Button>
          </div>
        )}

        {/* ── Success state ── */}
        {status === 'success' && (
          <>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <span className="font-medium text-emerald-300">Hoàn tiền thành công!</span>
              </div>
              <div className="space-y-1 text-sm text-emerald-200/80">
                <p>Khách hàng: {payment.customerName}</p>
                <p>Mã đơn: {payment.orderId}</p>
                <p>
                  Số tiền hoàn: {formatVND(parsedAmount || payment.amount)}
                </p>
                {isPartialRefund && (
                  <p>Số dư còn lại: {formatVND(remainingBalance)}</p>
                )}
                {txHash && (
                  <p className="truncate text-xs text-emerald-200/60">
                    Mã giao dịch: {txHash}
                  </p>
                )}
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">
              Đóng
            </Button>
          </>
        )}

        {/* ── Error state ── */}
        {status === 'error' && error && (
          <>
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm text-red-300">{error}</p>
                  {!isRetryable && (
                    <p className="mt-1 text-xs text-red-300/70">
                      Vui lòng liên hệ hỗ trợ
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose} className="flex-1">
                  Đóng
                </Button>
                {isRetryable && (
                  <Button size="sm" onClick={handleSubmit} className="flex-1">
                    Thử lại
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Idle state — form ── */}
        {status === 'idle' && !isLoading && (
          <>
            {/* Amount input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="refund-amount"
                className="text-sm font-medium text-foreground"
              >
                Số tiền hoàn
              </label>
              <div className="relative">
                <input
                  id="refund-amount"
                  type="number"
                  min={1}
                  max={payment.amount}
                  value={localAmount}
                  onChange={(e) => {
                    setLocalAmount(e.target.value);
                    setAmountError(null);
                  }}
                  onBlur={validateAmount}
                  className={cn(
                    'w-full rounded-lg border bg-[var(--aura-bg-input)] px-4 py-2.5 pr-14 text-base text-foreground',
                    'placeholder:text-[var(--aura-text-disabled)] transition-colors duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--aura-border-focus)] focus:border-transparent',
                    amountError && 'border-destructive focus:ring-destructive',
                  )}
                  aria-invalid={!!amountError}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  VND
                </span>
              </div>
              {amountError && (
                <p className="text-sm text-destructive" role="alert">
                  {amountError}
                </p>
              )}
            </div>

            {/* Partial refund remaining balance */}
            {isPartialRefund && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                <p className="text-xs text-blue-300">
                  Số dư còn lại sau hoàn:{' '}
                  <span className="font-medium">{formatVND(remainingBalance)}</span>
                </p>
              </div>
            )}

            {/* Reason textarea */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="refund-reason"
                className="text-sm font-medium text-foreground"
              >
                Lý do hoàn tiền
              </label>
              <textarea
                id="refund-reason"
                value={localReason}
                onChange={(e) => setLocalReason(e.target.value)}
                placeholder="Nhập lý do hoàn tiền..."
                rows={3}
                className={cn(
                  'w-full resize-none rounded-lg border border-[var(--aura-border-subtle)] bg-[var(--aura-bg-input)] px-4 py-2.5 text-base text-foreground',
                  'placeholder:text-[var(--aura-text-disabled)] transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--aura-border-focus)] focus:border-transparent',
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={handleClose} className="flex-1">
                Hủy
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={!!amountError}
              >
                Xác nhận hoàn tiền
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
