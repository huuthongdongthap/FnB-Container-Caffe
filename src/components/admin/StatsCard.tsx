import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  type: 'revenue' | 'count';
  icon?: ReactNode;
  className?: string;
  change?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({ title, value, type, icon, className, change }: StatsCardProps) {
  const formattedValue = type === 'revenue'
    ? `${value.toLocaleString('vi-VN')}₫`
    : value.toLocaleString('vi-VN');

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold font-display text-foreground">
            {formattedValue}
          </p>
          {change && (
            <p
              className={cn(
                'text-xs mt-1 font-medium',
                change.isPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change.isPositive ? '▲' : '▼'} {change.value.toLocaleString('vi-VN')}%
            </p>
          )}
        </div>
        {icon && (
          <div className="opacity-70">{icon}</div>
        )}
      </div>
    </Card>
  );
}
