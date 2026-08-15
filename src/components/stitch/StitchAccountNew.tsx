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
import { Coffee, Menu, Bell } from 'lucide-react';

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
import { AccountNewBottomNav } from './StitchAccountNew-bottom-nav';

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
      className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] text-[var(--aura-text-primary, #e8e8e8)] overflow-x-hidden"
      aria-label={t('stitch.accountDashboard.pageAriaLabel') || 'Account Dashboard'}
    >
      {/* ═══════════════ Top App Bar ═══════════════ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-5 border-b border-[rgba(255,255,255,0.06)] bg-[var(--aura-bg-page, #0A1A2E)]/80 backdrop-blur-xl"
        aria-label={t('stitch.accountDashboard.appBarAriaLabel') || 'App bar'}
      >
        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 text-[var(--aura-primary, #c6c6c7)] hover:opacity-80 active:scale-90 transition-all"
          aria-label={t('stitch.accountDashboard.openMenu')}
        >
          <Menu className="w-6 h-6" />
        </button>

        <h1 className="font-display text-[clamp(1.25rem,4vw,1.75rem)] tracking-widest text-[#d4a574]">
          AURA CAFE
        </h1>

        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 text-[var(--aura-primary, #c6c6c7)] hover:opacity-80 active:scale-90 transition-all"
          aria-label="Notifications"
        >
          <Bell className="w-6 h-6" />
        </button>
      </header>

      {/* ═══════════════ Main Content ═══════════════ */}
      <main className="pt-24 pb-36 px-5 max-w-lg mx-auto w-full space-y-6">
        <AccountNewProfileSection profile={profile} />
        <AccountNewLoyaltySection loyalty={loyalty} />

        {/* ─── Quick Order Button ─── */}
        <button
          type="button"
          className="w-full h-14 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform group"
          style={{
            background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          aria-label={t('stitch.accountDashboard.quickOrder')}
        >
          <Coffee className="w-5 h-5 text-[#1a1a2e] group-hover:rotate-12 transition-transform" />
          <span
            className="text-sm font-bold tracking-[0.2em] uppercase text-[#1a1a2e]"
            style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
          >
            {t('stitch.accountDashboard.quickOrder')}
          </span>
        </button>

        <AccountNewOrderHistory orders={orders} />
        <AccountNewSettingsCards cards={cards} />
      </main>

      {/* ═══════════════ Bottom Navigation ═══════════════ */}
      <AccountNewBottomNav />

      {/* ═══════════════ Floating Atmosphere Elements ═══════════════ */}
      <div
        className="fixed top-20 left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(184,199,226,0.05), transparent 70%)',
          filter: 'blur(80px)',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-40 right-0 w-60 h-60 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,165,116,0.05), transparent 70%)',
          filter: 'blur(100px)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
