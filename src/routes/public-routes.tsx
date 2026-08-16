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

export const publicRoutes = [
  <Route key="/" path="/" element={<HomePage />} />,
  <Route key="/menu" path="/menu" element={<MenuPage />} />,
  <Route key="/checkout" path="/checkout" element={<CheckoutPage />} />,
  <Route key="/order-success" path="/order-success" element={<OrderSuccessPage />} />,
  <Route key="/order-failure" path="/order-failure" element={<OrderFailureNew />} />,
  <Route key="/loyalty" path="/loyalty" element={<LoyaltyPage />} />,
  <Route key="/loyalty-calculator" path="/loyalty-calculator" element={<LoyaltyCalcNew />} />,
  <Route key="/referral" path="/referral" element={<ReferralPage />} />,
  <Route key="/promotions" path="/promotions" element={<PromotionsNew />} />,
  <Route key="/events" path="/events" element={<EventsPage />} />,
  <Route key="/track-order" path="/track-order" element={<TrackOrderNew />} />,
  <Route key="/kds" path="/kds" element={<KDSPage />} />,
  <Route key="/table-reservation" path="/table-reservation" element={<ReservationNew />} />,
  <Route key="/tv-menu" path="/tv-menu" element={<TVMenuPage />} />,
  <Route key="/account" path="/account" element={<AccountPage />} />,
  <Route key="/checkin" path="/checkin" element={<CheckinNew />} />,
  <Route key="/table-checkin" path="/table-checkin" element={<TableCheckinPage />} />,
  <Route key="/about" path="/about" element={<OurStory />} />,
  <Route key="/reviews" path="/reviews" element={<CustomerAccountDashboard />} />,
  <Route key="/subscriptions" path="/subscriptions" element={<SubscriptionsNew />} />,
  <Route key="/contact" path="/contact" element={<ContactNew />} />,
  <Route key="/brand" path="/brand" element={<BrandGuideline />} />,
  <Route key="/order" path="/order" element={<TableOrder />} />,
  <Route key="/container" path="/container" element={<ContainerPage />} />,
  ...['vi', 'en'].flatMap((loc) => [
    <Route key={`/${loc}/order`} path={`/${loc}/order`} element={<LocaleOrderPage />} />,
  ]),
  <Route key="/gallery" path="/gallery" element={<GalleryNew />} />,
  <Route key="/saas/dashboard" path="/saas/dashboard" element={<CustomerDashboard />} />,
  <Route key="/saas/onboard/tenant" path="/saas/onboard/tenant" element={<TenantCreate />} />,
  <Route key="/saas/onboard" path="/saas/onboard" element={<OnboardingWizard />} />,
  <Route key="/stitch-gallery-screen-showcase" path="/stitch-gallery-screen-showcase" element={<StitchScreenGallery />} />,
];
