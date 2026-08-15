import { Check } from 'lucide-react';
import type { SubscriptionTier } from './StitchSubscriptionsNew-constants';

interface PricingCardProps {
  tier: SubscriptionTier;
  onSelectPlan?: (tierId: string) => void;
}

export function StitchSubscriptionsNewPricingCard({ tier, onSelectPlan }: Readonly<PricingCardProps>) {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
        tier.highlighted
          ? 'bg-[var(--aura-surface-container)] shadow-2xl md:-translate-y-4'
          : 'bg-[var(--aura-surface-container)] transition-all duration-300 hover:bg-[var(--aura-surface-container-high)]'
      }`}
      style={
        tier.highlighted
          ? {
              border: '1px solid var(--aura-bronze-shimmer)',
              boxShadow: '0 0 15px rgba(212, 165, 116, 0.1)',
            }
          : {
              border: '1px solid rgba(198, 198, 199, 0.2)',
            }
      }
    >
      {tier.badge && (
        <div className="absolute right-0 top-0 p-4">
          <span className="bg-[var(--aura-bronze-shimmer)] px-3 py-1 font-[family-name:var(--aura-body-font)] text-[10px] tracking-widest text-[var(--aura-surface-dim)]">
            {tier.badge}
          </span>
        </div>
      )}
      <div className="mb-12 p-8">
        <h3
          className={`mb-2 font-[family-name:var(--aura-display-font)] text-3xl ${
            tier.highlighted ? 'text-[var(--aura-bronze-shimmer)]' : 'text-[var(--aura-bronze-shimmer)]'
          }`}
        >
          {tier.name}
        </h3>
        <div className="mb-6 flex items-baseline gap-1">
          <span
            className={`font-[family-name:var(--aura-display-font)] text-5xl ${
              tier.highlighted
                ? 'text-[var(--aura-bronze-shimmer)]'
                : 'text-[var(--aura-chrome-bright)]'
            }`}
          >
            ${tier.price}
          </span>
          <span
            className={`font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] ${
              tier.highlighted
                ? 'text-[var(--aura-bronze-shimmer)]/70'
                : 'text-[var(--aura-bronze-shimmer)]'
            }`}
          >
            / {tier.period}
          </span>
        </div>
        <div
          className="mb-8"
          style={{
            height: '1px',
            width: '100%',
            background:
              'linear-gradient(90deg, transparent 0%, var(--aura-chrome-bright) 50%, transparent 100%)',
            opacity: 0.2,
          }}
        />
        <ul className="space-y-4">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <Check
                className="text-[var(--aura-bronze-shimmer)]"
                size={16}
                style={{ fontVariationSettings: "'FILL' 1" }}
              />
              <span
                className={`font-[family-name:var(--aura-body-font)] text-base ${
                  tier.highlighted
                    ? 'text-[var(--aura-chrome-bright)]'
                    : 'text-[var(--aura-bronze-shimmer)]'
                }`}
              >
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => onSelectPlan?.(tier.id)}
        className={`w-full py-4 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] transition-all active:scale-[0.98] ${
          tier.highlighted
            ? 'bg-[var(--aura-bronze-shimmer)] font-bold text-[var(--aura-surface-dim)] hover:brightness-110'
            : 'border border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] hover:bg-[var(--aura-chrome-bright)] hover:text-[var(--aura-surface-dim)]'
        }`}
      >
        SELECT PLAN
      </button>
    </div>
  );
}
