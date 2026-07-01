import { cn, Card, Badge } from '@/components/ui';

export interface ReferralStat {
  id: string;
  referredName: string;
  status: 'pending' | 'completed' | 'reversed';
  cashbackAwarded: number;
  createdAt: string;
}

interface ReferralStatsProps {
  totalReferrals: number;
  totalCashbackEarned: number;
  codeUsage: number;
  recentReferrals: ReferralStat[];
  className?: string;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Cho duyet',
  completed: 'Hoan tat',
  reversed: 'Da huy',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  completed: 'success',
  reversed: 'destructive',
};

export function ReferralStats({
  totalReferrals,
  totalCashbackEarned,
  codeUsage,
  recentReferrals,
  className,
}: ReferralStatsProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-3xl font-bold text-accent">{totalReferrals}</p>
          <p className="mt-1 text-xs text-muted/60">Tong so luot gioi thieu</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-3xl font-bold text-accent-warm">
            {formatVnd(totalCashbackEarned)}
          </p>
          <p className="mt-1 text-xs text-muted/60">Tong cashback nhan duoc</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-3xl font-bold text-accent">{codeUsage}</p>
          <p className="mt-1 text-xs text-muted/60">Ma da dung</p>
        </Card>
      </div>

      {/* Recent Referrals Table */}
      <div>
        <h3 className="mb-3 font-display text-base font-bold">Lich su gioi thieu</h3>
        {recentReferrals.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted/60">Chua co luot gioi thieu nao</p>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/10 text-left text-xs uppercase tracking-wider text-muted/60">
                  <th className="px-4 py-3 font-semibold">Ban be</th>
                  <th className="px-4 py-3 font-semibold">Trang thai</th>
                  <th className="px-4 py-3 font-semibold">Thuong</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Ngay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {recentReferrals.map((ref) => (
                  <tr key={ref.id} className="transition-colors hover:bg-muted/5">
                    <td className="px-4 py-3 font-medium">{ref.referredName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[ref.status] ?? 'default'}>
                        {STATUS_LABELS[ref.status] ?? ref.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-accent-warm">
                      {ref.cashbackAwarded > 0 ? formatVnd(ref.cashbackAwarded) : '-'}
                    </td>
                    <td className="hidden px-4 py-3 text-muted/60 sm:table-cell">
                      {ref.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
