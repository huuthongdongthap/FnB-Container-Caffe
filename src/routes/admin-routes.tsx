import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AdminLayout from '@/pages/admin/AdminLayout';

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

export function AdminRoutes() {
  return (
    <>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogViewerPage />} />
          <Route path="/admin/birthday-config" element={<AdminBirthdayConfigPage />} />
          <Route path="/admin/broadcasts" element={<BroadcastPage />} />
          <Route path="/admin/campaigns" element={<CampaignsManagerPage />} />
          <Route path="/admin/chat" element={<ChatInboxPage />} />
          <Route path="/admin/checkin-approve" element={<AdminCheckinApprovePage />} />
          <Route path="/admin/customers" element={<AdminCustomersPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/erpnext-sync" element={<AdminERPNExtSyncPage />} />
          <Route path="/admin/table-management" element={<TableManagementPage />} />
          <Route path="/admin/generate-qr" element={<GenerateQRPage />} />
          <Route path="/admin/invoice-history" element={<AdminInvoiceHistoryPage />} />
          <Route path="/admin/manage-menu" element={<ManageMenuPage />} />
          <Route path="/admin/notification-settings" element={<AdminNotificationSettingsPage />} />
          <Route path="/admin/metrics" element={<AdminMetricsPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/pos" element={<AdminPOSPage />} />
          <Route path="/admin/promotions" element={<PromotionsManagerPage />} />
          <Route path="/admin/reservations" element={<AdminReservationsPage />} />
          <Route path="/admin/sales-reports" element={<SalesReportsPage />} />
          <Route path="/admin/staff" element={<AdminStaffPage />} />
          <Route path="/admin/subscriptions" element={<SubscriptionsManagerPage />} />
          <Route path="/admin/dindin/menu" element={<AdminDinDinMenuPage />} />
          <Route path="/admin/dindin/cart" element={<AdminDinDinCartPage />} />
          <Route path="/admin/dindin/checkout" element={<AdminDinDinCheckoutPage />} />
          <Route path="/admin/dindin/success" element={<AdminDinDinOrderSuccessPage />} />
          <Route path="/admin/devices" element={<AdminDevicesPage />} />
        </Route>
      </Route>
    </>
  );
}
