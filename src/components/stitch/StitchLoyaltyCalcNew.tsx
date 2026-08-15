/**
 * StitchLoyaltyCalcNew — AURA CAFE Loyalty Calculator (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy loyalty calculator with spending input, tier progress gauge,
 * tier info card, benefits preview list, and CTA. Mobile-first responsive.
 * Named export.
 * Source: stitch-exports/new-screens/loyalty-calculator.html
 */
'use client';

import { useTranslation } from 'react-i18next';

/* ─── Re-exports ───────────────────────────────────────────────────── */
export type { BenefitReward, StitchLoyaltyCalcNewProps } from './StitchLoyaltyCalcNew-types';
export type { LoyaltyCalcState } from './StitchLoyaltyCalcNew-types';

/* ─── Imports ──────────────────────────────────────────────────────── */
import type { StitchLoyaltyCalcNewProps } from './StitchLoyaltyCalcNew-types';
import {
  DEFAULT_POINTS_PER_DOLLAR,
  DEFAULT_TIER_MILESTONES,
  DEFAULT_TIER_LABELS,
} from './StitchLoyaltyCalcNew-constants';
import { defaultBenefits } from './StitchLoyaltyCalcNew-constants';
import { useLoyaltyCalc } from './StitchLoyaltyCalcNew-hooks';
import { TopAppBar } from './StitchLoyaltyCalcNew-top-app-bar';
import { SpendingInput } from './StitchLoyaltyCalcNew-spending-input';
import { TierProgressGauge } from './StitchLoyaltyCalcNew-tier-gauge';
import { TierInfoCard } from './StitchLoyaltyCalcNew-tier-info-card';
import { BenefitsPreview } from './StitchLoyaltyCalcNew-benefits-preview';
import { CtaSection } from './StitchLoyaltyCalcNew-cta-section';
import { BottomNav } from './StitchLoyaltyCalcNew-bottom-nav';

/* ─── Component ────────────────────────────────────────────────────── */

export function StitchLoyaltyCalcNew({
  pointsPerDollar = DEFAULT_POINTS_PER_DOLLAR,
  tierMilestones = DEFAULT_TIER_MILESTONES,
  tierLabels = DEFAULT_TIER_LABELS,
  benefits = defaultBenefits,
}: Readonly<StitchLoyaltyCalcNewProps>) {
  const { t } = useTranslation();
  const { spending, points, percentage, currentTierIndex, nextTierIndex, pointsToNext, handleSpendingChange } =
    useLoyaltyCalc(pointsPerDollar, tierMilestones);

  return (
    <>
      <TopAppBar />

      <main className="mx-auto max-w-md px-5 pb-32 pt-24">
        <section className="mb-10">
          <h1 className="mb-2 font-[family-name:var(--aura-display-font)] text-3xl text-[var(--aura-chrome-bright)]">
            Loyalty Calculator
          </h1>
          <p className="font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-bronze-shimmer)] opacity-80">
            Unlock industrial-grade rewards. Every $1 spent earns you 10 loyalty points toward your next tier.
          </p>
        </section>

        <SpendingInput spending={spending} points={points} onChange={handleSpendingChange} />
        <TierProgressGauge
          tierMilestones={tierMilestones}
          tierLabels={tierLabels}
          points={points}
          percentage={percentage}
          currentTierIndex={currentTierIndex}
        />
        <TierInfoCard pointsToNext={pointsToNext} nextTierIndex={nextTierIndex} tierLabels={tierLabels} />
        <BenefitsPreview benefits={benefits} />
        <CtaSection pointsPerDollar={pointsPerDollar} />
      </main>

      <BottomNav />
    </>
  );
}
