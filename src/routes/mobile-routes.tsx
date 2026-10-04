import React from 'react';
import { Route } from 'react-router-dom';
import { MobileProtectedRoute } from '@/components/auth/MobileProtectedRoute';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import {
  MobileStationHost,
  MobileKdsHost,
  MobileNotificationsPage,
  MobileProfilePage,
} from '@/routes/mobile-route-hosts';

function guarded(element: React.ReactNode): React.ReactNode {
  return <ErrorBoundary>{element}</ErrorBoundary>;
}

const MobileLogin = React.lazy(() => import('@/pages/mobile/mobile-login'));
const KitchenDisplay = React.lazy(() => import('@/pages/mobile/kitchen-display'));
const WaiterOrders = React.lazy(() => import('@/pages/mobile/waiter-orders'));
const TableManager = React.lazy(() => import('@/pages/mobile/table-manager'));

export const mobileRoutes = [
  <Route key="/mobile/login" path="/mobile/login" element={guarded(<MobileLogin />)} />,

  <Route key="/mobile" path="/mobile" element={<MobileProtectedRoute />}>
    <Route
      path="kds"
      element={guarded(<MobileKdsHost />)}
    />
    <Route
      path="orders"
      element={
        <MobileStationHost title="Đơn hàng / Orders">
          {guarded(<WaiterOrders />)}
        </MobileStationHost>
      }
    />
    <Route
      path="tables"
      element={
        <MobileStationHost title="Bàn / Tables">
          {guarded(<TableManager />)}
        </MobileStationHost>
      }
    />
    <Route path="notifications" element={guarded(<MobileNotificationsPage />)} />
    <Route path="profile" element={guarded(<MobileProfilePage />)} />
    <Route path="/mobile" index element={guarded(<MobileKdsHost />)} />
  </Route>,
];
