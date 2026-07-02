import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { StatsCard } from '@/components/admin/StatsCard';
import { StuckPaymentsCard } from '@/components/admin/StuckPaymentsCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { OrderTable } from '@/components/admin/OrderTable';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { useAdmin } from '@/hooks/use-admin';

export default function AdminDashboardPage() {
  const { stats, loading: statsLoading, error: statsError, fetchDashboard } = useAdminDashboardStore();
  const { orders, loading: ordersLoading, fetchOrders } = useAdminOrdersStore();
  const { customers, isLoadingCustomers } = useAdmin();

  useEffect(() => {
    fetchDashboard();
    fetchOrders();
  }, [fetchDashboard, fetchOrders]);

  if (statsError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-border bg-red-50 p-4 text-sm text-red-700">
            {statsError}
            <button
              onClick={() => fetchDashboard()}
              className="ml-3 underline hover:no-underline"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 font-display text-2xl font-bold">Dashboard</h1>

        {/* Stuck Payments Alert (owner-only, hidden when clean) */}
        <div className="mb-6">
          <StuckPaymentsCard />
        </div>

        {/* Stats Cards — responsive grid with subtle stagger */}
        <div className="stagger-reveal mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Doanh thu hôm nay"
            value={stats?.todayRevenue ?? 0}
            type="revenue"
            icon="💰"
            change={stats ? { value: 12, isPositive: true } : undefined}
          />
          <StatsCard
            title="Đơn hàng"
            value={stats?.todayOrders ?? 0}
            type="count"
            icon="📋"
          />
          <StatsCard
            title="Khách hàng"
            value={stats?.activeCustomers ?? 0}
            type="count"
            icon="👥"
          />
          <StatsCard
            title="Giá trị TB"
            value={stats?.avgOrderValue ?? 0}
            type="revenue"
            icon="📊"
          />
        </div>

        {/* Revenue Chart */}
        <div className="mb-6 card-hover">
          <RevenueChart
            data={generateMockChartData()}
            period="daily"
          />
        </div>

        {/* Recent Orders */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Đơn hàng gần đây</h2>
            <span className="text-xs text-muted">
              {ordersLoading ? 'Đang tải...' : `${orders.length} đơn`}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-white/80 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg">
            <OrderTable orders={orders.slice(0, 10)} sortBy="date" />
          </div>
        </div>

        {/* Top Customers */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Khách hàng thân thiết</h2>
            <span className="text-xs text-muted">
              {isLoadingCustomers ? 'Đang tải...' : `${customers.length} khách`}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-white/80 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg">
            <CustomerTable customers={customers.slice(0, 5)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function generateMockChartData() {
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return days.map((day) => ({
    label: day,
    value: Math.floor(Math.random() * 5000000) + 1000000,
  }));
}
