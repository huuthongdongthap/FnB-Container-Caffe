/**
 * Hero earnings card displaying the referral reward amount
 * with glowing background orbs and glassmorphism styling.
 */

import { useTranslation } from 'react-i18next';
import { BODY_FONT, DISPLAY_FONT } from './StitchReferralNew2-constants';

export function HeroEarningsCard({ rewardAmount }: { rewardAmount: number }) {
  const { t } = useTranslation();
  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.heroAria')}
    >
      <div className="relative overflow-hidden rounded-xl bg-[#162a44]/60 p-6 text-center backdrop-blur-xl backdrop-filter md:p-10 md:pb-14"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Background glow orbs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(212, 165, 116, 0.1)' }}
        />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(184, 199, 226, 0.08)' }}
        />

        {/* Tagline */}
        <span
          className={`mb-2 block ${BODY_FONT} text-xs font-semibold uppercase tracking-[0.3em] text-[var(--aura-text-secondary, #a0a8b0)]`}
        >
          {t('stitch.referral.heroTagline')}
        </span>

        {/* Title */}
        <h2
          className={`mb-4 ${DISPLAY_FONT} text-[36px] leading-tight tracking-[-0.02em] text-[#efbd8a] sm:text-[48px] sm:leading-[1.1]`}
        >
          {t('stitch.referral.heroTitle')}
        </h2>

        {/* Reward amount */}
        <div className="relative mt-4 px-8 py-6">
          <span
            className={`${DISPLAY_FONT} text-[72px] leading-none italic tracking-tight text-[#efbd8a] drop-shadow-2xl sm:text-[100px] md:text-[120px]`}
          >
            ${rewardAmount.toFixed(2)}
          </span>
          <p className={`mt-3 ${BODY_FONT} text-xs font-semibold uppercase tracking-[0.2em] text-[var(--aura-text-secondary, #a0a8b0)]`}>
            {t('stitch.referral.heroPerReferral')}
          </p>
        </div>

        {/* Description */}
        <p className={`mx-auto mt-6 max-w-xl ${BODY_FONT} text-base leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] md:text-lg`}>
          {t('stitch.referral.heroDescription')}
        </p>
      </div>
    </section>
  );
}
