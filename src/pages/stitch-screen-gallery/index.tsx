/* ── Stitch Screen Gallery ─────────────────────────────────────────── */
/* Lists all converted Stitch screens for visual QA / discovery */

import { useState, useCallback } from 'react';
import { StitchShell, StitchNav } from '../stitch/StitchBase';

interface Screen {
  name: string;
  slug: string;
  route: string | null;
  source: string;
  icon: string;
  status: 'routed' | 'skipped' | 'partial';
}

const CATEGORIES = ['All', 'Landing', 'Menu', 'Ordering', 'Admin', 'Events', 'Account'] as const;

const SCREENS: Screen[] = [
  // Landing / Container
  { name: 'Landing Hero', slug: 'LuxuryLandingHero', route: '/stitch/landing', source: 'aura_cafe_luxury_landing_hero', icon: '🏭', status: 'routed' },
  { name: 'Container Landing', slug: 'LuxuryContainerLanding', route: '/stitch/container-landing', source: 'aura_cafe_luxury_container_landing', icon: '📦', status: 'routed' },
  { name: 'Container Cafe v1', slug: 'LuxuryContainerCafe1', route: '/stitch/container-cafe-1', source: 'aura_cafe_luxury_container_cafe_1', icon: '☕', status: 'routed' },
  { name: 'Container Cafe v2', slug: 'LuxuryContainerCafe2', route: '/stitch/container-cafe-2', source: 'aura_cafe_luxury_container_cafe_2', icon: '🌙', status: 'routed' },
  // Story / About
  { name: 'Our Story', slug: 'OurStory', route: '/stitch/story', source: 'aura_cafe_our_story', icon: '📖', status: 'routed' },
  // Menu
  { name: 'Digital Menu v1', slug: 'DigitalMenu', route: '/stitch/menu', source: 'aura_cafe_digital_menu', icon: '📋', status: 'routed' },
  { name: 'Digital Menu v2', slug: 'DigitalMenu2', route: '/stitch/menu-2', source: 'aura_cafe_digital_menu_2', icon: '📄', status: 'routed' },
  { name: 'Digital Menu v3', slug: 'DigitalMenu3', route: null, source: 'aura_cafe_digital_menu_1', icon: '📑', status: 'skipped' },
  // Ordering
  { name: 'Mobile Ordering', slug: 'MobileOrdering', route: '/stitch/mobile-ordering', source: 'aura_cafe_mobile_ordering', icon: '📱', status: 'routed' },
  // Events
  { name: 'Events v1', slug: 'EventsPromotions1', route: '/stitch/events-1', source: 'aura_cafe_events_promotions_1', icon: '🎫', status: 'routed' },
  { name: 'Events v2', slug: 'EventsPromotions2', route: '/stitch/events-2', source: 'aura_cafe_events_promotions_2', icon: '🎟️', status: 'routed' },
  // Checkout / POS
  { name: 'Premium Checkout', slug: 'PremiumCheckout', route: '/stitch/premium-checkout', source: 'aura_cafe_premium_checkout', icon: '💳', status: 'routed' },
  { name: 'POS Terminal', slug: 'PosTerminal', route: null, source: 'aura_cafe_pos_terminal', icon: '🖥️', status: 'partial' },
  // KDS / Order Mgmt
  { name: 'Kitchen Display', slug: 'KitchenDisplaySystem', route: '/stitch/kds', source: 'aura_cafe_kitchen_display_system', icon: '🍳', status: 'routed' },
  { name: 'Order Management', slug: 'OrderManagementTerminal', route: '/stitch/order-management', source: 'aura_cafe_order_management_terminal', icon: '📦', status: 'routed' },
  { name: 'Order Success', slug: 'OrderSuccessConfirmation', route: '/stitch/order-success', source: 'aura_cafe_order_success_confirmation', icon: '✅', status: 'routed' },
  // Order failure
  { name: 'Order Failure', slug: 'OrderFailureNew', route: '/order-failure', source: 'new-screens/order-failure', icon: '❌', status: 'routed' },
  // Account
  { name: 'Customer Account', slug: 'CustomerAccount', route: '/stitch/customer-account', source: 'aura_cafe_customer_account', icon: '👤', status: 'routed' },
  { name: 'Account Dashboard', slug: 'CustomerAccountDashboard', route: '/stitch/account-dashboard', source: 'aura_cafe_customer_account_dashboard', icon: '📊', status: 'routed' },
  { name: 'Loyalty Dashboard', slug: 'LoyaltyRewardsDashboard', route: '/stitch/loyalty', source: 'aura_cafe_loyalty_rewards_dashboard', icon: '⭐', status: 'routed' },
  { name: 'Referral v1', slug: 'ReferralRewards1', route: '/stitch/referral-1', source: 'aura_cafe_referral_rewards_1', icon: '🤝', status: 'routed' },
  { name: 'Referral v2', slug: 'ReferralRewards2', route: '/stitch/referral-2', source: 'aura_cafe_referral_rewards_2', icon: '🎁', status: 'routed' },
  { name: 'Customer Reviews', slug: 'CustomerReviews', route: '/stitch/reviews', source: 'aura_cafe_customer_reviews', icon: '💬', status: 'routed' },
  // Admin
  { name: 'Admin v1', slug: 'Admin', route: '/stitch/admin', source: 'aura_cafe_admin', icon: '⚙️', status: 'routed' },
  { name: 'Admin Login', slug: 'AdminLogin', route: '/stitch/admin-login', source: 'aura_cafe_admin_login', icon: '🔐', status: 'routed' },
  { name: 'Admin Terminal', slug: 'AdminTerminal', route: '/stitch/admin-terminal', source: 'aura_cafe_admin_terminal', icon: '🖧️', status: 'routed' },
  // Promo/Tracking/Checkin (new-screens)
  { name: 'Promotions', slug: 'PromotionsNew', route: '/promotions', source: 'new-screens/promotions', icon: '🔥', status: 'routed' },
  { name: 'Order Tracking', slug: 'TrackOrderNew', route: '/track-order', source: 'new-screens/order-tracking', icon: '📍', status: 'routed' },
  { name: 'Checkin', slug: 'CheckinNew', route: '/checkin', source: 'new-screens/checkin', icon: '✅', status: 'routed' },
  { name: 'Contact', slug: 'ContactNew', route: '/contact', source: 'new-screens/contact', icon: '✉️', status: 'routed' },
  { name: 'Subscriptions', slug: 'SubscriptionsNew', route: '/subscriptions', source: 'new-screens/subscriptions', icon: '🔄', status: 'routed' },
  { name: 'Table Reservation', slug: 'ReservationNew', route: '/table-reservation', source: 'new-screens/table-reservation', icon: '📅', status: 'routed' },
  { name: 'Loyalty Calculator', slug: 'LoyaltyCalcNew', route: '/loyalty-calculator', source: 'new-screens/loyalty-calculator', icon: '🧮', status: 'routed' },
 // Converted 2026-07 — workflow batch + remaining 5 screens
 { name: 'Our Story', slug: 'StitchAbout', route: '/stitch/about', source: 'about', icon: '📖', status: 'routed' },
 { name: 'Customer Account', slug: 'StitchAccount', route: '/stitch/account', source: 'account', icon: '👤', status: 'routed' },
 { name: 'Admin Login', slug: 'StitchAdminLoginV2', route: '/stitch/admin-login-v2', source: 'admin-login', icon: '🔐', status: 'routed' },
 { name: 'Events & Promotions', slug: 'StitchEvents', route: '/stitch/events', source: 'events', icon: '🎫', status: 'routed' },
 { name: 'Mobile Ordering', slug: 'StitchMobile', route: '/stitch/mobile', source: 'mobile', icon: '📱', status: 'routed' },
// Batch converted (2026-07) — design.html → React/TSX
 { name: 'Landing v2 (Digital Reserve)', slug: 'StitchLandingV2', route: '/stitch/landing-v2', source: 'stitch-export-aura_cafe_digital_reserve_landing', icon: '✨', status: 'routed' },
 { name: 'Loyalty Rewards', slug: 'StitchLoyalty', route: '/stitch/loyalty', source: 'stitch-export-inspired-by-luxury-gold-dark', icon: '🏆', status: 'routed' },
 { name: 'Digital Menu (New)', slug: 'StitchMenuV2', route: '/stitch/menu-v2', source: 'stitch-export-lighting_concept-page10', icon: '📋', status: 'routed' },
 { name: 'Order Success', slug: 'StitchOrderSuccess', route: '/stitch/order-success', source: 'stitch-export-inspired-by-luxury-gold-dark', icon: '✅', status: 'routed' },
 { name: 'Referral Rewards', slug: 'StitchReferral', route: '/stitch/referral', source: 'stitch-export-inspired-by-luxury-gold-dark', icon: '🎁', status: 'routed' },
 { name: 'Customer Reviews', slug: 'StitchReviews', route: '/stitch/reviews', source: 'stitch-export-inspired-by-luxury-gold-dark', icon: '💬', status: 'routed' },
  // Not yet wired
  { name: 'Design Gallery', slug: 'GalleryNew', route: '/gallery', source: 'new-screens/design-gallery', icon: '🖼️', status: 'routed' },
  // 404
  { name: '404 Not Found', slug: 'NotFoundNew', route: '*', source: 'new-screens/404-not-found', icon: '🔍', status: 'routed' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  routed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  skipped: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function StitchGallery() {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [filter, setFilter] = useState('');

  const filtered = useCallback(
    (s: Screen) => {
      const catMatch = activeCategory === 'All' ||
        s.route?.includes(activeCategory.toLowerCase()) ||
        s.slug.toLowerCase().includes(activeCategory.toLowerCase());
      const textMatch = !filter ||
        s.name.toLowerCase().includes(filter.toLowerCase()) ||
        s.source.toLowerCase().includes(filter.toLowerCase());
      return catMatch && textMatch;
    },
    [activeCategory, filter]
  );

  const routedCount = SCREENS.filter(s => s.status === 'routed').length;
  const skipped = SCREENS.filter(s => s.status === 'skipped').length;
  const partial = SCREENS.filter(s => s.status === 'partial').length;

  return (
    <StitchShell>
      <StitchNav ctaLabel="View Screens" />

      {/* ── Hero Header ── */}
      <header className="pt-28 pb-12 px-5 md:px-16 max-w-[1280px] mx-auto">
        <div className="space-y-4">
          <span className="font-body text-xs uppercase tracking-[0.2em] text-[var(--aura-tertiary)]">
            FnB Container Caffe — Visual QA
          </span>
          <h1 className="font-display text-5xl md:text-7xl leading-tight text-[var(--aura-chrome-bright)] italic">
            Stitch Screen<br />Gallery
          </h1>
          <p className="font-body text-lg text-[var(--aura-chrome-mid)] max-w-2xl">
            {SCREENS.length} screens converted from Stitch design exports. Browse, filter, and preview each screen.
          </p>

          {/* Stats */}
          <div className="flex gap-6 pt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-body text-sm text-[var(--aura-chrome-mid)]">{routedCount} Routed</span>
            </div>
            {skipped > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-body text-sm text-[var(--aura-chrome-mid)]">{skipped} Skipped</span>
              </div>
            )}
            {partial > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-body text-sm text-[var(--aura-chrome-mid)]">{partial} Partial</span>
              </div>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="mt-8 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full font-body text-xs font-semibold uppercase tracking-widest transition-all active:scale-95 ${
                  activeCategory === cat
                    ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]'
                    : 'glass-panel text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="md:ml-auto">
            <input
              type="text"
              placeholder="Search screens..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="glass-panel px-4 py-2 rounded-lg font-body text-sm text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-mid)] w-full md:w-56 outline-none"
            />
          </div>
        </div>
      </header>

      {/* ── Grid ── */}
      <main className="px-5 md:px-16 max-w-[1280px] mx-auto pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {SCREENS.filter(filtered).map(screen => (
            <a
              key={screen.slug}
              href={screen.route ?? undefined}
              className={`glass-panel rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 group ${
                !screen.route ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
              }`}
            >
              {/* Icon bar */}
              <div className="h-24 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center border-b border-white/5">
                <span className="text-4xl group-hover:scale-110 transition-transform">{screen.icon}</span>
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-xl text-[var(--aura-chrome-bright)] group-hover:text-[var(--aura-tertiary)] transition-colors leading-tight">
                    {screen.name}
                  </h3>
                  <span className={`text-[9px] font-body font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[screen.status]}`}>
                    {screen.status}
                  </span>
                </div>

                <code className="font-body text-[10px] text-[var(--aura-chrome-mid)] bg-white/5 px-2 py-1 rounded">
                  src/pages/stitch/{screen.slug}/index.tsx
                </code>

                <div className="flex items-center justify-between mt-auto pt-2">
                  <code className="font-body text-[10px] text-[var(--aura-tertiary)] truncate flex-1">
                    {screen.route || '⚠ no route'}
                  </code>
                  {screen.route && (
                    <span className="text-[var(--aura-chrome-mid)] text-xs ml-2 group-hover:text-[var(--aura-tertiary)] transition-colors">
                      ↗
                    </span>
                  )}
                </div>

                <div className="text-[9px] font-body text-[var(--aura-chrome-mid)] tracking-wider uppercase">
                  Source: {screen.source}
                </div>
              </div>
            </a>
          ))}
        </div>

        {SCREENS.filter(filtered).length === 0 && (
          <div className="text-center py-20">
            <p className="font-display text-2xl text-[var(--aura-chrome-mid)] italic">No screens match</p>
            <button
              onClick={() => { setFilter(''); setActiveCategory('All'); }}
              className="mt-4 font-body text-xs uppercase tracking-widest text-[var(--aura-tertiary)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>
    </StitchShell>
  );
}
