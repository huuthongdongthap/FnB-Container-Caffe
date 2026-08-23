import React from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

/** Wraps a route element in ErrorBoundary so a crash in one route doesn't take down the whole SPA. */
function guarded(element: React.ReactNode): React.ReactNode {
  return <ErrorBoundary>{element}</ErrorBoundary>;
}

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
  <Route key="/" path="/" element={guarded(<HomePage />)} />,
  <Route key="/menu" path="/menu" element={guarded(<MenuPage />)} />,
  <Route key="/checkout" path="/checkout" element={guarded(<CheckoutPage />)} />,
  <Route key="/order-success" path="/order-success" element={guarded(<OrderSuccessPage />)} />,
  <Route key="/order-failure" path="/order-failure" element={guarded(<OrderFailureNew />)} />,
  <Route key="/loyalty" path="/loyalty" element={guarded(<LoyaltyPage />)} />,
  <Route key="/loyalty-calculator" path="/loyalty-calculator" element={guarded(<LoyaltyCalcNew />)} />,
  <Route key="/referral" path="/referral" element={guarded(<ReferralPage />)} />,
  <Route key="/promotions" path="/promotions" element={guarded(<PromotionsNew />)} />,
  <Route key="/events" path="/events" element={guarded(<EventsPage />)} />,
  <Route key="/track-order" path="/track-order" element={guarded(<TrackOrderNew />)} />,
  <Route key="/kds" path="/kds" element={guarded(<KDSPage />)} />,
  <Route key="/table-reservation" path="/table-reservation" element={guarded(<ReservationNew />)} />,
  <Route key="/tv-menu" path="/tv-menu" element={guarded(<TVMenuPage />)} />,
  <Route key="/account" path="/account" element={guarded(<AccountPage />)} />,
  <Route key="/checkin" path="/checkin" element={guarded(<CheckinNew />)} />,
  <Route key="/table-checkin" path="/table-checkin" element={guarded(<TableCheckinPage />)} />,
  <Route key="/about" path="/about" element={guarded(<OurStory />)} />,
  <Route key="/reviews" path="/reviews" element={guarded(<CustomerAccountDashboard />)} />,
  <Route key="/subscriptions" path="/subscriptions" element={guarded(<SubscriptionsNew />)} />,
  <Route key="/contact" path="/contact" element={guarded(<ContactNew />)} />,
  <Route key="/brand" path="/brand" element={guarded(<BrandGuideline />)} />,
  <Route key="/order" path="/order" element={guarded(<TableOrder />)} />,
  <Route key="/container" path="/container" element={guarded(<ContainerPage />)} />,
  ...['vi', 'en'].flatMap((loc) => [
    <Route key={`/${loc}/order`} path={`/${loc}/order`} element={guarded(<LocaleOrderPage />)} />,
  ]),
  <Route key="/gallery" path="/gallery" element={guarded(<GalleryNew />)} />,
  <Route key="/saas/dashboard" path="/saas/dashboard" element={guarded(<CustomerDashboard />)} />,
  <Route key="/saas/onboard/tenant" path="/saas/onboard/tenant" element={guarded(<TenantCreate />)} />,
  <Route key="/saas/onboard" path="/saas/onboard" element={guarded(<OnboardingWizard />)} />,
  <Route key="/stitch-gallery-screen-showcase" path="/stitch-gallery-screen-showcase" element={guarded(<StitchScreenGallery />)} />,
];
