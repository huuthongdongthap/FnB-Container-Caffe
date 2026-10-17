import { cn } from '@/lib/cn';
import { PartyPopper, XCircle } from 'lucide-react';

interface ApprovalStatusProps {
  status: 'pending' | 'approved' | 'rejected';
  reward?: string;
  className?: string;
}

export function ApprovalStatus({ status, reward, className }: ApprovalStatusProps) {
  return (
    <div className={cn('text-center', className)}>
      {status === 'pending' && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-amber-300">Đang xử lý</span>
          </div>
          <p className="text-xs text-amber-200/80">
            Đang kiểm tra trạng thái... Vui lòng đợi nhân viên xác nhận
          </p>
        </div>
      )}

      {status === 'approved' && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="text-3xl mb-2"><PartyPopper size={28} className="block mx-auto text-emerald-400" /></div>
          <p className="text-sm font-medium text-emerald-300">
            Cảm ơn bạn đã check-in!
          </p>
          {reward && (
            <div className="mt-2">
              <div className="text-2xl font-bold text-emerald-300">{reward}</div>
              <p className="text-xs text-emerald-200/80">Đã cộng vào ví AURA của bạn</p>
            </div>
          )}
        </div>
      )}

      {status === 'rejected' && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="text-3xl mb-2"><XCircle size={28} className="block mx-auto text-red-400" /></div>
          <p className="text-sm font-medium text-red-300">
            Yêu cầu check-in bị từ chối
          </p>
          <p className="text-xs text-red-200/80 mt-1">
            Vui lòng liên hệ nhân viên để biết thêm chi tiết
          </p>
        </div>
      )}
    </div>
  );
}
