import { useState, useEffect, useCallback, useRef } from 'react';
import { useRefundStore } from '@/tree/payments/use-refund-store';
import { RETRYABLE_ERROR_PATTERN } from './RefundModal-constants';
import type { RefundPayment } from './RefundModal-types';

export function useRefundModal({
  payment,
  onClose,
  onRefundComplete,
  isOpen,
}: {
  payment: RefundPayment;
  onClose: () => void;
  onRefundComplete: () => void;
  isOpen: boolean;
}) {
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
        `Số tiền hoàn không thể vượt quá số dư`,
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
  const isPartialRefund =
    remainingBalance > 0 && parsedAmount > 0 && parsedAmount <= payment.amount;
  const isLoading = status === 'pending';
  const isRetryable = error ? !RETRYABLE_ERROR_PATTERN.test(error) : false;

  return {
    status,
    error,
    txHash,
    localAmount,
    setLocalAmount,
    localReason,
    setLocalReason,
    amountError,
    setAmountError,
    showTimeoutNotice,
    parsedAmount,
    remainingBalance,
    isPartialRefund,
    isLoading,
    isRetryable,
    handleClose,
    validateAmount,
    handleSubmit,
  };
}
