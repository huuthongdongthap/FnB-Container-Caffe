import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PointsHistoryEntry {
  id: string;
  date: string;
  reason: string;
  points: number;
  balance: number;
}

interface PointsHistoryProps {
  entries: PointsHistoryEntry[];
  className?: string;
}

export function PointsHistory({ entries, className }: PointsHistoryProps) {
  if (entries.length === 0) {
    return (
      <Card className={cn('p-6 text-center', className)}>
        <p className="text-sm text-muted/60">Chua co lich su tich diem</p>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-display text-lg font-bold">Lich su tich diem</h3>
      <div className="divide-y divide-border/30 overflow-hidden rounded-xl border border-border/30">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-xs font-semibold',
                  entry.points > 0 ? 'text-green-500' : 'text-red-400',
                )}
              >
                {entry.points > 0 ? '+' : ''}
                {entry.points}
              </span>
              <div>
                <p className="text-xs text-muted/60">{entry.reason}</p>
                <p className="text-[10px] text-muted/40">{entry.date}</p>
              </div>
            </div>
            <Badge variant="default" className="text-[10px]">
              So du: {entry.balance}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
