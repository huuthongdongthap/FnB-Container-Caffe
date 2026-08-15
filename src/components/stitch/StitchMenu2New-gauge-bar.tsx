import { GaugeBarProps } from './StitchMenu2New-types';

export function GaugeBar({ label, value, max = 10 }: GaugeBarProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="mb-6">
      <div className="mb-2 flex justify-between font-body text-[10px] font-semibold uppercase tracking-widest text-[#8e9097]">
        <span>{label}</span>
        <span aria-label={`${label}: ${value} out of ${max}`}>
          {value}/{max}
        </span>
      </div>
      <div
        className="h-0.5 w-full bg-[rgba(229,228,226,0.1)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${value}/${max}`}
      >
        <div
          className="h-0.5 bg-[#CD7F32] shadow-[0_0_8px_#CD7F32] transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
