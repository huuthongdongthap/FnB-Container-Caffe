'use client';

import { Modal } from '@/components/ui/modal';
import { useRefundModal } from './RefundModal-hooks';
import { PaymentSummary } from './RefundModal-payment-summary';
import { LoadingView } from './RefundModal-loading-view';
import { SuccessView } from './RefundModal-success-view';
import { ErrorView } from './RefundModal-error-view';
import { FormView } from './RefundModal-form-view';

/* ═══════════════════════════════════════════════════════════════════
   RefundModal — Modal for initiating payment refunds.
   States: idle (form), loading (spinner), success (green banner),
           error (inline with retry or contact-support).
   Supports partial refunds with remaining-balance preview.
   ═══════════════════════════════════════════════════════════════════ */

// Re-export types and constants for backward compatibility
export type { RefundPayment, RefundModalProps } from './RefundModal-types';
export { formatVND, RETRYABLE_ERROR_PATTERN } from './RefundModal-constants';
export { useRefundModal } from './RefundModal-hooks';
export { PaymentSummary } from './RefundModal-payment-summary';
export { LoadingView } from './RefundModal-loading-view';
export { SuccessView } from './RefundModal-success-view';
export { ErrorView } from './RefundModal-error-view';
export { FormView } from './RefundModal-form-view';

import type { RefundModalProps } from './RefundModal-types';

export function RefundModal({ isOpen, onClose, payment, onRefundComplete }: RefundModalProps) {
  const {
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
  } = useRefundModal({ payment, onClose, onRefundComplete, isOpen });

  return (
    <Modal open={isOpen} onClose={handleClose} title="Hoàn tiền">
      <div className="space-y-4">
        <PaymentSummary payment={payment} />

        {isLoading && (
          <LoadingView showTimeoutNotice={showTimeoutNotice} onClose={handleClose} />
        )}

        {status === 'success' && (
          <SuccessView
            payment={payment}
            parsedAmount={parsedAmount}
            remainingBalance={remainingBalance}
            isPartialRefund={isPartialRefund}
            txHash={txHash}
            onClose={handleClose}
          />
        )}

        {status === 'error' && error && (
          <ErrorView
            error={error}
            isRetryable={isRetryable}
            onClose={handleClose}
            onRetry={handleSubmit}
          />
        )}

        {status === 'idle' && !isLoading && (
          <FormView
            payment={payment}
            localAmount={localAmount}
            onAmountChange={(val) => {
              setLocalAmount(val);
              setAmountError(null);
            }}
            amountError={amountError}
            onAmountBlur={validateAmount}
            localReason={localReason}
            onReasonChange={setLocalReason}
            isPartialRefund={isPartialRefund}
            remainingBalance={remainingBalance}
            onClose={handleClose}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Modal>
  );
}
