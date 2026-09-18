import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/components/auth/AuthProvider';
import OfflineBanner from '@/components/pwa/offline-banner';
import OrderQueueIndicator from '@/components/pwa/OrderQueueIndicator';
import { useOnlineStatus } from '@/hooks/use-online-status';
import CustomerShell from '@/components/stitch/CustomerShell';
import OpsShell from '@/components/stitch/OpsShell';
import CartBottomBar from '@/components/cart/cart-bottom-bar';
import { ToastProvider } from '@/components/ui/toast';
import { publicRoutes } from '@/routes/public-routes';
import { stitchRoutes } from '@/routes/stitch-routes';
import { mobileRoutes } from '@/routes/mobile-routes';
import { adminRoutes } from '@/routes/admin-routes';

const NotFoundNew = React.lazy(() => import('@/pages/stitch/not-found'));
const KDSPage = React.lazy(() => import('@/pages/KDS'));
const TVMenuPage = React.lazy(() => import('@/pages/TVMenu'));
const TableOrder = React.lazy(() => import('@/pages/TableOrder'));

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
      <ToastProvider>
        <AppBanner />
        <OrderQueueIndicator />
        <BrowserRouter>
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--md-sys-color-on-surface-variant)]">Loading...</div>}>
            <Routes>
              {/* ── OPS SHELL ── */}
              <Route element={<OpsShell />}>
                <Route path="/kds" element={<KDSPage />} />
                <Route path="/tv-menu" element={<TVMenuPage />} />
                <Route path="/pos/table/:tableId" element={<TableOrder />} />
              </Route>

              {/* ── ADMIN ROUTES ── */}
              {adminRoutes}

              {/* ── MOBILE ROUTES ── */}
              {mobileRoutes}

              {/* ── CUSTOMER SHELL ── */}
              <Route element={<CustomerShell />}>
                {publicRoutes}
                {stitchRoutes}
              </Route>

              <Route path="*" element={<NotFoundNew />} />
            </Routes>
          </React.Suspense>
          <CartBottomBar />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
