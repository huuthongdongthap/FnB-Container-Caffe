interface TierInfoCardProps {
  pointsToNext: number;
  nextTierIndex: number;
  tierLabels: string[];
}

export function TierInfoCard({ pointsToNext, nextTierIndex, tierLabels }: TierInfoCardProps) {
  return (
    <div
      className="mb-10 border-l-4 p-6"
      style={{
        background: 'var(--aura-surface-container-high)',
        borderLeftColor: 'var(--aura-bronze-shimmer)',
      }}
    >
      <div className="mb-2 flex items-center gap-4">
        <span className="material-symbols-outlined text-[var(--aura-bronze-shimmer)]">
          military_tech
        </span>
        <h4 className="font-[family-name:var(--aura-body-font)] text-sm uppercase tracking-wider text-[var(--aura-bronze-shimmer)]">
          Next Tier
        </h4>
      </div>
      <p className="font-[family-name:var(--aura-body-font)] text-base">
        <span className="font-bold text-[var(--aura-chrome-bright)]">
          {pointsToNext.toLocaleString()} pts
        </span>{' '}
        away from reaching{' '}
        <span className="text-[var(--aura-bronze-shimmer)]">
          {nextTierIndex >= 0 ? tierLabels[nextTierIndex] : 'MAX'}
        </span>{' '}
        status.
      </p>
    </div>
  );
}
