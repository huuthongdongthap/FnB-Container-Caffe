/**
 * StitchAccountNew — AURA CAFE Customer Account Dashboard (HTML-to-TSX conversion)
 *
 * Mobile-first, dark navy theme with glassmorphism cards and chrome/silver accents.
 * Source: stitch-exports/stitch_aura_cafe/aura_cafe_customer_account/code.html
 *
 * This is the main composition file. Sub-components, types, and default data
 * are extracted into dedicated modules to keep each file under 200 LOC.
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee } from 'lucide-react';

/* ─── Types & Defaults ────────────────────────────────────────── */

import type {
  StitchAccountNewProps,
  AccountProfileNew,
  LoyaltyDataNew,
  OrderItemNew,
  AccountCardNew,
} from './StitchAccountNew-types';
import {
  defaultProfile,
  defaultLoyalty,
  defaultOrders,
  defaultCards,
} from './StitchAccountNew-types';

/* ─── Sub-Components ─────────────────────────────────────────── */

import { AccountNewSkeleton } from './StitchAccountNew-skeleton';
import { AccountNewError } from './StitchAccountNew-error';
import { AccountNewProfileSection } from './StitchAccountNew-profile-section';
import { AccountNewLoyaltySection } from './StitchAccountNew-loyalty-section';
import { AccountNewOrderHistory } from './StitchAccountNew-order-history';
import { AccountNewSettingsCards } from './StitchAccountNew-settings-cards';

/* ─── Re-export Types ────────────────────────────────────────── */

export type {
  StitchAccountNewProps,
  AccountProfileNew,
  LoyaltyDataNew,
  OrderItemNew,
  AccountCardNew,
} from './StitchAccountNew-types';

/* ─── Main Component ──────────────────────────────────────────── */

export function StitchAccountNew({
  profile: profileProp,
  loyalty: loyaltyProp,
  orders: ordersProp,
  cards: cardsProp,
}: Readonly<StitchAccountNewProps>) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = profileProp ?? defaultProfile;
  const loyalty = loyaltyProp ?? defaultLoyalty;
  const orders = ordersProp ?? defaultOrders;
  const cards = cardsProp ?? defaultCards;

  if (loading) return <AccountNewSkeleton />;

  if (error) {
    return (
      <AccountNewError
        onRetry={() => {
          setError(null);
          setLoading(true);
          setTimeout(() => setLoading(false), 1000);
        }}
      />
    );
  }

  return (
    <div
      className="relative min-h-screen bg-[var(--aura-bg-page, var(--aura-bg-surface))] text-[var(--aura-text-primary, #e8e8e8)] overflow-x-hidden"
      aria-label={t('stitch.accountDashboard.pageAriaLabel') || 'Account Dashboard'}
    >
      {/* ═══════════════ Main Content (Header & BottomNav handled by CustomerShell) ═══════════════ */}
      <main className="py-6 px-5 max-w-lg mx-auto w-full space-y-6">
        <AccountNewProfileSection profile={profile} />
        <AccountNewLoyaltySection loyalty={loyalty} />

        {/* ─── Quick Order Button ─── */}
        <button
         type="button"
          className="w-full h-14 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform group"
          style={{
            background: 'linear-gradient(135deg, var(--aura-chrome-mid, #6B9FB8) 0%, var(--aura-chrome-mid, #A0522D) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(var(--aura-glass-bg),0.2)',
          }}
          aria-label={t('stitch.accountDashboard.quickOrder')}
        >
          <Coffee className="w-5 h-5 text-[var(--aura-noir-void, #050D1A)] group-hover:rotate-12 transition-transform" />
          <span
            className="text-sm font-bold tracking-[0.2em] uppercase text-[var(--aura-noir-void, #050D1A)]"
            style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
          >
            {t('stitch.accountDashboard.quickOrder')}
          </span>
        </button>

        <AccountNewOrderHistory orders={orders} />
        <AccountNewSettingsCards cards={cards} />
      </main>

      {/* ═══════════════ Floating Atmosphere Elements ═══════════════ */}
      <div
        className="fixed top-20 left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(var(--aura-chrome-light),0.05), transparent 70%)',
          filter: 'blur(8px)',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-40 right-0 w-60 h-60 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201,214,223,0.05), transparent 70%)',
          filter: 'blur(8px)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
