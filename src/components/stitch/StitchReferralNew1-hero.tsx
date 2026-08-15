'use client';

import { useTranslation } from 'react-i18next';

export function HeroEarningsCard({ rewardAmount }: { rewardAmount: number }) {
  const { t } = useTranslation();
  return (
    <section className="mt-2 mb-10" aria-label={t('stitch.referral.heroAria')}>
      <div className="relative overflow-hidden rounded-xl p-6 flex flex-col items-center text-center"
        style={{
          background: 'color-mix(in srgb, var(--aura-surface-container) 40%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent)' }}
        />
        <span className="font-body text-[14px] leading-[1.2] font-semibold uppercase tracking-[0.2em] text-[var(--aura-chrome-soft)] mb-1">
          {t('stitch.referral.heroTagline', { defaultValue: 'Refer & Earn' })}
        </span>
        <h1 className="font-display text-[48px] leading-[1.1] tracking-[-0.02em] font-medium text-[var(--aura-chrome-bright)] mb-1">
          {t('stitch.referral.heroAmount', { defaultValue: `Receive $${rewardAmount.toFixed(2)}`, amount: rewardAmount.toFixed(2) })}
        </h1>
        <p className="font-body text-base leading-[1.5] text-[var(--aura-chrome-soft)] max-w-[280px]">
          {t('stitch.referral.heroDescription', { defaultValue: 'Share the Aura experience with your inner circle and earn rewards for every successful invitation.' })}
        </p>
        <div className="mt-6 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </section>
  );
}
