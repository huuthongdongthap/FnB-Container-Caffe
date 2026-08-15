import React from 'react';
import { Route } from 'react-router-dom';

const HomePage = React.lazy(() => import('@/pages/home'));
const MenuPage = React.lazy(() => import('@/pages/menu'));
const CheckoutPage = React.lazy(() => import('@/pages/checkout'));
const OrderSuccessPage = React.lazy(() => import('@/pages/order-success'));
const LoyaltyPage = React.lazy(() => import('@/pages/loyalty'));
const ReferralPage = React.lazy(() => import('@/pages/referral'));
const EventsPage = React.lazy(() => import('@/pages/events'));
const AccountPage = React.lazy(() => import('@/pages/account'));
const KDSPage = React.lazy(() => import('@/pages/KDS'));
const TVMenuPage = React.lazy(() => import('@/pages/TVMenu'));
const TableCheckinPage = React.lazy(() => import('@/pages/TableCheckin'));
const LocaleOrderPage = React.lazy(() => import('@/pages/[locale]/order'));
const PricingPage = React.lazy(() => import('@/pages/[locale]/pricing'));
const BrandGuideline = React.lazy(() => import('@/pages/BrandGuideline'));
const TableOrder = React.lazy(() => import('@/pages/TableOrder'));
const ContainerPage = React.lazy(() => import('@/pages/container'));
const CustomerDashboard = React.lazy(() => import('@/pages/saas/dashboard'));
const TenantCreate = React.lazy(() => import('@/pages/saas/onboard/tenant-create'));
const OnboardingWizard = React.lazy(() => import('@/pages/saas/onboard'));

const OrderFailureNew = React.lazy(() => import('@/pages/stitch/order-failure'));
const PromotionsNew = React.lazy(() => import('@/pages/stitch/promotions-new'));
const CheckinNew = React.lazy(() => import('@/pages/stitch/checkin-new'));
const ContactNew = React.lazy(() => import('@/pages/stitch/contact-new'));
const TrackOrderNew = React.lazy(() => import('@/pages/stitch/track-order'));
const ReservationNew = React.lazy(() => import('@/pages/stitch/reservation-new'));
const SubscriptionsNew = React.lazy(() => import('@/pages/stitch/subscriptions-new'));
const LoyaltyCalcNew = React.lazy(() => import('@/pages/stitch/loyalty-calc'));
const GalleryNew = React.lazy(() => import('@/pages/stitch/gallery-new'));
const OurStory = React.lazy(() => import('@/pages/stitch/our-story'));
const CustomerAccountDashboard = React.lazy(() => import('@/pages/stitch/customer-reviews'));
const StitchScreenGallery = React.lazy(() => import('@/pages/stitch-screen-gallery'));

export function PublicRoutes() {
  return (
    <>
      <Route path="/" element={<HomePage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/order-success" element={<OrderSuccessPage />} />
      <Route path="/order-failure" element={<OrderFailureNew />} />
      <Route path="/loyalty" element={<LoyaltyPage />} />
      <Route path="/loyalty-calculator" element={<LoyaltyCalcNew />} />
      <Route path="/referral" element={<ReferralPage />} />
      <Route path="/promotions" element={<PromotionsNew />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/track-order" element={<TrackOrderNew />} />
      <Route path="/kds" element={<KDSPage />} />
      <Route path="/table-reservation" element={<ReservationNew />} />
      <Route path="/tv-menu" element={<TVMenuPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/checkin" element={<CheckinNew />} />
      <Route path="/table-checkin" element={<TableCheckinPage />} />
      <Route path="/about" element={<OurStory />} />
      <Route path="/reviews" element={<CustomerAccountDashboard />} />
      <Route path="/subscriptions" element={<SubscriptionsNew />} />
      <Route path="/contact" element={<ContactNew />} />
      <Route path="/brand" element={<BrandGuideline />} />
      <Route path="/order" element={<TableOrder />} />
      <Route path="/container" element={<ContainerPage />} />
      {['vi', 'en'].map((loc) => (
        <Route key={loc} path={`/${loc}/order`} element={<LocaleOrderPage />} />
      ))}
      <Route path="/gallery" element={<GalleryNew />} />
      <Route path="/saas/dashboard" element={<CustomerDashboard />} />
      <Route path="/saas/onboard/tenant" element={<TenantCreate />} />
      <Route path="/saas/onboard" element={<OnboardingWizard />} />
      <Route path="/stitch-gallery-screen-showcase" element={<StitchScreenGallery />} />
    </>
  );
}
