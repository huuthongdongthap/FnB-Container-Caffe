import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerformanceStore } from '@/hooks/stores/admin/use-performance-store';

/* ═══════════════════════════════════════════════════════════════════
   PerformanceSection — Web Vitals + API Latency metrics for admin.
   Fetches two independent endpoints on mount. Each subsection has
   its own loading / empty / error state.
   ═══════════════════════════════════════════════════════════════════ */

const VITAL_DISPLAY_NAMES: Record<string, string> = {
  CLS: 'Cumulative Layout Shift',
  FCP: 'First Contentful Paint',
  LCP: 'Largest Contentful Paint',
  INP: 'Interaction to Next Paint',
  TTFB: 'Time to First Byte',
};

const VITAL_TARGETS: Record<string, { good: string; poor: string }> = {
  CLS: { good: '< 0.1', poor: '>= 0.25' },
  FCP: { good: '< 1.8s', poor: '>= 3.0s' },
  LCP: { good: '< 2.5s', poor: '>= 4.0s' },
  INP: { good: '< 200ms', poor: '>= 500ms' },
  TTFB: { good: '< 800ms', poor: '>= 1.8s' },
};

/* ────────────────────────────────────── Main export ─────────────── */

export function PerformanceSection() {
  const fetchWebVitals = usePerformanceStore((s) => s.fetchWebVitals);
  const fetchAPILatency = usePerformanceStore((s) => s.fetchAPILatency);

  useEffect(() => {
    fetchWebVitals();
    fetchAPILatency();
  }, [fetchWebVitals, fetchAPILatency]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold">Performance</h2>
      <WebVitalsSection />
      <APILatencySection />
    </div>
  );
}

/* ────────────────────────────────────── Web Vitals ──────────────── */

function WebVitalsSection() {
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

/* ────────────────────────────── Single vital card ────────────────── */

function WebVitalCard({
  name,
  displayName,
  data,
  target,
}: {
  name: string;
  displayName: string;
  data: { good: number; needsImprovement: number; poor: number };
  target?: { good: string; poor: string };
  targetThreshold?: { good: number; poor: number };
}) {
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

/* ────────────────────────────────────── API Latency ──────────────── */

function APILatencySection() {
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

function PercentileCard({ label, value }: { label: string; value?: number }) {
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

/* ────────────────────────────────────── Shared states ────────────── */

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-red-600">{message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </Card>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-display font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted">No data available for the selected period.</p>
    </Card>
  );
}

function WebVitalsSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-3 space-y-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-full" variant="rectangular" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function LatencySkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-3 text-center space-y-1">
            <Skeleton className="h-3 w-8 mx-auto" />
            <Skeleton className="h-5 w-16 mx-auto" />
          </div>
        ))}
      </div>
      <Skeleton className="h-3 w-28 mb-2" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full mb-1.5" />
      ))}
    </Card>
  );
}
