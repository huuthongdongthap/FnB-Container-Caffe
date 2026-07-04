import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { StitchAppLayout } from '@/components/stitch';
import { HomePage } from '@/pages/home';
import { MenuPage } from '@/pages/menu';
import { CheckoutPage } from '@/pages/checkout';
import { OrderSuccessPage } from '@/pages/order-success';
import { OrderFailurePage } from '@/pages/order-failure';
import { LoyaltyPage } from '@/pages/loyalty';
import { LoyaltyCalculatorPage } from '@/pages/loyalty-calculator';
import { ReferralPage } from '@/pages/referral';
import { PromotionsPage } from '@/pages/promotions';
import { EventsPage } from '@/pages/events';
import AccountPage from '@/pages/account';
import TrackOrderPage from '@/pages/TrackOrder';
import KDSPage from '@/pages/KDS';
import TableReservationPage from '@/pages/TableReservation';
import TVMenuPage from '@/pages/TVMenu';
import CheckinPage from '@/pages/Checkin';
import StitchAbout from '@/components/stitch/StitchAbout';
import { ReviewsPage } from '@/pages/ReviewsPage';
import { Contact } from '@/pages/Contact';
import { ContainerPage } from '@/pages/container';
import { BrandGuideline } from '@/pages/BrandGuideline';
import { OrderPage } from '@/pages/order';
import { NotFound } from '@/pages/NotFound';
import SubscriptionsPage from '@/pages/subscriptions';
const AdminBirthdayConfigPage = React.lazy(() => import('@/pages/admin/BirthdayConfig'));
const AdminCheckinApprovePage = React.lazy(() => import('@/pages/admin/CheckinApprove'));
const AdminCustomersPage = React.lazy(() => import('@/pages/admin/Customers'));
const AdminDashboardPage = React.lazy(() => import('@/pages/admin/Dashboard'));
const AdminERPNExtSyncPage = React.lazy(() => import('@/pages/admin/ERPNExtSync'));
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
import AdminLayout from '@/pages/admin/AdminLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  return (
    <AuthProvider>
      <StitchAppLayout>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-success" element={<OrderSuccessPage />} />
          <Route path="/order-failure" element={<OrderFailurePage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/loyalty-calculator" element={<LoyaltyCalculatorPage />} />
          <Route path="/referral" element={<ReferralPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/track-order" element={<TrackOrderPage />} />
          <Route path="/kds" element={<KDSPage />} />
          <Route path="/table-reservation" element={<TableReservationPage />} />
          <Route path="/tv-menu" element={<TVMenuPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/about" element={<StitchAbout />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/brand" element={<BrandGuideline />} />
          <Route path="/order" element={<OrderPage />} />
          <Route path="/container" element={<ContainerPage />} />

          {/* Admin public routes (no auth required) */}
          <Route path="/admin/login" element={<React.Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--aura-chrome-light)]">Loading...</div>}><AdminLoginPage /></React.Suspense>} />

          {/* Admin protected routes (auth required) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<React.Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--aura-chrome-light)]">Loading...</div>}><AdminLayout /></React.Suspense>}>
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
            <Route path="/admin/generate-qr" element={<GenerateQRPage />} />
            <Route path="/admin/invoice-history" element={<AdminInvoiceHistoryPage />} />
            <Route path="/admin/manage-menu" element={<ManageMenuPage />} />
            <Route path="/admin/metrics" element={<AdminMetricsPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/pos" element={<AdminPOSPage />} />
            <Route path="/admin/promotions" element={<PromotionsManagerPage />} />
            <Route path="/admin/reservations" element={<AdminReservationsPage />} />
            <Route path="/admin/sales-reports" element={<SalesReportsPage />} />
            <Route path="/admin/staff" element={<AdminStaffPage />} />
            <Route path="/admin/subscriptions" element={<SubscriptionsManagerPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
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
