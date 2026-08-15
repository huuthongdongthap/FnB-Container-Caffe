interface TierProgressGaugeProps {
  tierMilestones: number[];
  tierLabels: string[];
  points: number;
  percentage: number;
  currentTierIndex: number;
}

export function TierProgressGauge({
  tierMilestones,
  tierLabels,
  points,
  percentage,
  currentTierIndex,
}: TierProgressGaugeProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between">
        <h3 className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-bronze-shimmer)]">
          Tier Status
        </h3>
        <span className="font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-bright)]">
          {tierLabels[currentTierIndex]}
        </span>
      </div>
      <div
        className="relative mb-2"
        style={{
          height: '2px',
          background: 'var(--aura-surface-container-high)',
        }}
      >
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${percentage}%`,
            background: 'var(--aura-bronze-shimmer)',
          }}
        />
        {tierMilestones.map((milestone, idx) => {
          const pos = (milestone / tierMilestones[tierMilestones.length - 1]!) * 100;
          const isActive = points >= milestone;
          return (
            <div
              key={milestone}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${pos}%`,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isActive ? 'var(--aura-bronze-shimmer)' : 'var(--aura-surface-container)',
                border: isActive
                  ? '1px solid var(--aura-bronze-shimmer)'
                  : '1px solid var(--aura-surface-container-high)',
                boxShadow: isActive ? '0 0 10px rgba(212, 165, 116, 0.4)' : 'none',
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between">
        {tierLabels.map((label, idx) => (
          <span
            key={label}
            className={`font-[family-name:var(--aura-body-font)] text-xs ${
              idx === currentTierIndex
                ? 'text-[var(--aura-chrome-bright)]'
                : 'text-[var(--aura-bronze-shimmer)] opacity-40'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
