import { cn } from '@/lib/cn';
import type { SyncStatusInfo } from '@/hooks/use-admin';

interface SyncStatusProps {
  status: SyncStatusInfo | undefined;
  isLoading: boolean;
  className?: string;
}

export function SyncStatus({ status, isLoading, className }: SyncStatusProps) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-gray-400', className)}>
        <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        Đang tải trạng thái đồng bộ...
      </div>
    );
  }

  if (!status) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-gray-500', className)}>
        <span className="w-3 h-3 rounded-full bg-gray-400" />
        Chưa có thông tin đồng bộ
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 text-sm', className)}>
      {/* Status indicator */}
      <span
        className={cn(
          'w-3 h-3 rounded-full',
          status.status === 'synced' && 'bg-green-500',
          status.status === 'pending' && 'bg-amber-500 animate-pulse',
          status.status === 'error' && 'bg-red-500'
        )}
      />

      <div className="flex-1">
        <p className="font-medium">
          {status.status === 'synced' && 'Đã đồng bộ'}
          {status.status === 'pending' && 'Đang đồng bộ...'}
          {status.status === 'error' && 'Lỗi đồng bộ'}
        </p>
        {status.lastSync && (
          <p className="text-xs text-gray-400">
            Lần cuối: {new Date(status.lastSync).toLocaleString('vi-VN')}
          </p>
        )}
        {status.pendingItems > 0 && (
          <p className="text-xs text-amber-600">
            {status.pendingItems} mục chờ đồng bộ
          </p>
        )}
        {status.errorMessage && (
          <p className="text-xs text-red-500 mt-0.5">{status.errorMessage}</p>
        )}
      </div>
    </div>
  );
}
