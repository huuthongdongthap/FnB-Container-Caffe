/**
 * StitchSubscriptionsNew — AURA CAFE Subscription Plans (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy subscription page with hero section, 3 pricing cards (Basic/Premium/Enterprise),
 * industrial texture visual element, and footer. Mobile-first responsive. Named export.
 * Source: stitch-exports/new-screens/subscriptions.html
 */
'use client';

import {
  defaultTiers,
  type StitchSubscriptionsNewProps,
} from './StitchSubscriptionsNew-constants';
import { StitchSubscriptionsNewHeader } from './StitchSubscriptionsNewHeader';
import { StitchSubscriptionsNewHero } from './StitchSubscriptionsNewHero';
import { StitchSubscriptionsNewPricingCard } from './StitchSubscriptionsNewPricingCard';
import { StitchSubscriptionsNewVisual } from './StitchSubscriptionsNewVisual';
import { StitchSubscriptionsNewFooter } from './StitchSubscriptionsNewFooter';

export type { SubscriptionTier, StitchSubscriptionsNewProps } from './StitchSubscriptionsNew-constants';

/* ─── Component ────────────────────────────────────────────────────── */

export function StitchSubscriptionsNew({
  tiers = defaultTiers,
  onSelectPlan,
}: Readonly<StitchSubscriptionsNewProps>) {
  return (
    <>
      <StitchSubscriptionsNewHeader />

      <main className="min-h-screen bg-[var(--aura-surface-dim)] px-5 pb-20 pt-24">
        <StitchSubscriptionsNewHero />

        {/* Pricing Cards Grid */}
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <StitchSubscriptionsNewPricingCard
              key={tier.id}
              tier={tier}
              onSelectPlan={onSelectPlan}
            />
          ))}
        </div>

        <StitchSubscriptionsNewVisual />
      </main>

      <StitchSubscriptionsNewFooter />
    </>
  );
}
