/**
 * DashLoyaltySection — loyalty progress card for StitchAccountDashNew
 */
import { useTranslation } from 'react-i18next';
import type { DashLoyaltyData } from './StitchAccountDashNew-types';
import { BODY_FONT, DISPLAY_FONT } from './StitchAccountDashNew-constants';

interface DashLoyaltySectionProps {
  loyalty: DashLoyaltyData;
  tier: string;
  setGlassCardRef: (el: HTMLElement | null) => void;
}

export function DashLoyaltySection({ loyalty, tier, setGlassCardRef }: DashLoyaltySectionProps) {
  const { t } = useTranslation();
  return (
    <section
      ref={setGlassCardRef}
      className="rounded-xl px-6 py-6 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10 space-y-4"
      aria-label={t('stitch.accountDashboard.loyaltySectionAriaLabel') || 'Loyalty progress'}
    >
      <div className="flex justify-between items-end">
        <div>
          <p
            className="text-[10px] font-bold tracking-widest uppercase text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', marginBottom: '4px' }}
          >
            {t('stitch.accountDashboard.currentBalance', 'Current Balance')}
          </p>
          <p
            className="text-[32px] text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: DISPLAY_FONT, lineHeight: '1.3', fontWeight: 500 }}
          >
            {loyalty.points.toLocaleString()}
            <span
              className="text-base opacity-60 ml-1"
              style={{ fontFamily: BODY_FONT, fontWeight: 400, lineHeight: '1.6' }}
            >
              {t('stitch.accountDashboard.pts', 'pts')}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[10px] font-bold tracking-widest uppercase text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', marginBottom: '4px' }}
          >
            {t('stitch.accountDashboard.nextTier', { tier: loyalty.nextTier }) || `Next Tier: ${loyalty.nextTier}`}
          </p>
          <p
            className="text-base text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: BODY_FONT, fontWeight: 400, lineHeight: '1.6' }}
          >
            {loyalty.pointsToNext.toLocaleString()} {t('stitch.accountDashboard.pts', 'pts')} {t('stitch.accountDashboard.pointsToGo', 'to go')}
          </p>
        </div>
      </div>

      {/* Progress bar — matches original bronze-gradient */}
      <div className="w-full h-1.5 bg-[var(--aura-bg-high)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#CD7F32] to-[#A0522D]"
          style={{ width: `${loyalty.progressPercent}%` }}
        />
      </div>

      <div
        className="flex justify-between text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--aura-chrome-soft)]/50"
        style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
      >
        <span>{tier}</span>
        <span>{loyalty.nextTier}</span>
      </div>
    </section>
  );
}
