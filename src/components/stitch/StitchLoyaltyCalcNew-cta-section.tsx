interface CtaSectionProps {
  pointsPerDollar: number;
}

export function CtaSection({ pointsPerDollar }: CtaSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="w-full bg-[var(--aura-bronze-shimmer)] py-4 font-[family-name:var(--aura-body-font)] text-sm uppercase tracking-wider text-[var(--aura-surface-dim)] shadow-lg shadow-[var(--aura-bronze-shimmer)]/20 transition-all duration-200 active:scale-95"
      >
        Quick Order
      </button>
      <p className="text-center font-[family-name:var(--aura-body-font)] text-xs italic text-[var(--aura-bronze-shimmer)] opacity-40">
        Earn {pointsPerDollar} pts for every $1 spent on your next visit.
      </p>
    </div>
  );
}
