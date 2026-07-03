import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

interface TopProduct {
  product_name: string;
  total_qty: number;
  revenue: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/* ─── Loading skeleton ─── */

function TopProductsSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="h-4 w-40 bg-[var(--aura-noir-bright)] rounded animate-shimmer mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-5 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <div className="h-3 w-32 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
                <div className="h-3 w-20 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
              </div>
              <div className="h-2 w-full bg-[var(--aura-noir-bright)] rounded-full animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Error state ─── */

function TopProductsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-4">
        San pham ban chay
      </h3>
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <svg className="w-8 h-8 text-[var(--aura-danger)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-xs text-[var(--aura-text-body)] mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full
              border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)]
              hover:bg-[rgba(201,214,223,0.08)] transition-all duration-300"
          >
            Thu lai
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Empty state ─── */

function TopProductsEmpty() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-4">
        San pham ban chay
      </h3>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-8 h-8 text-[var(--aura-text-muted)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        <p className="text-sm text-[var(--aura-text-muted)]">Chua co du lieu san pham</p>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function TopProductsChart({ data, loading, error, onRetry, className }: TopProductsChartProps) {
  if (loading && data.length === 0) return <TopProductsSkeleton />;
  if (error) return <TopProductsError message={error} onRetry={onRetry} />;
  if (data.length === 0) return <TopProductsEmpty />;

  const maxQty = Math.max(...data.map((d) => d.total_qty), 1);

  return (
    <div className={cn(
      'rounded-xl border border-[var(--glass-border)]',
      'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
      'p-5',
      className,
    )}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-4">
        San pham ban chay
      </h3>

      <div className="space-y-3">
        {data.map((product, idx) => {
          const barWidth = (product.total_qty / maxQty) * 100;
          return (
            <div key={idx} className="group flex items-center gap-3">
              {/* Rank */}
              <span className="text-[11px] font-mono text-[var(--aura-text-muted)] w-5 text-right shrink-0">
                {idx + 1}
              </span>

              {/* Bar + labels */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-[var(--aura-text-primary)] truncate font-medium">
                    {product.product_name}
                  </span>
                  <span className="text-[11px] text-[var(--aura-text-muted)] ml-2 whitespace-nowrap shrink-0">
                    {product.total_qty} cai &middot; {formatVnd(product.revenue)}
                  </span>
                </div>
                <div className="h-2 bg-[rgba(201,214,223,0.06)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${barWidth}%`,
                      background: 'linear-gradient(90deg, var(--aura-chrome-dark), var(--aura-chrome-light))',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
