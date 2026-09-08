/**
 * Loyalty progress section for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import type { LoyaltyDataNew } from './StitchAccountNew-types';

const glassCardStyle = {
  background: 'color-mix(in srgb, var(--aura-glass-bg) 40%, transparent)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid color-mix(in srgb, var(--aura-glass-bg) 10%, transparent)',
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
            style={{ fontFamily: "var(--aura-font-display)", color: 'var(--aura-chrome-light, #d4a574)' }}
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
          <p className="text-sm" style={{ color: 'var(--aura-text-body, #c1c7cf)' }}>
            {loyalty.nextTier}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--st-on-primary, #1e3550)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${loyalty.progressPercent}%`,
            background: 'linear-gradient(135deg, var(--aura-chrome-mid, #CD7F32) 0%, var(--aura-chrome-mid, #A0522D) 100%)',
            boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--aura-glass-bg) 20%, transparent)',
          }}
        />
      </div>

      <p className="text-[11px] text-right" style={{ color: 'var(--aura-text-muted, #7c838a)' }}>
        {loyalty.pointsToNext} {t('stitch.accountDashboard.pts')} until {loyalty.nextTier}
      </p>
    </section>
  );
}
