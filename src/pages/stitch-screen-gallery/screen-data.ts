/* ── Stitch Screen Gallery — Screen Data ───────────────────────── */

import type { Screen } from './types';

export const CATEGORIES = ['All', 'Landing', 'Menu', 'Ordering', 'Admin', 'Events', 'Account'] as const;

export const SCREENS: Screen[] = [
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
