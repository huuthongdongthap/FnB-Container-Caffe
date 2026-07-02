import { useEffect, useState } from 'react';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { StatsCard } from '@/components/admin/StatsCard';
import { StuckPaymentsCard } from '@/components/admin/StuckPaymentsCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { OrderTable } from '@/components/admin/OrderTable';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { Card } from '@/components/ui/card';
import { useAdmin } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';

interface TableData {
  id: string;
  table_number: string;
  zone_name?: string;
  zone?: string;
  status: string;
}

interface TableOccupancyStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
}

export default function AdminDashboardPage() {
  const { stats, loading: statsLoading, error: statsError, fetchDashboard } = useAdminDashboardStore();
  const { orders, loading: ordersLoading, fetchOrders } = useAdminOrdersStore();
  const { customers, isLoadingCustomers } = useAdmin();
  const [occupancy, setOccupancy] = useState<TableOccupancyStats | null>(null);
  const [occupancyLoading, setOccupancyLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    fetchOrders();
  }, [fetchDashboard, fetchOrders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch<{ success: boolean; data: TableData[] }>('/api/tables');
        const tables = response?.data ?? [];
        if (!cancelled) {
          const stats: TableOccupancyStats = {
            total: tables.length,
            available: tables.filter((t) => t.status === 'Available').length,
            occupied: tables.filter((t) => t.status === 'Occupied').length,
            reserved: tables.filter((t) => t.status === 'Reserved').length,
          };
          setOccupancy(stats);
        }
      } catch {
        // silently fail — occupancy is a bonus widget
      } finally {
        if (!cancelled) setOccupancyLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (statsError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
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
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-display font-bold mb-6">Dashboard</h1>

        {/* Stuck Payments Alert (owner-only, hidden when clean) */}
        <div className="mb-6">
          <StuckPaymentsCard />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

        {/* Table Occupancy */}
        <div className="mb-6">
          <h2 className="text-lg font-display font-semibold mb-3">Sức chứa bàn</h2>
          {occupancyLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-3 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2" />
                  <div className="h-6 bg-gray-200 rounded w-8" />
                </Card>
              ))}
            </div>
          ) : occupancy ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3 flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng</span>
                <span className="text-xl font-bold font-display text-gray-800">{occupancy.total}</span>
              </Card>
              <Card className="p-3 flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Trống</span>
                <span className="text-xl font-bold font-display text-green-600">{occupancy.available}</span>
              </Card>
              <Card className="p-3 flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Có khách</span>
                <span className="text-xl font-bold font-display text-amber-600">{occupancy.occupied}</span>
              </Card>
              <Card className="p-3 flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Đã đặt</span>
                <span className="text-xl font-bold font-display text-blue-600">{occupancy.reserved}</span>
              </Card>
            </div>
          ) : null}
        </div>

        {/* Revenue Chart */}
        <div className="mb-6">
          <RevenueChart
            data={generateMockChartData()}
            period="daily"
          />
        </div>

        {/* Recent Orders */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">Đơn hàng gần đây</h2>
            <span className="text-xs text-muted">
              {ordersLoading ? 'Đang tải...' : `${orders.length} đơn`}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <OrderTable orders={orders.slice(0, 10)} sortBy="date" />
          </div>
        </div>

        {/* Top Customers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">Khách hàng thân thiết</h2>
            <span className="text-xs text-muted">
              {isLoadingCustomers ? 'Đang tải...' : `${customers.length} khách`}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
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
