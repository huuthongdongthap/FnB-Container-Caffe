import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CheckinTrackerProps {
  streak: number;
  maxStreak?: number;
  todayChecked: boolean;
  onCheckin?: () => void;
  className?: string;
}

export function CheckinTracker({
  streak,
  maxStreak = 7,
  todayChecked,
  onCheckin,
  className,
}: CheckinTrackerProps) {
  const days = Array.from({ length: maxStreak }, (_, i) => i + 1);

  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Check-in hang ngay</h3>
          <p className="text-xs text-muted/60">
            Diem danh moi ngay de nhan thuong
          </p>
        </div>
        <Badge variant="info">
          <span className="text-lg font-bold">{streak}</span>
          <span className="ml-1 text-xs">ngay</span>
        </Badge>
      </div>

      <div className="mb-4 flex gap-1.5">
        {days.map((day) => {
          const isCheckedIn = day <= streak;
          const isToday = day === streak + 1 && !todayChecked;

          return (
            <div
              key={day}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all',
                isCheckedIn && 'bg-accent text-background',
                isToday && 'border-2 border-accent text-accent',
                !isCheckedIn && !isToday && 'border border-border/40 text-muted/40',
              )}
            >
              {isCheckedIn ? <Check size={14} className='inline text-green-500' /> : day}
            </div>
          );
        })}
      </div>

      {!todayChecked && (
        <button
          type="button"
          onClick={onCheckin}
          className="w-full rounded-lg bg-accent py-2 text-center text-sm font-semibold text-background transition-all hover:bg-accent/90"
        >
          Check-in ngay (+10 diem)
        </button>
      )}

      {todayChecked && (
        <Badge variant="success" className="block w-full text-center">
          Da check-in hom nay
        </Badge>
      )}
    </Card>
  );
}
