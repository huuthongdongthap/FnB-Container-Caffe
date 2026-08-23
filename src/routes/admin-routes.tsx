import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AdminLayout from '@/pages/admin/AdminLayout';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

function guarded(element: React.ReactNode): React.ReactNode {
  return <ErrorBoundary>{element}</ErrorBoundary>;
}

const AdminBirthdayConfigPage = React.lazy(() => import('@/pages/admin/BirthdayConfig'));
const AdminCheckinApprovePage = React.lazy(() => import('@/pages/admin/CheckinApprove'));
const AdminCustomersPage = React.lazy(() => import('@/pages/admin/Customers'));
const AdminDashboardPage = React.lazy(() => import('@/pages/admin/Dashboard'));
const AdminERPNExtSyncPage = React.lazy(() => import('@/pages/admin/ERPNExtSync'));
const AdminNotificationSettingsPage = React.lazy(() => import('@/pages/admin/NotificationSettings'));
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
const AdminDinDinMenuPage = React.lazy(() => import('@/pages/admin/DinDinMenu'));
const AdminDinDinCartPage = React.lazy(() => import('@/pages/admin/DinDinCart'));
const AdminDinDinCheckoutPage = React.lazy(() => import('@/pages/admin/DinDinCheckout'));
const AdminDinDinOrderSuccessPage = React.lazy(() => import('@/pages/admin/DinDinOrderSuccess'));
const AdminDevicesPage = React.lazy(() => import('@/pages/admin/Devices'));
const TableManagementPage = React.lazy(() => import('@/pages/admin/TableManagement'));

export const adminRoutes = [
  <Route key="/admin/login" path="/admin/login" element={guarded(<AdminLoginPage />)} />,
  <Route key="/admin" element={<ProtectedRoute />}>
    <Route element={<AdminLayout />}>
      <Route path="/admin" element={guarded(<AdminDashboardPage />)} />
      <Route path="/admin/audit-logs" element={guarded(<AuditLogViewerPage />)} />
      <Route path="/admin/birthday-config" element={guarded(<AdminBirthdayConfigPage />)} />
      <Route path="/admin/broadcasts" element={guarded(<BroadcastPage />)} />
      <Route path="/admin/campaigns" element={guarded(<CampaignsManagerPage />)} />
      <Route path="/admin/chat" element={guarded(<ChatInboxPage />)} />
      <Route path="/admin/checkin-approve" element={guarded(<AdminCheckinApprovePage />)} />
      <Route path="/admin/customers" element={guarded(<AdminCustomersPage />)} />
      <Route path="/admin/dashboard" element={guarded(<AdminDashboardPage />)} />
      <Route path="/admin/erpnext-sync" element={guarded(<AdminERPNExtSyncPage />)} />
      <Route path="/admin/table-management" element={guarded(<TableManagementPage />)} />
      <Route path="/admin/generate-qr" element={guarded(<GenerateQRPage />)} />
      <Route path="/admin/invoice-history" element={guarded(<AdminInvoiceHistoryPage />)} />
      <Route path="/admin/manage-menu" element={guarded(<ManageMenuPage />)} />
      <Route path="/admin/notification-settings" element={guarded(<AdminNotificationSettingsPage />)} />
      <Route path="/admin/metrics" element={guarded(<AdminMetricsPage />)} />
      <Route path="/admin/orders" element={guarded(<AdminOrdersPage />)} />
      <Route path="/admin/pos" element={guarded(<AdminPOSPage />)} />
      <Route path="/admin/promotions" element={guarded(<PromotionsManagerPage />)} />
      <Route path="/admin/reservations" element={guarded(<AdminReservationsPage />)} />
      <Route path="/admin/sales-reports" element={guarded(<SalesReportsPage />)} />
      <Route path="/admin/staff" element={guarded(<AdminStaffPage />)} />
      <Route path="/admin/subscriptions" element={guarded(<SubscriptionsManagerPage />)} />
      <Route path="/admin/dindin/menu" element={guarded(<AdminDinDinMenuPage />)} />
      <Route path="/admin/dindin/cart" element={guarded(<AdminDinDinCartPage />)} />
      <Route path="/admin/dindin/checkout" element={guarded(<AdminDinDinCheckoutPage />)} />
      <Route path="/admin/dindin/success" element={guarded(<AdminDinDinOrderSuccessPage />)} />
      <Route path="/admin/devices" element={guarded(<AdminDevicesPage />)} />
    </Route>
  </Route>,
];
