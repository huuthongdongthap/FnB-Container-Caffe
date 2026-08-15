import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatVND } from './RefundModal-constants';
import type { RefundPayment } from './RefundModal-types';

export function FormView({
  payment,
  localAmount,
  onAmountChange,
  amountError,
  onAmountBlur,
  localReason,
  onReasonChange,
  isPartialRefund,
  remainingBalance,
  onClose,
  onSubmit,
}: {
  payment: RefundPayment;
  localAmount: string;
  onAmountChange: (val: string) => void;
  amountError: string | null;
  onAmountBlur: () => void;
  localReason: string;
  onReasonChange: (val: string) => void;
  isPartialRefund: boolean;
  remainingBalance: number;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
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
            onChange={(e) => onAmountChange(e.target.value)}
            onBlur={onAmountBlur}
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
          onChange={(e) => onReasonChange(e.target.value)}
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
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Hủy
        </Button>
        <Button
          onClick={onSubmit}
          className="flex-1"
          disabled={!!amountError}
        >
          Xác nhận hoàn tiền
        </Button>
      </div>
    </>
  );
}
