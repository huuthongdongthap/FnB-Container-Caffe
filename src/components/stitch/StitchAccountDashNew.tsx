/**
 * StitchAccountDashNew — AURA CAFE Customer Account Dashboard (v2)
 *
 * Pixel-perfect match against:
 *   stitch-exports/stitch_aura_cafe/aura_cafe_customer_account_dashboard/code.html
 *
 * Mobile-first, dark navy theme with glassmorphism cards, bronze gradients,
 * and chrome/silver accents. Includes membership card.
 *
 * NOTE: This component uses the exact color hex values and font stacks from
 * the original Stitch HTML design. It does NOT reference --aura-* CSS variables.
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee, Menu } from 'lucide-react';
import { useFavoritesStore } from '@/hooks/stores/use-favorites-store';
import { useMenuStore } from '@/hooks/stores/use-menu-store';
import { BODY_FONT } from './StitchAccountDashNew-constants';
import type { StitchAccountDashNewProps } from './StitchAccountDashNew-types';
export type { StitchAccountDashNewProps, DashAccountProfile, DashLoyaltyData, DashOrderItem } from './StitchAccountDashNew-types';
import { defaultProfile, defaultLoyalty, defaultOrders } from './StitchAccountDashNew-constants';
import { useDashMicroInteractions } from './StitchAccountDashNew-hook';
import { DashSkeleton } from './StitchAccountDashNew-skeleton';
import { DashError } from './StitchAccountDashNew-empty';
import { DashProfileSection } from './StitchAccountDashNew-profile';
import { DashLoyaltySection } from './StitchAccountDashNew-loyalty';
import { DashFavoritesSection } from './StitchAccountDashNew-favorites';
import { DashOrdersSection } from './StitchAccountDashNew-orders';
import { DashMembershipCard } from './StitchAccountDashNew-membership';
import { DashBottomNav } from './StitchAccountDashNew-footer';

export function StitchAccountDashNew({
  profile: profileProp,
  loyalty: loyaltyProp,
  orders: ordersProp,
}: Readonly<StitchAccountDashNewProps>) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items: favIds } = useFavoritesStore();
  const { items: menuItems } = useMenuStore();
  const { setGlassCardRef } = useDashMicroInteractions();

  const profile = profileProp ?? defaultProfile;
  const loyalty = loyaltyProp ?? defaultLoyalty;
  const orders = ordersProp ?? defaultOrders;
  const favoriteItems = menuItems.filter((item) => favIds.includes(String(item.id)));

  if (loading) return <DashSkeleton />;

  if (error) {
    return (
      <DashError
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
      className="relative min-h-screen bg-[var(--aura-surface-dim)] text-[var(--aura-chrome-bright)] antialiased overflow-x-hidden"
      style={{ fontFamily: BODY_FONT }}
      aria-label={t('stitch.accountDashboard.pageAriaLabel', 'Account Dashboard')}
    >
      {/* ═══════════════ Top App Bar ═══════════════ */}
      <header
        className="fixed top-0 w-full z-50 bg-[var(--aura-surface-dim)]/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-5 h-16"
        aria-label={t('stitch.accountDashboard.appBarAriaLabel', 'App bar')}
      >
        <button
          type="button"
          className="hover:opacity-80 transition-opacity active:scale-95 transition-transform"
          aria-label={t('stitch.accountDashboard.openMenu', 'Open menu')}
        >
          <Menu className="text-[var(--aura-chrome-bright)] w-6 h-6" />
        </button>
        <h1
          className="text-[24px] tracking-tighter text-[var(--aura-chrome-bright)] font-bold"
          style={{ fontFamily: '"EB Garamond", Georgia, "Times New Roman", serif' }}
        >
          {t('stitch.accountDashboard.appTitle', 'AURA CAFE')}
        </h1>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
          <img
            className="w-full h-full object-cover"
            src={profile.avatar}
            alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name }) || profile.name}
            loading="lazy"
          />
        </div>
      </header>

      {/* ═══════════════ Main Content ═══════════════ */}
      <main className="pt-24 pb-32 px-5 max-w-[1280px] mx-auto space-y-6">
        <DashProfileSection profile={profile} setGlassCardRef={setGlassCardRef} />
        <DashLoyaltySection loyalty={loyalty} tier={profile.tier} setGlassCardRef={setGlassCardRef} />

        {/* Quick Order Button */}
        <section>
          <button
            type="button"
            className="w-full h-16 rounded-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform group bg-gradient-to-br from-[#CD7F32] to-[#A0522D]"
            aria-label={t('stitch.accountDashboard.quickOrder', 'QUICK ORDER')}
          >
            <Coffee className="w-6 h-6 text-[var(--aura-noir-deep)] group-hover:rotate-12 transition-transform" />
            <span
              className="text-lg tracking-[0.05em] font-semibold uppercase text-[var(--aura-noir-deep)]"
              style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
            >
              {t('stitch.accountDashboard.quickOrder', 'QUICK ORDER')}
            </span>
          </button>
        </section>

        <DashFavoritesSection favoriteItems={favoriteItems} setGlassCardRef={setGlassCardRef} />
        <DashOrdersSection orders={orders} setGlassCardRef={setGlassCardRef} />
        <DashMembershipCard profile={profile} />
      </main>

      {/* ═══════════════ Bottom Navigation ═══════════════ */}
      <DashBottomNav />
    </div>
  );
}
