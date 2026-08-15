import { Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadingView({
  showTimeoutNotice,
  onClose,
}: {
  showTimeoutNotice: boolean;
  onClose: () => void;
}) {
  return (
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
      <Button variant="ghost" size="sm" onClick={onClose} className="mt-2">
        Đóng
      </Button>
    </div>
  );
}
