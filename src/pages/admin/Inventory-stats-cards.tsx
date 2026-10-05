import { Package, AlertTriangle, AlertOctagon, Coins } from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type { InventoryStats } from './inventory-types';

interface InventoryStatsCardsProps {
  stats: InventoryStats;
  loading?: boolean;
}

export function InventoryStatsCards({ stats, loading }: Readonly<InventoryStatsCardsProps>) {
  const cards = [
    {
      title: 'Tổng mặt hàng',
      value: loading ? '...' : stats.totalItems.toLocaleString(),
      sub: 'Nguyên liệu & vật tư',
      icon: Package,
      color: 'text-[var(--aura-chrome-light)]',
      bg: 'bg-[rgba(201,214,223,0.06)]',
    },
    {
      title: 'Cảnh báo sắp hết',
      value: loading ? '...' : stats.lowStockCount.toLocaleString(),
      sub: 'Dưới mức tồn tối thiểu',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'Đã hết hàng',
      value: loading ? '...' : stats.outOfStockCount.toLocaleString(),
      sub: 'Cần tái đặt hàng ngay',
      icon: AlertOctagon,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
    },
    {
      title: 'Ước tính giá trị kho',
      value: loading ? '...' : formatVnd(stats.totalValue),
      sub: 'Tổng vốn nguyên liệu',
      icon: Coins,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.title}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-4 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-[var(--aura-text-muted)] font-medium">
                {c.title}
              </span>
              <div className={`p-2 rounded-lg ${c.bg} ${c.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className={`text-2xl font-bold font-display ${c.color}`}>{c.value}</div>
              <p className="text-[11px] text-[var(--aura-text-muted)] mt-1">{c.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
