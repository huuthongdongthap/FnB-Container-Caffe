import { cn } from '@/lib/cn';

interface ApprovalStatusProps {
  status: 'pending' | 'approved' | 'rejected';
  reward?: string;
  className?: string;
}

export function ApprovalStatus({ status, reward, className }: ApprovalStatusProps) {
  return (
    <div className={cn('text-center', className)}>
      {status === 'pending' && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-amber-800">Đang xử lý</span>
          </div>
          <p className="text-xs text-amber-600">
            Đang kiểm tra trạng thái... Vui lòng đợi nhân viên xác nhận
          </p>
        </div>
      )}

      {status === 'approved' && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="text-3xl mb-2">&#127881;</div>
          <p className="text-sm font-medium text-green-800">
            Cảm ơn bạn đã check-in!
          </p>
          {reward && (
            <div className="mt-2">
              <div className="text-2xl font-bold text-green-700">{reward}</div>
              <p className="text-xs text-green-600">Đã cộng vào ví AURA của bạn</p>
            </div>
          )}
        </div>
      )}

      {status === 'rejected' && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="text-3xl mb-2">&#10060;</div>
          <p className="text-sm font-medium text-red-800">
            Yêu cầu check-in bị từ chối
          </p>
          <p className="text-xs text-red-600 mt-1">
            Vui lòng liên hệ nhân viên để biết thêm chi tiết
          </p>
        </div>
      )}
    </div>
  );
}
