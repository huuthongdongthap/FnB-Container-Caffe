/**
 * Loyalty progress section for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import type { LoyaltyDataNew } from './StitchAccountNew-types';

const glassCardStyle = {
  background: 'rgba(30, 41, 59, 0.4)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
} as const;

/* ─── Loyalty Progress Section ────────────────────────────────── */

export function AccountNewLoyaltySection({
  loyalty,
}: {
  loyalty: LoyaltyDataNew;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="rounded-xl p-6"
      style={glassCardStyle}
      aria-label={t('stitch.accountDashboard.loyaltySectionAriaLabel') || 'Loyalty progress'}
    >
      <div className="flex justify-between items-end mb-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-1 text-[var(--aura-text-secondary, #a0a8b0)]">
            {t('stitch.accountDashboard.currentBalance')}
          </p>
          <span
            className="text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-none"
            style={{ fontFamily: "var(--aura-font-display)", color: '#d4a574' }}
          >
            {loyalty.points.toLocaleString()}
            <span className="text-base font-normal text-[var(--aura-text-secondary, #a0a8b0)] ml-1">
              {t('stitch.accountDashboard.pts')}
            </span>
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-1 text-[var(--aura-text-secondary, #a0a8b0)]">
            {t('stitch.accountDashboard.nextTier', { tier: loyalty.nextTier })}
          </p>
          <p className="text-sm text-[#c1c7cf]">
            {loyalty.nextTier}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#1e3550] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${loyalty.progressPercent}%`,
            background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        />
      </div>

      <p className="text-[11px] text-[#7c838a] text-right">
        {loyalty.pointsToNext} {t('stitch.accountDashboard.pts')} until {loyalty.nextTier}
      </p>
    </section>
  );
}
