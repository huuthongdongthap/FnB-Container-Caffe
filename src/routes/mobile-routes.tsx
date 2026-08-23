import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

function guarded(element: React.ReactNode): React.ReactNode {
  return <ErrorBoundary>{element}</ErrorBoundary>;
}

const MobileLogin = React.lazy(() => import('@/pages/mobile/mobile-login'));
const MobileLayout = React.lazy(() => import('@/pages/mobile/mobile-layout'));
const KitchenDisplay = React.lazy(() => import('@/pages/mobile/kitchen-display'));
const WaiterOrders = React.lazy(() => import('@/pages/mobile/waiter-orders'));
const TableManager = React.lazy(() => import('@/pages/mobile/table-manager'));

export const mobileRoutes = [
  <Route key="/mobile/login" path="/mobile/login" element={guarded(<MobileLogin />)} />,
  <Route key="/mobile" path="/mobile" element={<ProtectedRoute />}>
    <Route element={<MobileLayout />}>
      <Route path="kds" element={guarded(<KitchenDisplay />)} />
      <Route path="orders" element={guarded(<WaiterOrders />)} />
      <Route path="tables" element={guarded(<TableManager />)} />
      <Route index element={guarded(<KitchenDisplay />)} />
    </Route>
  </Route>,
];
