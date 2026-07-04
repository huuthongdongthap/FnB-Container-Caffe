import { useTranslation } from 'react-i18next';
import { cn, Card, Badge } from '@/components/ui';
import { REFERRAL_CASHBACK_VND } from '@/hooks/use-referral';

interface CashbackDisplayProps {
  earnedAmount: number;
  totalReferrals: number;
  className?: string;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

export function CashbackDisplay({
  earnedAmount,
  totalReferrals,
  className,
}: CashbackDisplayProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Cashback Card */}
      <Card className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-accent/5" />

        <div className="relative">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted/60">
            {t('referral.cashbackReceived')}
          </p>
          <p className="font-display text-4xl font-bold text-accent-warm">
            {formatVnd(earnedAmount)}
          </p>
          <p className="mt-1 text-xs text-muted/40">
            {t('referral.fromReferrals', { count: totalReferrals })}
          </p>
        </div>

        {totalReferrals > 0 && (
          <div className="mt-4 rounded-lg bg-muted/10 p-3">
            <p className="text-xs text-muted/60">
              {t('referral.average')}: <strong>{formatVnd(Math.round(earnedAmount / totalReferrals))}</strong> / {t('referral.fromReferrals', { count: 0 }).split(' ')[1]}
            </p>
          </div>
        )}
      </Card>

      {/* Per-Referral Rate */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted/60">
              {t('referral.perReferral')}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-accent">
              {formatVnd(REFERRAL_CASHBACK_VND)}
            </p>
          </div>
          <Badge variant="success" className="text-xs">
            {t('referral.unlimited')}
          </Badge>
        </div>
        <p className="mt-3 text-[11px] text-muted/40">
          {t('referral.friendRequirement')}
        </p>
      </Card>
    </div>
  );
}
