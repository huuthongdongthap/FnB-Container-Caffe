import React from 'react';
import { Route } from 'react-router-dom';

const MobileLogin = React.lazy(() => import('@/pages/mobile/mobile-login'));
const MobileLayout = React.lazy(() => import('@/pages/mobile/mobile-layout'));
const KitchenDisplay = React.lazy(() => import('@/pages/mobile/kitchen-display'));
const WaiterOrders = React.lazy(() => import('@/pages/mobile/waiter-orders'));
const TableManager = React.lazy(() => import('@/pages/mobile/table-manager'));

export function MobileRoutes() {
  return (
    <>
      <Route path="/mobile/login" element={<MobileLogin />} />
      <Route path="/mobile" element={<MobileLayout />}>
        <Route path="kds" element={<KitchenDisplay />} />
        <Route path="orders" element={<WaiterOrders />} />
        <Route path="tables" element={<TableManager />} />
        <Route index element={<KitchenDisplay />} />
      </Route>
    </>
  );
}
