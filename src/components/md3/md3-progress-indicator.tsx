import { cn } from '@/lib/cn';

/* ───────────────────────────────────────────────────────────────
   MD3LinearProgress / MD3CircularProgress
   Determinate (value) or indeterminate CSS animations, no deps
   ─────────────────────────────────────────────────────────────── */

export interface MD3LinearProgressProps {
  value?: number;
  buffer?: number;
  className?: string;
}

export function MD3LinearProgress({ value, buffer, className }: MD3LinearProgressProps) {
  const determinate = typeof value === 'number';
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const bufferPct = Math.min(100, Math.max(0, buffer ?? 0));

  return (
    <div
      role="progressbar"
      aria-valuenow={determinate ? pct : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-1 w-full overflow-hidden bg-md-surface-container-highest rounded-md-full', className)}
    >
      {buffer !== undefined && (
        <div
          className="absolute inset-y-0 left-0 bg-md-on-surface/20 transition-[width]"
          style={{ width: `${bufferPct}%` }}
        />
      )}
      {determinate ? (
        <div
          className="absolute inset-y-0 left-0 bg-md-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div className="absolute inset-0">
          {/* indeterminate shimmer slide */}
          <div
            className="absolute inset-y-0 w-1/3 bg-md-primary"
            style={{
              animation: 'md3-linear-slide 1.2s ease-in-out infinite',
              borderRadius: 'inherit',
            }}
          />
        </div>
      )}
    </div>
  );
}

export interface MD3CircularProgressProps {
  value?: number;
  size?: number;
  className?: string;
}

export function MD3CircularProgress({ value, size = 48, className }: MD3CircularProgressProps) {
  const determinate = typeof value === 'number';
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-valuenow={determinate ? pct : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('text-md-primary', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn(!determinate && 'origin-center')}
        style={!determinate ? { animation: 'md3-circular-rotate 1.4s linear infinite' } : undefined}
        aria-hidden="true"
      >
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-md-surface-container-highest"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="stroke-md-primary"
          style={
            determinate
              ? { strokeDasharray: circumference, strokeDashoffset: dashOffset, transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.3s ease' }
              : { strokeDasharray: `${circumference * 0.25} ${circumference}` }
          }
        />
      </svg>
    </div>
  );
}
