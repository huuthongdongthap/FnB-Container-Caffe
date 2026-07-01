import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TierCardProps {
  rank: string;
  tier: string;
  minPoints: number;
  cashbackRate: number;
  pointsMultiplier: number;
  benefits: string[];
  isCurrent: boolean;
  pointsToNext?: number;
  currentPoints?: number;
}

const TIER_ICONS: Record<string, string> = {
  bronze: '\u{1F305}',
  silver: '\u{1F306}',
  gold: '\u{1F3C6}',
  platinum: '\u{1F48E}',
};

export function TierCard({
  rank,
  tier,
  minPoints,
  cashbackRate,
  pointsMultiplier,
  benefits,
  isCurrent,
  pointsToNext,
  currentPoints,
}: TierCardProps) {
  const isGold = tier === 'gold';

  return (
    <Card
      className={cn(
        'relative flex flex-col items-center rounded-2xl border px-6 pb-7 pt-8 text-center transition-all duration-300 hover:-translate-y-1.5',
        isGold
          ? 'tier-card--featured border-accent/40 shadow-[0_0_30px_rgba(107,159,184,0.1)]'
          : 'border-border/40',
      )}
    >
      {isGold && (
        <Badge
          variant="info"
          className="absolute -top-0 left-1/2 -translate-x-1/2 rounded-t-none rounded-b-md px-4 py-1 text-[10px] font-bold uppercase tracking-wider"
        >
          Pho bien nhat
        </Badge>
      )}

      {isCurrent && (
        <Badge variant="success" className="absolute right-3 top-3 text-[10px] uppercase">
          Hien tai
        </Badge>
      )}

      <span className="mb-3 text-4xl" aria-hidden="true">
        {TIER_ICONS[tier] || '\u{1F305}'}
      </span>

      <h3 className="font-display text-xl font-bold tracking-wider text-foreground">{rank}</h3>

      <p className="mb-4 text-xs text-muted/60">
        {tier === 'bronze' ? 'Thanh vien moi' : `Tu ${minPoints} diem`}
      </p>

      <div className="mb-1 font-display text-4xl font-bold tracking-tight text-foreground">
        {cashbackRate}
        <span className="text-lg text-accent">%</span>
      </div>
      <p className="mb-4 text-[11px] uppercase tracking-wider text-muted/60">Cashback moi don</p>

      <div className="mb-3 text-sm text-accent">x{pointsMultiplier} diem</div>

      <ul className="w-full space-y-0 text-left">
        {benefits.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 border-t border-border/30 px-0 py-1.5 text-xs text-muted/80"
          >
            <span className="mt-0.5 shrink-0 font-bold text-accent">&check;</span>
            {b}
          </li>
        ))}
      </ul>

      {pointsToNext !== undefined && currentPoints !== undefined && (
        <div className="mt-4 w-full rounded-lg bg-muted/10 p-3 text-xs text-muted/60">
          <div className="mb-1 flex justify-between">
            <span>{currentPoints} diem</span>
            <span>Con {pointsToNext} diem</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20"
            role="progressbar"
            aria-valuenow={currentPoints}
            aria-valuemin={0}
            aria-valuemax={currentPoints + pointsToNext}
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{
                width: `${Math.min(100, (currentPoints / (currentPoints + pointsToNext)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
