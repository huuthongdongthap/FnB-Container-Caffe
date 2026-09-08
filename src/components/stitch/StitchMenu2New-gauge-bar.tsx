import { GaugeBarProps } from './StitchMenu2New-types';

export function GaugeBar({ label, value, max = 10 }: GaugeBarProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="mb-6">
      <div className="mb-2 flex justify-between font-body text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-text-muted,#8e9097)]">
        <span>{label}</span>
        <span aria-label={`${label}: ${value} out of ${max}`}>
          {value}/{max}
        </span>
      </div>
      <div
        className="h-0.5 w-full bg-[color-mix(in srgb,var(--aura-chrome-bright,rgba(229,228,226,1)) 10%,transparent)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${value}/${max}`}
      >
        <div
          className="h-0.5 bg-[var(--aura-chrome-mid,#CD7F32)] shadow-[0_0_8px_var(--aura-chrome-mid,#CD7F32)] transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
