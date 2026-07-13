import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/components/auth/AuthProvider';
import OfflineBanner from '@/components/pwa/offline-banner';
import OrderQueueIndicator from '@/components/pwa/OrderQueueIndicator';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { StitchAppLayout } from '@/components/stitch';
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
import TableManagementPage from '@/pages/admin/TableManagement';
import LocaleOrderPage from "@/pages/[locale]/order";
import { BrandGuideline } from '@/pages/BrandGuideline';
import TableOrder from '@/pages/TableOrder';
import { ContainerPage } from '@/pages/container';
const StitchScreenGallery = React.lazy(() => import('@/pages/stitch-screen-gallery'));
const MobileLogin = React.lazy(() => import('@/pages/mobile/mobile-login'));
const MobileLayout = React.lazy(() => import('@/pages/mobile/mobile-layout'));
const KitchenDisplay = React.lazy(() => import('@/pages/mobile/kitchen-display'));
const WaiterOrders = React.lazy(() => import('@/pages/mobile/waiter-orders'));
const TableManager = React.lazy(() => import('@/pages/mobile/table-manager'));
// Stitch screens (src/pages/stitch/)
const StitchAdminOrders = React.lazy(() => import('@/pages/stitch/admin-orders'));
const StitchAdminPOS = React.lazy(() => import('@/pages/stitch/admin-pos'));
const StitchAdminV2 = React.lazy(() => import('@/pages/stitch/admin-v2'));
const StitchCheckout = React.lazy(() => import('@/pages/stitch/checkout'));
const StitchAdminLogin = React.lazy(() => import('@/pages/stitch/admin-login'));
const AdminBirthdayConfigPage = React.lazy(() => import('@/pages/admin/BirthdayConfig'));

const AdminCheckinApprovePage = React.lazy(() => import('@/pages/admin/CheckinApprove'));
const AdminCustomersPage = React.lazy(() => import('@/pages/admin/Customers'));
const AdminDashboardPage = React.lazy(() => import('@/pages/admin/Dashboard'));
const AdminERPNExtSyncPage = React.lazy(() => import('@/pages/admin/ERPNExtSync'));
const AdminNotificationSettingsPage = React.lazy(() => import('@/pages/admin/NotificationSettings'));
const AdminInvoiceHistoryPage = React.lazy(() => import('@/pages/admin/InvoiceHistory'));
const AdminLoginPage = React.lazy(() => import('@/pages/admin/Login'));
const AdminMetricsPage = React.lazy(() => import('@/pages/admin/Metrics'));
const AdminOrdersPage = React.lazy(() => import('@/pages/admin/Orders'));
const AdminPOSPage = React.lazy(() => import('@/pages/admin/POS'));
const AdminReservationsPage = React.lazy(() => import('@/pages/admin/Reservations'));
const AdminStaffPage = React.lazy(() => import('@/pages/admin/Staff'));
const AuditLogViewerPage = React.lazy(() => import('@/pages/admin/AuditLogViewer'));
const BroadcastPage = React.lazy(() => import('@/pages/admin/BroadcastPage'));
const CampaignsManagerPage = React.lazy(() => import('@/pages/admin/CampaignsManager'));
const ChatInboxPage = React.lazy(() => import('@/pages/admin/ChatInbox'));
const GenerateQRPage = React.lazy(() => import('@/pages/admin/GenerateQR'));
const ManageMenuPage = React.lazy(() => import('@/pages/admin/ManageMenu'));
const PromotionsManagerPage = React.lazy(() => import('@/pages/admin/PromotionsManager'));
const SalesReportsPage = React.lazy(() => import('@/pages/admin/SalesReports'));
const SubscriptionsManagerPage = React.lazy(() => import('@/pages/admin/SubscriptionsManager'));
const AdminDinDinMenuPage = React.lazy(() => import('@/pages/admin/DinDinMenu'));
const AdminDinDinCartPage = React.lazy(() => import('@/pages/admin/DinDinCart'));
const AdminDinDinCheckoutPage = React.lazy(() => import('@/pages/admin/DinDinCheckout'));
const AdminDinDinOrderSuccessPage = React.lazy(() => import('@/pages/admin/DinDinOrderSuccess'));
const AdminDevicesPage = React.lazy(() => import('@/pages/admin/Devices'));
import AdminLayout from '@/pages/admin/AdminLayout';

const OrderFailureNew = React.lazy(() => import('@/pages/stitch/order-failure'));
const PromotionsNew = React.lazy(() => import('@/pages/stitch/promotions-new'));
const CheckinNew = React.lazy(() => import('@/pages/stitch/checkin-new'));
const ContactNew = React.lazy(() => import('@/pages/stitch/contact-new'));
const TrackOrderNew = React.lazy(() => import('@/pages/stitch/track-order'));
const ReservationNew = React.lazy(() => import('@/pages/stitch/reservation-new'));
const SubscriptionsNew = React.lazy(() => import('@/pages/stitch/subscriptions-new'));
const LoyaltyCalcNew = React.lazy(() => import('@/pages/stitch/loyalty-calc'));
const NotFoundNew = React.lazy(() => import('@/pages/stitch/not-found'));
const GalleryNew = React.lazy(() => import('@/pages/stitch/gallery-new'));
const LuxuryLandingHero = React.lazy(() => import('@/pages/stitch/luxury-landing-hero'));
const LuxuryContainerCafe1 = React.lazy(() => import('@/pages/stitch/luxury-cafe-1'));
const LuxuryContainerCafe2 = React.lazy(() => import('@/pages/stitch/luxury-cafe-2'));
const LuxuryContainerLanding = React.lazy(() => import('@/pages/stitch/luxury-landing'));
const CustomerAccount = React.lazy(() => import('@/pages/stitch/customer-account'));
const CustomerAccountDashboard = React.lazy(() => import('@/pages/stitch/customer-reviews'));
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
const AdminTerminal = React.lazy(() => import('@/pages/stitch/admin-terminal'));
const OurStory = React.lazy(() => import('@/pages/stitch/our-story'));
const PremiumCheckout = React.lazy(() => import('@/pages/stitch/premium-checkout'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppBanner() {
  const { isOnline } = useOnlineStatus();
  return <OfflineBanner isOnline={isOnline} />;
}

function AppContent() {
  return (
    <AuthProvider>
      <AppBanner />
      <OrderQueueIndicator />
      <StitchAppLayout>
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--aura-chrome-light)]">Loading...</div>}>
      <Routes>
          {/* Public routes */}
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
<Route path="/stitch-gallery-screen-showcase" element={<StitchScreenGallery />} />

 
{/* Stitch screens */}
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
{/* Admin screens */}
<Route path="/stitch/admin-orders" element={<StitchAdminOrders />} />
<Route path="/stitch/admin-pos" element={<StitchAdminPOS />} />
<Route path="/stitch/admin-v2" element={<StitchAdminV2 />} />
{/* Customer screens */}
{/* Mobile staff app — protected via staff-auth middleware */ }
 <Route path="/mobile/login" element={<MobileLogin />} />
 <Route path="/mobile" element={<MobileLayout />}>
   <Route path="kds" element={<KitchenDisplay />} />
   <Route path="orders" element={<WaiterOrders />} />
   <Route path="tables" element={<TableManager />} />
   <Route index element={<KitchenDisplay />} />
 </Route>

          {/* Admin public routes (no auth required) */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Admin protected routes (auth required) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogViewerPage />} />
            <Route path="/admin/birthday-config" element={<AdminBirthdayConfigPage />} />
            <Route path="/admin/broadcasts" element={<BroadcastPage />} />
            <Route path="/admin/campaigns" element={<CampaignsManagerPage />} />
            <Route path="/admin/chat" element={<ChatInboxPage />} />
            <Route path="/admin/checkin-approve" element={<AdminCheckinApprovePage />} />
            <Route path="/admin/customers" element={<AdminCustomersPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/erpnext-sync" element={<AdminERPNExtSyncPage />} />
      <Route path="/admin/table-management" element={<TableManagementPage />} />
            <Route path="/admin/generate-qr" element={<GenerateQRPage />} />
            <Route path="/admin/invoice-history" element={<AdminInvoiceHistoryPage />} />
            <Route path="/admin/manage-menu" element={<ManageMenuPage />} />
<Route path="/admin/notification-settings" element={<AdminNotificationSettingsPage />} />
            <Route path="/admin/metrics" element={<AdminMetricsPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/pos" element={<AdminPOSPage />} />
            <Route path="/admin/promotions" element={<PromotionsManagerPage />} />
            <Route path="/admin/reservations" element={<AdminReservationsPage />} />
            <Route path="/admin/sales-reports" element={<SalesReportsPage />} />
            <Route path="/admin/staff" element={<AdminStaffPage />} />
            <Route path="/admin/subscriptions" element={<SubscriptionsManagerPage />} />
        <Route path="/admin/dindin/menu" element={<AdminDinDinMenuPage />} />
        <Route path="/admin/dindin/cart" element={<AdminDinDinCartPage />} />
        <Route path="/admin/dindin/checkout" element={<AdminDinDinCheckoutPage />} />
        <Route path="/admin/dindin/success" element={<AdminDinDinOrderSuccessPage />} />
    <Route path="/admin/devices" element={<AdminDevicesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundNew />} />
            </Routes>
  </React.Suspense>
      </StitchAppLayout>
    </AuthProvider>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
