import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider } from '@/components/auth/AuthProvider';
import OfflineBanner from '@/components/pwa/offline-banner';
import OrderQueueIndicator from '@/components/pwa/OrderQueueIndicator';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { StitchAppLayout } from '@/components/stitch';
import { PublicRoutes } from '@/routes/public-routes';
import { StitchRoutes } from '@/routes/stitch-routes';
import { MobileRoutes } from '@/routes/mobile-routes';
import { AdminRoutes } from '@/routes/admin-routes';

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
      <AppBanner />
      <OrderQueueIndicator />
      <StitchAppLayout>
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--aura-chrome-light)]">Loading...</div>}>
          <Routes>
            <PublicRoutes />
            <StitchRoutes />
            <MobileRoutes />
            <AdminRoutes />
            <NotFoundNew />
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
