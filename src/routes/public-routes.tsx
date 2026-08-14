import React from 'react';
import { Route } from 'react-router-dom';
import { HomePage } from '@/pages/home';
import { MenuPage } from '@/pages/menu';
import { CheckoutPage } from '@/pages/checkout';
import { OrderSuccessPage } from '@/pages/order-success';
import { LoyaltyPage } from '@/pages/loyalty';
import { ReferralPage } from '@/pages/referral';
import { EventsPage } from '@/pages/events';
import AccountPage from '@/pages/account';
import KDSPage from '@/pages/KDS';
import TVMenuPage from '@/pages/TVMenu';
import TableCheckinPage from '@/pages/TableCheckin';
import LocaleOrderPage from '@/pages/[locale]/order';
import PricingPage from '@/pages/[locale]/pricing';
import { BrandGuideline } from '@/pages/BrandGuideline';
import TableOrder from '@/pages/TableOrder';
import { ContainerPage } from '@/pages/container';
import CustomerDashboard from '@/pages/saas/dashboard';
import TenantCreate from '@/pages/saas/onboard/tenant-create';
import OnboardingWizard from '@/pages/saas/onboard';

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
