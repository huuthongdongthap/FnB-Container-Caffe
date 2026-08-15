import { Card } from '@/components/ui/card';
import { usePerformanceStore } from '@/hooks/stores/admin/use-performance-store';
import type { PercentileCardProps } from './performance-section-types';
import { ErrorCard, EmptyCard, LatencySkeleton } from './performance-section-shared';

export function APILatencySection() {
  const apiLatency = usePerformanceStore((s) => s.apiLatency);
  const loading = usePerformanceStore((s) => s.latencyLoading);
  const error = usePerformanceStore((s) => s.latencyError);
  const retry = usePerformanceStore((s) => s.fetchAPILatency);

  if (loading && !apiLatency) return <LatencySkeleton />;
  if (error) return <ErrorCard message={error} onRetry={retry} />;
  if (!apiLatency) return <EmptyCard title="API Latency" />;

  const maxCount = Math.max(1, ...(apiLatency.requestCounts ?? []).map((d) => d.count));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-display font-semibold mb-4">API Latency</h3>

      {/* Percentile cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <PercentileCard label="P50" value={apiLatency?.p50} />
        <PercentileCard label="P95" value={apiLatency?.p95} />
        <PercentileCard label="P99" value={apiLatency?.p99} />
      </div>

      {/* Request count per day */}
      <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        Requests per Day
      </h4>
      {!apiLatency?.requestCounts || apiLatency.requestCounts.length === 0 ? (
        <p className="text-sm text-muted">No daily data available</p>
      ) : (
        <div className="space-y-1.5">
          {apiLatency.requestCounts.map((d) => (
            <div key={d.date} className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-muted w-20 shrink-0">{d.date}</span>
              <div className="flex-1 h-4 bg-muted/20 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-blue-500/40 rounded-sm transition-all duration-300"
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted w-14 text-right">
                {d.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PercentileCard({ label, value }: PercentileCardProps) {
  return (
    <div className="border border-border rounded-lg p-3 text-center">
      <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold font-display text-foreground">
        {value !== undefined ? Math.round(value) : '—'}
        <span className="text-xs font-normal text-muted ml-0.5">ms</span>
      </p>
    </div>
  );
}
