import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

interface DataPoint {
  label: string;
  value: number;
}

interface RevenueChartProps {
  data: DataPoint[];
  period?: 'daily' | 'weekly' | 'monthly';
  className?: string;
}

export function RevenueChart({ data, period = 'daily', className }: RevenueChartProps) {
  const [activePeriod, setActivePeriod] = useState<'daily' | 'weekly' | 'monthly'>(period);

  if (data.length === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Doanh thu</h3>
        <div className="text-center py-8 text-muted/60">
          <span className="text-3xl block mb-2">&#128200;</span>
          <p className="text-sm">Chưa có dữ liệu doanh thu</p>
        </div>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider">Doanh thu</h3>
        <div className="flex gap-1">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                activePeriod === p
                  ? 'bg-accent text-primary'
                  : 'bg-muted/20 text-muted hover:bg-muted/30'
              )}
            >
              {p === 'daily' ? 'Ngày' : p === 'weekly' ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-1 h-40">
        {data.map((point, idx) => {
          const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${point.label}: ${point.value.toLocaleString('vi-VN')}₫`}
            >
              <div
                className="w-full bg-accent rounded-t transition-all duration-300 hover:bg-accent/80 min-h-[2px]"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              <span className="text-[10px] text-muted/60 truncate w-full text-center">
                {point.label.length > 5 ? point.label.slice(0, 5) + '..' : point.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-right text-xs text-muted">
        Tổng: {data.reduce((sum, d) => sum + d.value, 0).toLocaleString('vi-VN')}₫
      </div>
    </Card>
  );
}
