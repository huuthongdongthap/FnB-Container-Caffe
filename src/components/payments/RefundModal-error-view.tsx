import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorView({
  error,
  isRetryable,
  onClose,
  onRetry,
}: {
  error: string;
  isRetryable: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
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
        <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
          Đóng
        </Button>
        {isRetryable && (
          <Button size="sm" onClick={onRetry} className="flex-1">
            Thử lại
          </Button>
        )}
      </div>
    </div>
  );
}
