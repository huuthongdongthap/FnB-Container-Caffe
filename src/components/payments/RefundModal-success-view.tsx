import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatVND } from './RefundModal-constants';
import type { RefundPayment } from './RefundModal-types';

export function SuccessView({
  payment,
  parsedAmount,
  remainingBalance,
  isPartialRefund,
  txHash,
  onClose,
}: {
  payment: RefundPayment;
  parsedAmount: number;
  remainingBalance: number;
  isPartialRefund: boolean;
  txHash: string | null;
  onClose: () => void;
}) {
  return (
    <>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <span className="font-medium text-emerald-300">Hoàn tiền thành công!</span>
        </div>
        <div className="space-y-1 text-sm text-emerald-200/80">
          <p>Khách hàng: {payment.customerName}</p>
          <p>Mã đơn: {payment.orderId}</p>
          <p>Số tiền hoàn: {formatVND(parsedAmount || payment.amount)}</p>
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
      <Button onClick={onClose} className="w-full">
        Đóng
      </Button>
    </>
  );
}
