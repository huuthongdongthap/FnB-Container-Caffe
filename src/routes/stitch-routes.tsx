import React from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

function guarded(element: React.ReactNode): React.ReactNode {
  return <ErrorBoundary>{element}</ErrorBoundary>;
}

const StitchAdminOrders = React.lazy(() => import('@/pages/stitch/admin-orders'));
const StitchAdminPOS = React.lazy(() => import('@/pages/stitch/admin-pos'));
const StitchAdminV2 = React.lazy(() => import('@/pages/stitch/admin-v2'));
const StitchCheckout = React.lazy(() => import('@/pages/stitch/checkout'));
const LuxuryLandingHero = React.lazy(() => import('@/pages/stitch/luxury-landing-hero'));
const LuxuryContainerCafe1 = React.lazy(() => import('@/pages/stitch/luxury-cafe-1'));
const LuxuryContainerCafe2 = React.lazy(() => import('@/pages/stitch/luxury-cafe-2'));
const LuxuryContainerLanding = React.lazy(() => import('@/pages/stitch/luxury-landing'));
const CustomerAccount = React.lazy(() => import('@/pages/stitch/customer-account'));
const LoyaltyRewardsDashboard = React.lazy(() => import('@/pages/stitch/loyalty-rewards'));
const ReferralRewards1 = React.lazy(() => import('@/pages/stitch/referral-rewards-1'));
const ReferralRewards2 = React.lazy(() => import('@/pages/stitch/referral-rewards-2'));
const DigitalMenu = React.lazy(() => import('@/pages/stitch/digital-menu'));
const DigitalMenu2 = React.lazy(() => import('@/pages/stitch/digital-menu-2'));
const MobileOrdering = React.lazy(() => import('@/pages/stitch/mobile-ordering'));
const EventsPromotions1 = React.lazy(() => import('@/pages/stitch/events-promotions-1'));
const EventsPromotions2 = React.lazy(() => import('@/pages/stitch/events-promotions-2'));
const KitchenDisplaySystem = React.lazy(() => import('@/pages/stitch/kitchen-display'));
const OrderManagementTerminal = React.lazy(() => import('@/pages/stitch/order-management'));
const OrderSuccessConfirmation = React.lazy(() => import('@/pages/stitch/order-success'));
const PremiumCheckout = React.lazy(() => import('@/pages/stitch/premium-checkout'));
const AdminTerminal = React.lazy(() => import('@/pages/stitch/admin-terminal'));

export const stitchRoutes = [
  <Route key="/stitch/landing" path="/stitch/landing" element={guarded(<LuxuryLandingHero />)} />,
  <Route key="/stitch/container-landing" path="/stitch/container-landing" element={guarded(<LuxuryContainerLanding />)} />,
  <Route key="/stitch/container-cafe-1" path="/stitch/container-cafe-1" element={guarded(<LuxuryContainerCafe1 />)} />,
  <Route key="/stitch/container-cafe-2" path="/stitch/container-cafe-2" element={guarded(<LuxuryContainerCafe2 />)} />,
  <Route key="/stitch/customer-account" path="/stitch/customer-account" element={guarded(<CustomerAccount />)} />,
  <Route key="/stitch/loyalty" path="/stitch/loyalty" element={guarded(<LoyaltyRewardsDashboard />)} />,
  <Route key="/stitch/referral-1" path="/stitch/referral-1" element={guarded(<ReferralRewards1 />)} />,
  <Route key="/stitch/referral-2" path="/stitch/referral-2" element={guarded(<ReferralRewards2 />)} />,
  <Route key="/stitch/menu" path="/stitch/menu" element={guarded(<DigitalMenu />)} />,
  <Route key="/stitch/menu-2" path="/stitch/menu-2" element={guarded(<DigitalMenu2 />)} />,
  <Route key="/stitch/mobile-ordering" path="/stitch/mobile-ordering" element={guarded(<MobileOrdering />)} />,
  <Route key="/stitch/events-1" path="/stitch/events-1" element={guarded(<EventsPromotions1 />)} />,
  <Route key="/stitch/events-2" path="/stitch/events-2" element={guarded(<EventsPromotions2 />)} />,
  <Route key="/stitch/kds" path="/stitch/kds" element={guarded(<KitchenDisplaySystem />)} />,
  <Route key="/stitch/order-management" path="/stitch/order-management" element={guarded(<OrderManagementTerminal />)} />,
  <Route key="/stitch/order-success" path="/stitch/order-success" element={guarded(<OrderSuccessConfirmation />)} />,
  <Route key="/stitch/premium-checkout" path="/stitch/premium-checkout" element={guarded(<PremiumCheckout />)} />,
  <Route key="/stitch/admin-terminal" path="/stitch/admin-terminal" element={guarded(<AdminTerminal />)} />,
  <Route key="/stitch/admin-orders" path="/stitch/admin-orders" element={guarded(<StitchAdminOrders />)} />,
  <Route key="/stitch/admin-pos" path="/stitch/admin-pos" element={guarded(<StitchAdminPOS />)} />,
  <Route key="/stitch/admin-v2" path="/stitch/admin-v2" element={guarded(<StitchAdminV2 />)} />,
];
