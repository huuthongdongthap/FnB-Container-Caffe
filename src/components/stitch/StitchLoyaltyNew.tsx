/**
 * StitchLoyaltyNew — AURA CAFE Loyalty & Rewards Dashboard
 *
 * Desktop loyalty DASHBOARD (platinum hero + rewards grid + points history +
 * streak + referral block). Sub-components extracted to focused files.
 *
 * NOTE: `stitch-exports/loyalty/design.html` is a DIFFERENT screen variant
 * — a mobile-first loyalty CALCULATOR. Not the source of truth for this component.
 */
'use client';

import { useTranslation } from 'react-i18next';

/* ─── Re-exported types (public API) ──────────────────────────────── */
export type {
  LoyaltyRewardItem,
  LoyaltyHistoryEntry,
  LoyaltyStreakDay,
  LoyaltyTierBenefit,
  LoyaltyDashboardData,
  LoyaltyLoadingState,
  StitchLoyaltyNewProps,
} from './stitch-loyalty-types';

/* ─── Sub-components ──────────────────────────────────────────────── */
import { ScrollbarStyles } from './loyalty-scrollbar-styles';
import { LoyaltySkeleton } from './loyalty-skeleton';
import { LoyaltyError } from './loyalty-error-state';
import { LoyaltyEmpty } from './loyalty-empty-state';
import { LoyaltyHeader } from './loyalty-header';
import { TierCard } from './loyalty-tier-card';
import { RewardsGrid } from './loyalty-rewards-grid';
import { PointsHistorySection } from './loyalty-history-section';
import { WeeklyStreak } from './loyalty-weekly-streak';
import { ReferralBlock } from './loyalty-referral-block';
import { TierBenefits } from './loyalty-tier-benefits';
import { LoyaltyFooter } from './loyalty-footer';

/* ─── Hooks ───────────────────────────────────────────────────────── */
import { useParallaxGlass } from '@/hooks/use-parallax-glass';

/* ─── Data & Types ────────────────────────────────────────────────── */
import type { LoyaltyDashboardData, StitchLoyaltyNewProps } from './stitch-loyalty-types';
import { getDefaultLoyaltyData } from './loyalty-default-data';

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchLoyaltyNew({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrorMessage,
  onRedeemPoints,
  onClaimReward,
  onCheckIn,
  onShareReferral,
}: Readonly<StitchLoyaltyNewProps>) {
  const { t } = useTranslation();

  useParallaxGlass();

  const data: LoyaltyDashboardData = externalData ?? getDefaultLoyaltyData(t);
  const resolvedErrorMessage = externalErrorMessage ?? t('loyalty.errorDescription');

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <LoyaltySkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--aura-surface-dim)' }}>
        <LoyaltyError message={resolvedErrorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────────── */
  if (!data || data.pointsBalance === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--aura-surface-dim)' }}>
        <LoyaltyEmpty />
      </div>
    );
  }

  return (
    <div
      id="stitch-loyalty-scroll"
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: 'var(--aura-surface-dim)',
        color: 'var(--aura-chrome-bright)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <ScrollbarStyles />

      {/* Nocturnal-vibe background gradient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent) 0%, transparent 70%)',
        }}
      />

      <LoyaltyHeader />

      {/* ─── Main Content ───────────────────────────────────────────── */}
      <main className="pt-32 pb-24 px-[64px] max-w-[1440px] mx-auto grid grid-cols-12 gap-[24px]">
        {/* Left Column: Hero & Rewards */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-[48px]">
          <TierCard data={data} onRedeemPoints={onRedeemPoints} />
          <RewardsGrid rewards={data.rewards} onClaimReward={onClaimReward} />
          <PointsHistorySection history={data.pointsHistory} />
        </div>

        {/* Right Column: Stats & Social */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-[48px]">
          <WeeklyStreak
            days={data.streakDays}
            streakCount={data.streakCount}
            onCheckIn={onCheckIn}
          />
          <ReferralBlock
            code={data.referralCode}
            onShare={onShareReferral}
          />
          <TierBenefits benefits={data.tierBenefits} />
        </div>
      </main>

      <LoyaltyFooter />
    </div>
  );
}
