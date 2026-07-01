import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TierProgressProps {
  currentTier: string;
  nextTier: string | null;
  currentSpent: number;
  nextTierThreshold: number | null;
  className?: string;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

export function TierProgress({
  currentTier,
  nextTier,
  currentSpent,
  nextTierThreshold,
  className,
}: TierProgressProps) {
  const isMaxTier = nextTier === null || nextTierThreshold === null;
  const progress = nextTierThreshold && nextTierThreshold > 0
    ? Math.min(100, Math.round((currentSpent / nextTierThreshold) * 100))
    : isMaxTier ? 100 : 0;
  const remaining = nextTierThreshold ? Math.max(0, nextTierThreshold - currentSpent) : 0;

  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted/60">Hang hien tai</p>
          <p className="font-display text-xl font-bold">{currentTier}</p>
        </div>
        {nextTier && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted/60">Hang tiep theo</p>
            <p className="font-display text-xl font-bold text-accent">{nextTier}</p>
          </div>
        )}
      </div>

      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted/60">
          {isMaxTier ? 'Toi da' : `${progress}%`}
        </span>
        {!isMaxTier && (
          <span className="text-accent">
            Con {formatVnd(remaining)}
          </span>
        )}
      </div>

      <div
        className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-muted/20"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-warm transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted/60">
        <span>Da chi: {formatVnd(currentSpent)}</span>
        {!isMaxTier && <span>Nguong: {formatVnd(nextTierThreshold)}</span>}
      </div>

      {!isMaxTier && (
        <Button variant="primary" size="sm" className="mt-4 w-full">
          Len hang
        </Button>
      )}

      {isMaxTier && (
        <Badge variant="warning" className="mt-4 block w-full text-center">
          Hang cao nhat
        </Badge>
      )}
    </Card>
  );
}
