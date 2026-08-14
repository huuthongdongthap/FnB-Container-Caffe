/**
 * Progress tracker showing referral progress toward next bonus level,
 * including the member tier display.
 */

import { useTranslation } from 'react-i18next';
import { BODY_FONT, DISPLAY_FONT } from './StitchReferralNew2-constants';
import { MedalIcon } from './StitchReferralNew2-icons';

export function ProgressTracker({
  current,
  target,
  percent,
  nextBonusAmount,
  nextBonusLabel,
}: {
  current: number;
  target: number;
  percent: number;
  nextBonusAmount: number;
  nextBonusLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.progressAria')}
    >
      <div className="rounded-xl bg-[#162a44]/60 p-6 backdrop-blur-xl"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Header */}
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className={`${DISPLAY_FONT} text-2xl text-[#efbd8a]`}>
              {t('stitch.referral.progressTitle')}
            </h3>
          </div>
          <div className="text-right">
            <span className={`${DISPLAY_FONT} text-2xl text-[var(--aura-text-secondary, #a0a8b0)]`}>
              {current}/{target}
            </span>
            <p className={`${BODY_FONT} text-xs uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
              {t('stitch.referral.referrals')}
            </p>
          </div>
        </div>

        {/* Next bonus description */}
        <p className={`mb-6 ${BODY_FONT} text-sm text-[var(--aura-text-secondary, #a0a8b0)] opacity-80`}>
          {nextBonusLabel}
        </p>

        {/* Progress bar */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#1e3550]/60">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${percent}%`,
              background: 'linear-gradient(90deg, #D4A574 0%, #FFD700 100%)',
              boxShadow: '0 0 15px rgba(212, 165, 116, 0.5)',
            }}
          />
        </div>

        {/* Level labels */}
        <div className="mt-2 flex justify-between">
          <span className={`${BODY_FONT} text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
            {t('stitch.referral.currentLevel')}
          </span>
          <span className={`${BODY_FONT} text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
            {t('stitch.referral.premiumUnlock')}
          </span>
        </div>

        {/* Member tier section */}
        <div className="mt-6 pt-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-[#162a44]/60 backdrop-blur-xl"
              style={{
                border: '1px solid',
                borderImageSource: 'linear-gradient(135deg, #FFFFFF 0%, #A8B2BD 100%)',
                borderImageSlice: 1,
              }}
            >
              <MedalIcon className="h-5 w-5 text-[#efbd8a]" />
            </div>
            <div>
              <p className={`${BODY_FONT} text-xs font-semibold uppercase tracking-wider text-[var(--aura-text-primary, #e8e8e8)]`}>
                {t('stitch.referral.memberTier')}
              </p>
              <p className={`${BODY_FONT} text-sm text-[var(--aura-text-secondary, #a0a8b0)]`}>
                {t('stitch.referral.totalEarned', { amount: nextBonusAmount.toFixed(2) })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
