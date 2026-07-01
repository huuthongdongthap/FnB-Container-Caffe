import { ShoppingCart, Banknote, CheckCircle, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMetricsStore } from '@/hooks/stores/admin/use-metrics-store';

/* ═══════════════════════════════════════════════════════════════════
   MetricCards — 4-card grid: Orders, Revenue, Success Rate, Latency.
   Shows skeleton placeholders while loading.
   ═══════════════════════════════════════════════════════════════════ */

export function MetricCards() {
  const data = useMetricsStore((s) => s.data);
  const loading = useMetricsStore((s) => s.loading);

  if (loading && !data) return <MetricCardsSkeleton />;

  const orders = data?.orders?.total ?? 0;
  const revenue = data?.revenue?.total ?? 0;
  const errorCount = data?.errors?.total ?? 0;
  const totalReqs = data?.requests?.total ?? 0;
  const successRate = totalReqs > 0
    ? `${Math.max(0, ((1 - errorCount / totalReqs) * 100)).toFixed(1)}%`
    : 'N/A';
  const p50 = data?.latency?.p50 ?? 0;
  const p95 = data?.latency?.p95 ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Orders" value={orders.toLocaleString('vi-VN')} icon={<ShoppingCart className="w-5 h-5" />} />
      <MetricCard label="Revenue" value={`${(revenue / 1000).toFixed(0)}K VND`} icon={<Banknote className="w-5 h-5" />} />
      <MetricCard label="Success Rate" value={`${successRate}%`} icon={<CheckCircle className="w-5 h-5" />} />
      <MetricCard label="Latency" value={`p50: ${Math.round(p50)}ms / p95: ${Math.round(p95)}ms`} icon={<Zap className="w-5 h-5" />} />
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">{label}</p>
          <p className="text-xl font-bold font-display text-foreground">{value}</p>
        </div>
        <div className="text-muted/60">{icon}</div>
      </div>
    </Card>
  );
}

function MetricCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-7 w-28" />
        </Card>
      ))}
    </div>
  );
}
