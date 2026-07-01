import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPoints } from '@/lib/format';

interface TierProjectionProps {
  rank: string;
  cashbackRate: number;
  monthlyPoints: number;
  annualPoints: number;
  className?: string;
}

export function TierProjection({
  rank,
  cashbackRate,
  monthlyPoints,
  annualPoints,
  className,
}: TierProjectionProps) {
  return (
    <div className={className}>
      {/* Projected Tier */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted/60">
              Hang du kien
            </p>
            <p className="font-display text-3xl font-bold">
              {rank}
            </p>
          </div>
          <Badge variant="info" className="text-sm">
            {cashbackRate}% cashback
          </Badge>
        </div>
      </Card>

      {/* Points Projection */}
      <Card className="p-6">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted/60">
          Diem tich luy uoc tinh
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-accent">
              {formatPoints(monthlyPoints)}
            </p>
            <p className="text-xs text-muted/60">diem / thang</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-accent">
              {formatPoints(annualPoints)}
            </p>
            <p className="text-xs text-muted/60">diem / nam</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
