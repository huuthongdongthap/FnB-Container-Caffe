import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Check, Timer } from 'lucide-react';

interface EstimatedTimeProps {
  estimatedAt: string;
  className?: string;
}

export function EstimatedTime({ estimatedAt, className }: EstimatedTimeProps) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState<number>(() => calcRemaining(estimatedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(calcRemaining(estimatedAt));
    }, 60_000);

    return () => clearInterval(interval);
  }, [estimatedAt]);

  if (remaining <= 0) {
    return (
      <span className={cn('text-green-600 font-medium text-sm', className)}>
        <Check size={16} className="inline" /> {t('tracking.badgeDelivered')}
      </span>
    );
  }

  const minutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const displayMinutes = minutes % 60;

  let timeText: string;
  if (hours > 0) {
    timeText = t('tracking.estimatedTimeHours', { hours, minutes: displayMinutes });
  } else {
    timeText = t('tracking.estimatedTimeMinutes', { minutes: displayMinutes });
  }

  return (
    <span className={cn('text-amber-600 font-medium text-sm', className)}>
      <Timer size={16} className="inline" /> {timeText}
    </span>
  );
}

function calcRemaining(estimatedAt: string): number {
  const target = new Date(estimatedAt).getTime();
  const now = Date.now();
  return target - now;
}
