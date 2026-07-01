import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMetricsStore } from '@/hooks/stores/admin/use-metrics-store';

/* ═══════════════════════════════════════════════════════════════════
   RequestChart — horizontal bar chart showing top 10 request paths.
   Zero-dependency CSS bar chart. Matches existing dashboard pattern.
   ═══════════════════════════════════════════════════════════════════ */

export function RequestChart() {
  const data = useMetricsStore((s) => s.data);
  const loading = useMetricsStore((s) => s.loading);

  if (loading && !data) {
    return (
      <Card className="p-4">
        <Skeleton className="h-5 w-40 mb-3" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-4 w-full mb-2" />
        ))}
      </Card>
    );
  }

  const paths = data?.topPaths ?? [];
  const maxCount = Math.max(1, ...paths.map((p) => p.count));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-display font-semibold mb-3">Top Request Paths</h3>
      {paths.length === 0 ? (
        <p className="text-sm text-muted">No data available</p>
      ) : (
        <div className="space-y-2">
          {paths.slice(0, 10).map((p) => (
            <div key={p.path} className="flex items-center gap-3">
              <span
                className="text-xs text-muted truncate min-w-0 flex-1"
                title={p.path}
              >
                {p.path}
              </span>
              <div className="flex-1 h-5 bg-muted/20 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-primary/20 rounded-sm transition-all duration-300"
                  style={{ width: `${(p.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted w-10 text-right">
                {p.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
