import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const MobileLogin = React.lazy(() => import('@/pages/mobile/mobile-login'));
const MobileLayout = React.lazy(() => import('@/pages/mobile/mobile-layout'));
const KitchenDisplay = React.lazy(() => import('@/pages/mobile/kitchen-display'));
const WaiterOrders = React.lazy(() => import('@/pages/mobile/waiter-orders'));
const TableManager = React.lazy(() => import('@/pages/mobile/table-manager'));

export const mobileRoutes = [
  <Route key="/mobile/login" path="/mobile/login" element={<MobileLogin />} />,
  <Route key="/mobile" path="/mobile" element={<ProtectedRoute />}>
    <Route element={<MobileLayout />}>
      <Route path="kds" element={<KitchenDisplay />} />
      <Route path="orders" element={<WaiterOrders />} />
      <Route path="tables" element={<TableManager />} />
      <Route index element={<KitchenDisplay />} />
    </Route>
  </Route>,
];
