import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BirthdayRewardProps {
  hasBirthday: boolean;
  bonusPercent: number;
  expiryDays?: number;
  className?: string;
}

export function BirthdayReward({
  hasBirthday,
  bonusPercent,
  expiryDays = 14,
  className,
}: BirthdayRewardProps) {
  if (!hasBirthday) {
    return (
      <Card className={cn('p-5 text-center', className)}>
        <span className="mb-2 block text-3xl" aria-hidden="true">
          &#127874;
        </span>
        <h3 className="font-display text-base font-bold">Uu dai sinh nhat</h3>
        <p className="mt-1 text-xs text-muted/60">
          Cap nhat ngay sinh de nhan uu dai dac biet vao thang sinh nhat cua ban!
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn('relative overflow-hidden border-2 border-amber-400/40 p-5', className)}>
      <div className="absolute right-2 top-2">
        <Badge variant="warning">Con {expiryDays} ngay</Badge>
      </div>
      <span className="mb-2 block text-4xl" aria-hidden="true">
        &#127874;
      </span>
      <h3 className="font-display text-lg font-bold">Chuc mung sinh nhat!</h3>
      <p className="mt-1 text-sm text-muted/80">
        Ban duoc giam <strong>{bonusPercent}%</strong> cho don hang trong thang sinh nhat!
      </p>
      <p className="mt-1 text-xs text-muted/60">
        Ap dung cho tat ca do uong va banh ngot. Hay ghe AURA ngay hom nay!
      </p>
    </Card>
  );
}
