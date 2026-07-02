import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { TableProvider } from '@/hooks/use-table-context';
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
import ManageMenuPage from '@/pages/admin/ManageMenu';
import GenerateQRPage from '@/pages/admin/GenerateQR';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed silently
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <TableProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<HomePage />} />
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
                  <Route path="/admin/menu" element={<ManageMenuPage />} />
                  <Route path="/admin/metrics" element={<AdminMetricsPage />} />
                  <Route path="/admin/qr-codes" element={<GenerateQRPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <PwaInstallBanner />
          </div>
          </TableProvider>
        </AuthProvider>
      </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  );
}
