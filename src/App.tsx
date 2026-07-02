import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
import TrackOrderPage from '@/pages/TrackOrder';
import KDSPage from '@/pages/KDS';
import TableReservationPage from '@/pages/TableReservation';
import TVMenuPage from '@/pages/TVMenu';
import CheckinPage from '@/pages/Checkin';
import { AboutUs } from '@/pages/AboutUs';
import { Contact } from '@/pages/Contact';
import { BrandGuideline } from '@/pages/BrandGuideline';
import { NotFound } from '@/pages/NotFound';
import AdminDashboardPage from '@/pages/admin/Dashboard';
import AdminOrdersPage from '@/pages/admin/Orders';
import AdminPOSPage from '@/pages/admin/POS';
import AdminLoginPage from '@/pages/admin/Login';
import AdminCustomersPage from '@/pages/admin/Customers';
import AdminReservationsPage from '@/pages/admin/Reservations';
import AdminStaffPage from '@/pages/admin/Staff';
import AdminCheckinApprovePage from '@/pages/admin/CheckinApprove';
import AdminERPNExtSyncPage from '@/pages/admin/ERPNExtSync';
import AdminMetricsPage from '@/pages/admin/Metrics';

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
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Home page uses its own layout — no global header/footer
  if (isHome) {
    return (
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <StitchAppLayout>
        <Routes>
          {/* Public routes */}
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout.html" element={<CheckoutPage />} />
          <Route path="/order-success" element={<OrderSuccessPage />} />
          <Route path="/order-failure" element={<OrderFailurePage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/loyalty-calculator" element={<LoyaltyCalculatorPage />} />
          <Route path="/loyalty-calculator.html" element={<LoyaltyCalculatorPage />} />
          <Route path="/referral" element={<ReferralPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/track-order" element={<TrackOrderPage />} />
          <Route path="/kds" element={<KDSPage />} />
          <Route path="/table-reservation" element={<TableReservationPage />} />
          <Route path="/tv-menu" element={<TVMenuPage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/brand" element={<BrandGuideline />} />

          {/* Admin public routes (no auth required) */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Admin protected routes (auth required) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/pos" element={<AdminPOSPage />} />
            <Route path="/admin/customers" element={<AdminCustomersPage />} />
            <Route path="/admin/reservations" element={<AdminReservationsPage />} />
            <Route path="/admin/staff" element={<AdminStaffPage />} />
            <Route path="/admin/checkin-approve" element={<AdminCheckinApprovePage />} />
            <Route path="/admin/erpnext-sync" element={<AdminERPNExtSyncPage />} />
            <Route path="/admin/metrics" element={<AdminMetricsPage />} />
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
