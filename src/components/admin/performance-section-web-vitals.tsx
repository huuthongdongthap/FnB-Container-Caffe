import { Card } from '@/components/ui/card';
import { usePerformanceStore } from '@/hooks/stores/admin/use-performance-store';
import type { WebVitalCardProps } from './performance-section-types';
import { VITAL_DISPLAY_NAMES, VITAL_TARGETS } from './performance-section-constants';
import { ErrorCard, EmptyCard, WebVitalsSkeleton } from './performance-section-shared';

export function WebVitalsSection() {
  const webVitals = usePerformanceStore((s) => s.webVitals);
  const loading = usePerformanceStore((s) => s.vitalsLoading);
  const error = usePerformanceStore((s) => s.vitalsError);
  const retry = usePerformanceStore((s) => s.fetchWebVitals);

  if (loading && !webVitals) return <WebVitalsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={retry} />;

  const entries = webVitals?.vitals ? Object.entries(webVitals.vitals) : [];
  if (entries.length === 0) return <EmptyCard title="Web Vitals" />;

  const targets = webVitals?.targets ?? {};

  return (
    <Card className="p-4">
      <h3 className="text-sm font-display font-semibold mb-4">Web Vitals</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map(([name, data]) => (
          <WebVitalCard
            key={name}
            name={name}
            displayName={VITAL_DISPLAY_NAMES[name] ?? name}
            data={data}
            target={VITAL_TARGETS[name]}
            targetThreshold={targets[name]}
          />
        ))}
      </div>
    </Card>
  );
}

function WebVitalCard({ name, displayName, data, target }: WebVitalCardProps) {
  const total = data.good + data.needsImprovement + data.poor;
  const goodPct = total > 0 ? (data.good / total) * 100 : 0;
  const niPct = total > 0 ? (data.needsImprovement / total) * 100 : 0;
  const poorPct = total > 0 ? (data.poor / total) * 100 : 0;

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold font-mono uppercase text-foreground">
          {name}
        </span>
        <span className="text-[11px] text-muted">{displayName}</span>
      </div>

      {/* Rating distribution bar */}
      <div className="h-4 bg-muted/20 rounded-full overflow-hidden flex">
        {data.good > 0 && (
          <div
            className="h-full bg-green-500/60 transition-all duration-300"
            style={{ width: `${goodPct}%` }}
            title={`Good: ${data.good} (${goodPct.toFixed(0)}%)`}
          />
        )}
        {data.needsImprovement > 0 && (
          <div
            className="h-full bg-yellow-500/60 transition-all duration-300"
            style={{ width: `${niPct}%` }}
            title={`Needs Improvement: ${data.needsImprovement} (${niPct.toFixed(0)}%)`}
          />
        )}
        {data.poor > 0 && (
          <div
            className="h-full bg-red-500/60 transition-all duration-300"
            style={{ width: `${poorPct}%` }}
            title={`Poor: ${data.poor} (${poorPct.toFixed(0)}%)`}
          />
        )}
      </div>

      {/* Legend + target */}
      <div className="flex items-center justify-between text-[11px] text-muted">
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500/60 inline-block" />
            {data.good}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500/60 inline-block" />
            {data.needsImprovement}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500/60 inline-block" />
            {data.poor}
          </span>
        </div>
        {target && (
          <span className="text-[10px]">
            Target: {target.good} | Poor: {target.poor}
          </span>
        )}
      </div>
    </div>
  );
}
