/**
 * StitchLoyaltyCalcNew — AURA CAFE Loyalty Calculator (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy loyalty calculator with spending input, tier progress gauge,
 * tier info card, benefits preview list, and CTA. Mobile-first responsive.
 * Named export.
 * Source: stitch-exports/new-screens/loyalty-calculator.html
 */
'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Coffee, ArmchairIcon as Seat, Truck } from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface BenefitReward {
  id: string;
  icon: 'coffee' | 'seat' | 'truck';
  title: string;
  description: string;
  locked: boolean;
}

export interface StitchLoyaltyCalcNewProps {
  /** Points earned per dollar spent */
  pointsPerDollar?: number;
  /** Tier milestones (points needed for each tier) */
  tierMilestones?: number[];
  /** Tier labels */
  tierLabels?: string[];
  /** Benefits/rewards list */
  benefits?: BenefitReward[];
}

/* ─── Default data ─────────────────────────────────────────────────── */

const defaultBenefits: BenefitReward[] = [
  {
    id: 'cupping',
    icon: 'coffee',
    title: 'Free Monthly Cupping',
    description: 'Exclusive tasting sessions',
    locked: true,
  },
  {
    id: 'lounge',
    icon: 'seat',
    title: 'Priority Lounge Access',
    description: 'Fast-track seating in Aura Labs',
    locked: true,
  },
  {
    id: 'delivery',
    icon: 'truck',
    title: 'Free Roastery Delivery',
    description: 'Zero-cost shipping on bulk beans',
    locked: true,
  },
];

/* ─── Icon mapping ─────────────────────────────────────────────────── */

const iconMap: Record<string, React.ReactNode> = {
  coffee: <Coffee size={20} className="text-[var(--aura-bronze-shimmer)]/60" />,
  seat: <Seat size={20} className="text-[var(--aura-bronze-shimmer)]/60" />,
  truck: <Truck size={20} className="text-[var(--aura-bronze-shimmer)]/60" />,
};

/* ─── Component ────────────────────────────────────────────────────── */

export function StitchLoyaltyCalcNew({
  pointsPerDollar = 10,
  tierMilestones = [0, 1000, 2000, 3000],
  tierLabels = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'],
  benefits = defaultBenefits,
}: Readonly<StitchLoyaltyCalcNewProps>) {
  const { t } = useTranslation();
  const [spending, setSpending] = useState(125);

  const points = useMemo(() => Math.round(spending * pointsPerDollar), [spending, pointsPerDollar]);

  const percentage = useMemo(() => {
    const max = tierMilestones[tierMilestones.length - 1]!;
    return Math.min((points / max) * 100, 100);
  }, [points, tierMilestones]);

  const currentTierIndex = useMemo(() => {
    let idx = 0;
    for (let i = tierMilestones.length - 1; i >= 0; i--) {
      if (points >= tierMilestones[i]!) {
        idx = i;
        break;
      }
    }
    return idx;
  }, [points, tierMilestones]);

  const nextTierIndex = useMemo(() => {
    const next = currentTierIndex + 1;
    return next < tierMilestones.length ? next : -1;
  }, [currentTierIndex, tierMilestones.length]);

  const pointsToNext = useMemo(() => {
    if (nextTierIndex < 0) return 0;
    return tierMilestones[nextTierIndex]! - points;
  }, [nextTierIndex, points, tierMilestones]);

  const handleSpendingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setSpending(Number.isNaN(val) || val < 0 ? 0 : val);
    },
    [],
  );

  return (
    <>
      {/* Top App Bar */}
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--aura-surface-container)] bg-[var(--aura-surface-dim)] px-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-[var(--aura-chrome-bright)] active:scale-95"
            aria-label="Menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="AURA CAFE Logo"
            className="h-8 w-8 object-contain"
            src="https://lh3.googleusercontent.com/aida/AP1WRLst_bTmebzLq1BIwYvixuANOxS8OzfdrBiG2ek-VB__5o2iYZd2ZMsg4kX1zZBn7lg4OrV1tetohSyD_Vta-8z-tGVmew1Saua_uy54G0H1UEcqGN_63Rb7e7JbTVRWbOL7k8Y890nV1SxSyXOEGhOu1MOdNh4DAc8LE9KsFaaSvL6aS2ne-NplbsnM_54D0oC9GTTlcojd87dGQYuvqZScZ16Ndyu7R5f-P7_RqlySuyC_fGxgjYJksk4"
          />
          <span className="font-[family-name:var(--aura-display-font)] text-2xl uppercase tracking-widest text-[var(--aura-chrome-bright)]">
            AURA CAFE
          </span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--aura-surface-container)] bg-[var(--aura-surface-container)] active:scale-95">
          <User className="text-sm text-[var(--aura-bronze-shimmer)]" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pb-32 pt-24">
        {/* Header Section */}
        <section className="mb-10">
          <h1 className="mb-2 font-[family-name:var(--aura-display-font)] text-3xl text-[var(--aura-chrome-bright)]">
            Loyalty Calculator
          </h1>
          <p className="font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-bronze-shimmer)] opacity-80">
            Unlock industrial-grade rewards. Every $1 spent earns you 10 loyalty points toward your next tier.
          </p>
        </section>

        {/* Input Card */}
        <div
          className="relative mb-10 overflow-hidden rounded p-6"
          style={{
            background: 'var(--aura-surface-container)',
            border: '1px solid var(--aura-surface-container-high)',
          }}
        >
          <div className="flex flex-col gap-4">
            <label
              className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-bronze-shimmer)]"
              htmlFor="spending-input"
            >
              Current Spending ($)
            </label>
            <input
              className="border-b border-[var(--aura-surface-container-high)] bg-transparent py-2 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-bronze-shimmer)] outline-none transition-colors duration-300 focus:border-[var(--aura-bronze-shimmer)]"
              id="spending-input"
              placeholder="0.00"
              type="number"
              value={spending || ''}
              onChange={handleSpendingChange}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)] opacity-60">
                Estimated Points
              </span>
              <span className="font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-bright)]">
                {points.toLocaleString()} PTS
              </span>
            </div>
          </div>
        </div>

        {/* Progress Section (The Gauge) */}
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between">
            <h3 className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-bronze-shimmer)]">
              Tier Status
            </h3>
            <span className="font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-bright)]">
              {tierLabels[currentTierIndex]}
            </span>
          </div>
          <div
            className="relative mb-2"
            style={{
              height: '2px',
              background: 'var(--aura-surface-container-high)',
            }}
          >
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${percentage}%`,
                background: 'var(--aura-bronze-shimmer)',
              }}
            />
            {tierMilestones.map((milestone, idx) => {
              const pos = (milestone / tierMilestones[tierMilestones.length - 1]!) * 100;
              const isActive = points >= milestone;
              return (
                <div
                  key={milestone}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${pos}%`,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isActive ? 'var(--aura-bronze-shimmer)' : 'var(--aura-surface-container)',
                    border: isActive
                      ? '1px solid var(--aura-bronze-shimmer)'
                      : '1px solid var(--aura-surface-container-high)',
                    boxShadow: isActive ? '0 0 10px rgba(212, 165, 116, 0.4)' : 'none',
                    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            {tierLabels.map((label, idx) => (
              <span
                key={label}
                className={`font-[family-name:var(--aura-body-font)] text-xs ${
                  idx === currentTierIndex
                    ? 'text-[var(--aura-chrome-bright)]'
                    : 'text-[var(--aura-bronze-shimmer)] opacity-40'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* Tier Info Card */}
        <div
          className="mb-10 border-l-4 p-6"
          style={{
            background: 'var(--aura-surface-container-high)',
            borderLeftColor: 'var(--aura-bronze-shimmer)',
          }}
        >
          <div className="mb-2 flex items-center gap-4">
            <span className="material-symbols-outlined text-[var(--aura-bronze-shimmer)]">
              military_tech
            </span>
            <h4 className="font-[family-name:var(--aura-body-font)] text-sm uppercase tracking-wider text-[var(--aura-bronze-shimmer)]">
              Next Tier
            </h4>
          </div>
          <p className="font-[family-name:var(--aura-body-font)] text-base">
            <span className="font-bold text-[var(--aura-chrome-bright)]">
              {pointsToNext.toLocaleString()} pts
            </span>{' '}
            away from reaching{' '}
            <span className="text-[var(--aura-bronze-shimmer)]">
              {nextTierIndex >= 0 ? tierLabels[nextTierIndex] : 'MAX'}
            </span>{' '}
            status.
          </p>
        </div>

        {/* Benefits Preview */}
        <section className="mb-12">
          <h3 className="mb-6 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-bronze-shimmer)]">
            Upcoming Rewards
          </h3>
          <div className="flex flex-col border-t border-[var(--aura-surface-container)]">
            {benefits.map((benefit, idx) => (
              <div
                key={benefit.id}
                className={`flex items-center justify-between border-b border-[var(--aura-surface-container)] py-6 ${
                  idx === 0 ? 'group' : ''
                }`}
              >
                <div className="flex items-center gap-6">
                  <div className="flex h-10 w-10 items-center justify-center border border-[var(--aura-surface-container)] bg-[var(--aura-surface-container)]">
                    {iconMap[benefit.icon] || <Coffee size={20} className="text-[var(--aura-bronze-shimmer)]/60" />}
                  </div>
                  <div>
                    <p className="font-[family-name:var(--aura-body-font)] text-sm uppercase text-[var(--aura-chrome-bright)]">
                      {benefit.title}
                    </p>
                    <p className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)] opacity-60">
                      {benefit.description}
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-[var(--aura-bronze-shimmer)] opacity-20"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lock
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            className="w-full bg-[var(--aura-bronze-shimmer)] py-4 font-[family-name:var(--aura-body-font)] text-sm uppercase tracking-wider text-[var(--aura-surface-dim)] shadow-lg shadow-[var(--aura-bronze-shimmer)]/20 transition-all duration-200 active:scale-95"
          >
            Quick Order
          </button>
          <p className="text-center font-[family-name:var(--aura-body-font)] text-xs italic text-[var(--aura-bronze-shimmer)] opacity-40">
            Earn {pointsPerDollar} pts for every $1 spent on your next visit.
          </p>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-xl border-t border-[var(--aura-surface-container)] bg-[var(--aura-surface-container)] px-4 pb-4 pt-2">
        <button
          type="button"
          className="flex flex-col items-center justify-center text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-chrome-bright)] active:scale-90"
        >
          <span className="material-symbols-outlined">restaurant_menu</span>
          <span className="mt-1 font-[family-name:var(--aura-body-font)] text-xs uppercase">Menu</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-full bg-[var(--aura-bronze-shimmer)] px-4 py-1 text-[var(--aura-surface-dim)] active:scale-90"
        >
          <span className="material-symbols-outlined">military_tech</span>
          <span className="mt-1 font-[family-name:var(--aura-body-font)] text-xs uppercase">Rewards</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-chrome-bright)] active:scale-90"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="mt-1 font-[family-name:var(--aura-body-font)] text-xs uppercase">Account</span>
        </button>
      </nav>
    </>
  );
}
