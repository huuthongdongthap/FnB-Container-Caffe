import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string;
  description: string;
}

interface RewardsGridProps {
  rewards: Reward[];
  userPoints: number;
  onRedeem?: (rewardId: string) => void;
  className?: string;
}

export function RewardsGrid({ rewards, userPoints, onRedeem, className }: RewardsGridProps) {
  if (rewards.length === 0) {
    return (
      <Card className={cn('flex flex-col items-center p-8 text-center', className)}>
        <span className="mb-3 text-4xl"><Gift size={36} className="block mx-auto" /></span>
        <h3 className="font-display text-lg font-bold">Chua co qua tang</h3>
        <p className="mt-1 text-sm text-muted/60">Quay lai sau de xem qua tang moi nhe!</p>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Danh muc qua tang</h3>
        <Badge variant="info">
          {userPoints.toLocaleString('vi-VN')} diem
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => {
          const canAfford = userPoints >= reward.cost;

          return (
            <Card
              key={reward.id}
              className={cn(
                'flex flex-col items-center p-5 text-center transition-all duration-200',
                canAfford
                  ? 'hover:-translate-y-1 hover:shadow-lg'
                  : 'opacity-60 grayscale',
              )}
            >
              <span className="mb-2 text-3xl" aria-hidden="true">
                {reward.icon}
              </span>
              <h4 className="font-display text-base font-bold">{reward.name}</h4>
              <p className="mt-1 text-xs text-accent">{reward.cost} diem</p>
              <p className="mt-1 mb-4 text-xs leading-relaxed text-muted/60">
                {reward.description}
              </p>
              <Button
                variant={canAfford ? 'primary' : 'secondary'}
                size="sm"
                disabled={!canAfford}
                onClick={() => onRedeem?.(reward.id)}
              >
                {canAfford ? 'Doi ngay' : 'Thieu diem'}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
