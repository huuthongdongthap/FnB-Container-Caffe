import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const TIER_THRESHOLDS = {
  BASIC: 0,
  PREMIUM: 1000,
  ENTERPRISE: 2000,
  MASTER: 3000,
} as const;

const TIER_LABELS: readonly string[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

interface Benefit {
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
}

const BENEFITS: readonly Benefit[] = [
  {
    icon: '\u{2615}',
    title: 'Free Monthly Cupping',
    desc: 'Exclusive tasting sessions',
    unlocked: false,
  },
  {
    icon: '\u{1F4CD}',
    title: 'Priority Lounge Access',
    desc: 'Fast-track seating in Aura Labs',
    unlocked: false,
  },
  {
    icon: '\u{1F69A}',
    title: 'Free Roastery Delivery',
    desc: 'Zero-cost shipping on bulk beans',
    unlocked: false,
  },
] as const;

const MAX_VIS_PTS = 3000;

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

  const handleSpendingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpending(parseFloat(e.target.value) || 0);
  };

  return (
    <StitchShell>
      {/* TopAppBar */}
<PageHeader brand="AURA CAFE" scrollEffect />

      {/* Main */}
      <main className="pt-24 pb-32 px-5 max-w-md mx-auto">
        {/* Header */}
        <section className="mb-8">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--aura-tertiary)] mb-2">
            Loyalty Calculator
          </h1>
          <p className="font-body-md text-body-md text-secondary opacity-80">
            Unlock industrial-grade rewards. Every $1 spent earns you 10 loyalty points toward your next tier.
          </p>
        </section>

        {/* Input Card */}
        <div className="bg-[#121F31] border border-[#2E3A4C] p-4 rounded mb-8 relative overflow-hidden">
          <div className="flex flex-col gap-3">
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-secondary" htmlFor="spending-input">
              Current Spending ($)
            </label>
            <input
              id="spending-input"
              type="number"
              value={spending}
              onChange={handleSpendingChange}
              placeholder="0.00"
              className="bg-transparent border-b border-[#2E3A4C] focus:border-[var(--aura-tertiary)] outline-none font-headline-md text-headline-md text-[var(--aura-tertiary)] py-1 transition-colors duration-300"
            />
            <div className="flex justify-between items-center mt-1">
              <span className="font-label-sm text-label-sm text-secondary opacity-60">Estimated Points</span>
              <span className="font-label-md text-label-md text-[var(--aura-tertiary)]" id="points-display">
                {points.toLocaleString()} PTS
              </span>
            </div>
          </div>
        </div>

        {/* Gauge */}
        <section className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <h3 className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Tier Status</h3>
            <span className="font-label-md text-label-md text-[var(--aura-tertiary)]">{currentTier}</span>
          </div>
          <div className="gauge-track mb-1">
            <div className="gauge-fill" id="gauge-fill" style={{ width: `${pct}%` }} />
            {TIER_LABELS.map((t, i) => (
              <div
                key={t}
                className={`gauge-node ${activeNodes.includes(t) ? 'active' : ''}`}
                style={{ left: `${(i / (TIER_LABELS.length - 1)) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {TIER_LABELS.map(t => (
              <span
                key={t}
                className={`font-label-sm text-label-sm ${t === currentTier ? 'text-[var(--aura-tertiary)]' : 'text-secondary opacity-40'}`}
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* Next Tier */}
        {nextTier && (
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
        )}

        {/* Benefits */}
        <section className="mb-8">
          <h3 className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-4">Upcoming Rewards</h3>
          <div className="flex flex-col border-t border-secondary-container">
            {BENEFITS.map(b => (
              <div key={b.title} className="flex items-center justify-between py-4 border-b border-secondary-container group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center border border-secondary-container bg-[var(--aura-surface-container)]">
                    <span className="text-secondary opacity-60">{b.icon}</span>
                  </div>
                  <div>
                    <p className="font-label-md text-label-md uppercase text-on-surface">{b.title}</p>
                    <p className="font-label-sm text-label-sm text-secondary opacity-60">{b.desc}</p>
                  </div>
                </div>
                <span className={`material-symbols-outlined ${b.unlocked ? 'text-[var(--aura-tertiary)]' : 'text-secondary opacity-20'}`}>
                  {b.unlocked ? 'lock_open' : 'lock'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
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
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[var(--aura-surface-container)] flex justify-around items-center px-4 pb-4 pt-2 border-t border-secondary-container rounded-t-xl">
        <button type="button" className="flex flex-col items-center justify-center text-secondary hover:text-[var(--aura-tertiary)] transition-colors active:scale-90 duration-200">
          <span className="material-symbols-outlined">restaurant_menu</span>
          <span className="font-label-sm text-label-sm uppercase mt-1">Menu</span>
        </button>
        <button type="button" className="flex flex-col items-center justify-center bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] rounded-full px-4 py-1 active:scale-90 duration-200">
          <span className="material-symbols-outlined">military_tech</span>
          <span className="font-label-sm text-label-sm uppercase mt-1">Rewards</span>
        </button>
        <button type="button" className="flex flex-col items-center justify-center text-secondary hover:text-[var(--aura-tertiary)] transition-colors active:scale-90 duration-200">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm uppercase mt-1">Account</span>
        </button>
      </nav>

      <style>{`
        .gauge-track {
          height: 2px;
          background: #2E3A4C;
          position: relative;
        }
        .gauge-fill {
          height: 100%;
          background: #D4A574;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gauge-node {
          width: 8px;
          height: 8px;
          background: #121F31;
          border: 1px solid #2E3A4C;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
        }
        .gauge-node.active {
          border-color: #D4A574;
          background: #D4A574;
          box-shadow: 0 0 10px rgba(212, 165, 116, 0.4);
        }
      `}</style>
    </StitchShell>
  );
}
