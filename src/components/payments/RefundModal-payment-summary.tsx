import { formatVND } from './RefundModal-constants';
import type { RefundPayment } from './RefundModal-types';

export function PaymentSummary({ payment }: { payment: RefundPayment }) {
  return (
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
  );
}
