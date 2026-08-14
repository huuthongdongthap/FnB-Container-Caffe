import { useTranslation } from 'react-i18next';
import type { LoyaltyTierBenefit } from './stitch-loyalty-types';

export function TierBenefits({ benefits }: { benefits: LoyaltyTierBenefit[] }) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl p-[24px]"
      aria-label={t('loyalty.tierBenefitsAria')}
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <h3
        className="text-[12px] leading-none uppercase tracking-[0.2em] font-semibold mb-[24px]"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
      >
        {t('loyalty.tierBenefits')}
      </h3>
      <ul className="space-y-[12px]">
        {benefits.map((benefit) => (
          <li key={benefit.label} className="flex items-center gap-[12px] group">
            <span className="w-1.5 h-1.5 bg-[var(--aura-chrome-bright)] rounded-full group-hover:scale-150 transition-transform" />
            <span
              className="text-[16px] leading-[1.5] font-normal"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-bright)' }}
            >
              {benefit.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
