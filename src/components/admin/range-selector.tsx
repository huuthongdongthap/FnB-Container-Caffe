import { cn } from '@/lib/cn';
import { useMetricsStore, type MetricsRange } from '@/hooks/stores/admin/use-metrics-store';

/* ═══════════════════════════════════════════════════════════════════
   RangeSelector — 24h / 7d / 30d tab bar for metrics dashboard.
   ═══════════════════════════════════════════════════════════════════ */

const RANGES: { key: MetricsRange; label: string }[] = [
  { key: '24h', label: '24 Hours' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
];

export function RangeSelector() {
  const range = useMetricsStore((s) => s.range);
  const setRange = useMetricsStore((s) => s.setRange);

  return (
    <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit" role="tablist">
      {RANGES.map((r) => (
        <button
          key={r.key}
          role="tab"
          aria-selected={range === r.key}
          onClick={() => setRange(r.key)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            range === r.key
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted hover:text-foreground',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
