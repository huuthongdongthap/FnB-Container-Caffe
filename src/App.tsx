import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/components/auth/AuthProvider';
import OfflineBanner from '@/components/pwa/offline-banner';
import OrderQueueIndicator from '@/components/pwa/OrderQueueIndicator';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { StitchAppLayout } from '@/components/stitch';
import CartBottomBar from '@/components/cart/cart-bottom-bar';
import { ToastProvider } from '@/components/ui/toast';
import { publicRoutes } from '@/routes/public-routes';
import { stitchRoutes } from '@/routes/stitch-routes';
import { mobileRoutes } from '@/routes/mobile-routes';
import { adminRoutes } from '@/routes/admin-routes';

const NotFoundNew = React.lazy(() => import('@/pages/stitch/not-found'));

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
        <StitchAppLayout>
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--aura-chrome-light)]">Loading...</div>}>
            <Routes>
              {...publicRoutes}
              {...stitchRoutes}
              {...mobileRoutes}
              {...adminRoutes}
              <Route path="*" element={<NotFoundNew />} />
            </Routes>
          </React.Suspense>
        </StitchAppLayout>
        <CartBottomBar />
      </ToastProvider>
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
