/**
 * StitchSubscriptionsNew — AURA CAFE Subscription Plans (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy subscription page with hero section, 3 pricing cards (Basic/Premium/Enterprise),
 * industrial texture visual element, and footer. Mobile-first responsive. Named export.
 * Source: stitch-exports/new-screens/subscriptions.html
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export interface StitchSubscriptionsNewProps {
  tiers?: SubscriptionTier[];
  onSelectPlan?: (tierId: string) => void;
}

/* ─── Default tier data ────────────────────────────────────────────── */

const defaultTiers: SubscriptionTier[] = [
  {
    id: 'basic',
    name: 'BASIC',
    price: 9,
    period: 'MONTH',
    features: ['Daily Brew', 'Standard Seating', 'Mobile Ordering'],
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    price: 19,
    period: 'MONTH',
    features: ['All Basic features', 'Specialty Roasts', 'Priority Lounge Access', 'Monthly Cupping'],
    highlighted: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: 49,
    period: 'MONTH',
    features: ['All Premium features', 'Private Event Hosting', 'Personal Concierge', 'Unlimited Global Access'],
  },
];

/* ─── Component ────────────────────────────────────────────────────── */

export function StitchSubscriptionsNew({
  tiers = defaultTiers,
  onSelectPlan,
}: Readonly<StitchSubscriptionsNewProps>) {
  const { t } = useTranslation();

  return (
    <>
      {/* Top App Bar */}
      <header className="fixed top-0 z-50 mx-auto flex h-16 w-full max-w-5xl items-center justify-between border-b border-[var(--aura-chrome-bright)]/20 bg-[var(--aura-surface-dim)] px-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-[var(--aura-bronze-shimmer)] transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-[family-name:var(--aura-display-font)] text-2xl font-bold tracking-tighter text-[var(--aura-bronze-shimmer)]">
            AURA CAFE
          </h1>
        </div>
        <button
          type="button"
          className="text-[var(--aura-bronze-shimmer)] transition-opacity hover:opacity-80"
        >
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      <main className="min-h-screen bg-[var(--aura-surface-dim)] px-5 pb-20 pt-24">
        {/* Hero Section */}
        <section className="mb-12 text-center">
          <span className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
            MEMBERSHIP PROGRAMS
          </span>
          <h2 className="mb-6 font-[family-name:var(--aura-display-font)] text-4xl text-[var(--aura-chrome-bright)] md:text-[64px] md:leading-[1.1] md:tracking-[-0.02em]">
            Precision Craft. <br />
            Exclusive Access.
          </h2>
          <p className="mx-auto max-w-xl font-[family-name:var(--aura-body-font)] text-lg text-[var(--aura-bronze-shimmer)] opacity-70">
            Experience the intersection of industrial grit and luxury hospitality with our curated subscription tiers.
          </p>
        </section>

        {/* Pricing Cards Grid */}
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                tier.highlighted
                  ? 'bg-[var(--aura-surface-container)] shadow-2xl md:-translate-y-4'
                  : 'bg-[var(--aura-surface-container)] transition-all duration-300 hover:bg-[var(--aura-surface-container-high)]'
              }`}
              style={
                tier.highlighted
                  ? {
                      border: '1px solid var(--aura-bronze-shimmer)',
                      boxShadow: '0 0 15px rgba(212, 165, 116, 0.1)',
                    }
                  : {
                      border: '1px solid rgba(198, 198, 199, 0.2)',
                    }
              }
            >
              {tier.badge && (
                <div className="absolute right-0 top-0 p-4">
                  <span className="bg-[var(--aura-bronze-shimmer)] px-3 py-1 font-[family-name:var(--aura-body-font)] text-[10px] tracking-widest text-[var(--aura-surface-dim)]">
                    {tier.badge}
                  </span>
                </div>
              )}
              <div className="mb-12 p-8">
                <h3
                  className={`mb-2 font-[family-name:var(--aura-display-font)] text-3xl ${
                    tier.highlighted ? 'text-[var(--aura-bronze-shimmer)]' : 'text-[var(--aura-bronze-shimmer)]'
                  }`}
                >
                  {tier.name}
                </h3>
                <div className="mb-6 flex items-baseline gap-1">
                  <span
                    className={`font-[family-name:var(--aura-display-font)] text-5xl ${
                      tier.highlighted
                        ? 'text-[var(--aura-bronze-shimmer)]'
                        : 'text-[var(--aura-chrome-bright)]'
                    }`}
                  >
                    ${tier.price}
                  </span>
                  <span
                    className={`font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] ${
                      tier.highlighted
                        ? 'text-[var(--aura-bronze-shimmer)]/70'
                        : 'text-[var(--aura-bronze-shimmer)]'
                    }`}
                  >
                    / {tier.period}
                  </span>
                </div>
                <div
                  className="mb-8"
                  style={{
                    height: '1px',
                    width: '100%',
                    background:
                      'linear-gradient(90deg, transparent 0%, var(--aura-chrome-bright) 50%, transparent 100%)',
                    opacity: 0.2,
                  }}
                />
                <ul className="space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check
                        className="text-[var(--aura-bronze-shimmer)]"
                        size={16}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      />
                      <span
                        className={`font-[family-name:var(--aura-body-font)] text-base ${
                          tier.highlighted
                            ? 'text-[var(--aura-chrome-bright)]'
                            : 'text-[var(--aura-bronze-shimmer)]'
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onSelectPlan?.(tier.id)}
                className={`w-full py-4 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] transition-all active:scale-[0.98] ${
                  tier.highlighted
                    ? 'bg-[var(--aura-bronze-shimmer)] font-bold text-[var(--aura-surface-dim)] hover:brightness-110'
                    : 'border border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] hover:bg-[var(--aura-chrome-bright)] hover:text-[var(--aura-surface-dim)]'
                }`}
              >
                SELECT PLAN
              </button>
            </div>
          ))}
        </div>

        {/* Visual Element: Industrial Texture */}
        <div className="group relative mt-20 h-80 w-full overflow-hidden">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-[var(--aura-surface-dim)] via-transparent to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-full w-full object-cover opacity-40 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-60"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPMrpwgePn0UI2cdpLwT9RrZ35cU0vz9ocTBwin3sVHpblXGa-QHk8te_ombgOq1-M2gcWBWnk1wL_anfcBQCwApHj8Z1wc5lFfaMf_iAHapxdviaoGYTqGH7ei7vmngBScMk6jIk2tR0RwA7likFJjOVX09eufGsjK1cAxcmdYP_Q_E0J_qAKlJNU-v_zd3GzY4n8MJe6Mpj8OBO_TM4-Us1dswG01mhQ1oVE-B77-IW1Zz9e_y6_sOQrdKvveYWZw3D27QxsjSU"
            alt="A high-contrast, professional architectural photograph of a luxury industrial cafe interior"
          />
          <div className="absolute bottom-8 left-8 z-20">
            <p className="mb-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
              FOUNDRY LOCATION
            </p>
            <p className="font-[family-name:var(--aura-display-font)] text-3xl text-[var(--aura-chrome-bright)]">
              The Central Hub.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--aura-chrome-bright)]/10 bg-[var(--aura-surface-dim)] py-12">
        <div className="flex w-full flex-col items-center gap-6 px-5 text-center">
          <h2 className="font-[family-name:var(--aura-display-font)] text-3xl tracking-tighter text-[var(--aura-bronze-shimmer)]">
            AURA CAFE
          </h2>
          <nav className="flex flex-wrap justify-center gap-6">
            <button
              type="button"
              className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-bronze-shimmer)]/80"
            >
              PRIVACY POLICY
            </button>
            <button
              type="button"
              className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-bronze-shimmer)]/80"
            >
              TERMS OF SERVICE
            </button>
            <button
              type="button"
              className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-bronze-shimmer)]/80"
            >
              RECORDS
            </button>
          </nav>
          <p className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]/60">
            &copy; 2024 AURA CAFE. ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </>
  );
}
