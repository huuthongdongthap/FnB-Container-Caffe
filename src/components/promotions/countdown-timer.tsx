import { useState, useEffect } from 'react';
import { cn, Badge } from '@/components/ui';

interface CountdownTimerProps {
  targetDate: string;
  onExpire?: () => void;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcTimeLeft(target: Date): TimeLeft {
  const total = target.getTime() - Date.now();
  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

export function CountdownTimer({
  targetDate,
  onExpire,
  className,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calcTimeLeft(new Date(targetDate)),
  );

  useEffect(() => {
    const target = new Date(targetDate);

    const timer = setInterval(() => {
      const next = calcTimeLeft(target);
      setTimeLeft(next);

      if (next.total <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onExpire]);

  if (timeLeft.total <= 0) {
    return (
      <Badge variant="destructive" className={cn('animate-pulse', className)}>
        Het han
      </Badge>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted/60">
        Con lai
      </span>
      <div className="flex gap-0.5 font-display text-sm font-bold tabular-nums text-accent">
        {timeLeft.days > 0 && (
          <>
            <span>{timeLeft.days}d</span>
            <span className="mx-0.5">:</span>
          </>
        )}
        <span>{pad(timeLeft.hours)}</span>
        <span className="mx-0.5">:</span>
        <span>{pad(timeLeft.minutes)}</span>
        <span className="mx-0.5">:</span>
        <span>{pad(timeLeft.seconds)}</span>
      </div>
    </div>
  );
}
