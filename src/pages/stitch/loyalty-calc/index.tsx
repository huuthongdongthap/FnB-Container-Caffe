import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';
import { TIER_THRESHOLDS, TIER_LABELS, BENEFITS, MAX_VIS_PTS } from './loyalty-calc-constants';
import { SpendingInputCard } from './loyalty-calc-spending-input';
import { TierGauge } from './loyalty-calc-tier-gauge';
import { BenefitsList } from './loyalty-calc-benefits-list';
import { BottomNav } from './loyalty-calc-bottom-nav';

function NextTierCard({ nextTier, ptsToNext }: { nextTier: string; ptsToNext: number }) {
  return (
    <div className="bg-[var(--aura-surface-container-high)] border-l-4 border-[var(--aura-tertiary)] p-4 mb-8">
      <div className="flex items-center gap-3 mb-1">
        <span className="material-symbols-outlined text-[var(--aura-tertiary)]">military_tech</span>
        <h4 className="font-label-md text-label-md uppercase tracking-wider text-[var(--aura-tertiary)]">Next Tier</h4>
      </div>
      <p className="font-body-md text-body-md">
        <span className="text-[var(--aura-chrome-bright)] font-bold">{ptsToNext} pts</span> away from reaching{' '}
        <span className="text-secondary">{nextTier}</span> status.
      </p>
    </div>
  );
}

function CtaSection() {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="w-full bg-[var(--aura-tertiary)] text-on-primary font-label-md text-label-md uppercase py-4 rounded transition-all duration-200 active:scale-95 shadow-lg shadow-[var(--aura-tertiary)]/20"
      >
        Quick Order
      </button>
      <p className="text-center font-label-sm text-label-sm text-secondary opacity-40 italic">
        Earn 10 pts for every $1 spent on your next visit.
      </p>
    </div>
  );
}

export default function LoyaltyCalcNew() {
  const [spending, setSpending] = useState(125);
  const points = Math.round(spending * 10);

  const currentTierIndex = TIER_LABELS.reduce(
    (acc, t, i) => (points >= TIER_THRESHOLDS[t as keyof typeof TIER_THRESHOLDS] ? i : acc),
    0
  );
  const currentTier = TIER_LABELS[currentTierIndex] as (typeof TIER_LABELS)[number];
  const nextTier = TIER_LABELS[currentTierIndex + 1];
  const pct = Math.min((points / MAX_VIS_PTS) * 100, 100);
  const activeNodes = TIER_LABELS.filter(t => points >= TIER_THRESHOLDS[t as keyof typeof TIER_THRESHOLDS]);
  const ptsToNext = nextTier ? TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS] - points : 0;

  return (
    <StitchShell>
      <PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pt-24 pb-32 px-5 max-w-md mx-auto">
        <section className="mb-8">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--aura-tertiary)] mb-2">
            Loyalty Calculator
          </h1>
          <p className="font-body-md text-body-md text-secondary opacity-80">
            Unlock industrial-grade rewards. Every $1 spent earns you 10 loyalty points toward your next tier.
          </p>
        </section>

        <SpendingInputCard
          spending={spending}
          points={points}
          onChange={(e) => setSpending(parseFloat(e.target.value) || 0)}
        />

        <TierGauge points={points} currentTier={currentTier} activeNodes={activeNodes} pct={pct} />

        {nextTier && <NextTierCard nextTier={nextTier} ptsToNext={ptsToNext} />}

        <BenefitsList benefits={BENEFITS} />

        <CtaSection />
      </main>

      <BottomNav />
    </StitchShell>
  );
}
