import { Coffee } from 'lucide-react';
import type { BenefitReward } from './StitchLoyaltyCalcNew-types';

const iconMap: Record<string, React.ReactNode> = {
  coffee: <Coffee size={20} className="text-[var(--aura-bronze-shimmer)]/60" />,
  seat: <span className="material-symbols-outlined text-[var(--aura-bronze-shimmer)]/60">event_seat</span>,
  truck: <span className="material-symbols-outlined text-[var(--aura-bronze-shimmer)]/60">local_shipping</span>,
};

interface BenefitsPreviewProps {
  benefits: BenefitReward[];
}

export function BenefitsPreview({ benefits }: BenefitsPreviewProps) {
  return (
    <section className="mb-12">
      <h3 className="mb-6 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-bronze-shimmer)]">
        Upcoming Rewards
      </h3>
      <div className="flex flex-col border-t border-[var(--aura-surface-container)]">
        {benefits.map((benefit, idx) => (
          <div
            key={benefit.id}
            className={`flex items-center justify-between border-b border-[var(--aura-surface-container)] py-6 ${
              idx === 0 ? 'group' : ''
            }`}
          >
            <div className="flex items-center gap-6">
              <div className="flex h-10 w-10 items-center justify-center border border-[var(--aura-surface-container)] bg-[var(--aura-surface-container)]">
                {iconMap[benefit.icon] || <Coffee size={20} className="text-[var(--aura-bronze-shimmer)]/60" />}
              </div>
              <div>
                <p className="font-[family-name:var(--aura-body-font)] text-sm uppercase text-[var(--aura-chrome-bright)]">
                  {benefit.title}
                </p>
                <p className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)] opacity-60">
                  {benefit.description}
                </p>
              </div>
            </div>
            <span
              className="material-symbols-outlined text-[var(--aura-bronze-shimmer)] opacity-20"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lock
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
