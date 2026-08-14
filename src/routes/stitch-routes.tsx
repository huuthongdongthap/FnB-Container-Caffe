import React from 'react';
import { Route } from 'react-router-dom';

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

export function StitchRoutes() {
  return (
    <>
      <Route path="/stitch/landing" element={<LuxuryLandingHero />} />
      <Route path="/stitch/container-landing" element={<LuxuryContainerLanding />} />
      <Route path="/stitch/container-cafe-1" element={<LuxuryContainerCafe1 />} />
      <Route path="/stitch/container-cafe-2" element={<LuxuryContainerCafe2 />} />
      <Route path="/stitch/customer-account" element={<CustomerAccount />} />
      <Route path="/stitch/loyalty" element={<LoyaltyRewardsDashboard />} />
      <Route path="/stitch/referral-1" element={<ReferralRewards1 />} />
      <Route path="/stitch/referral-2" element={<ReferralRewards2 />} />
      <Route path="/stitch/menu" element={<DigitalMenu />} />
      <Route path="/stitch/menu-2" element={<DigitalMenu2 />} />
      <Route path="/stitch/mobile-ordering" element={<MobileOrdering />} />
      <Route path="/stitch/events-1" element={<EventsPromotions1 />} />
      <Route path="/stitch/events-2" element={<EventsPromotions2 />} />
      <Route path="/stitch/kds" element={<KitchenDisplaySystem />} />
      <Route path="/stitch/order-management" element={<OrderManagementTerminal />} />
      <Route path="/stitch/order-success" element={<OrderSuccessConfirmation />} />
      <Route path="/stitch/premium-checkout" element={<PremiumCheckout />} />
      <Route path="/stitch/admin-terminal" element={<AdminTerminal />} />
      <Route path="/stitch/admin-orders" element={<StitchAdminOrders />} />
      <Route path="/stitch/admin-pos" element={<StitchAdminPOS />} />
      <Route path="/stitch/admin-v2" element={<StitchAdminV2 />} />
    </>
  );
}
