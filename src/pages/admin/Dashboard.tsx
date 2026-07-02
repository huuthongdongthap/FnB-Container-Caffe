import { useEffect, useState } from 'react';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { StatsCard } from '@/components/admin/StatsCard';
import { StuckPaymentsCard } from '@/components/admin/StuckPaymentsCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { OrderTable } from '@/components/admin/OrderTable';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';
import {
  useDailyReport,
  useTopProducts,
  usePeakHours,
  useCustomerMetrics,
  getExportUrl,
} from '@/hooks/use-reports';
import { TopProductsChart } from '@/components/admin/TopProductsChart';
import { PeakHoursChart } from '@/components/admin/PeakHoursChart';
import { CustomerMetrics } from '@/components/admin/CustomerMetrics';

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
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [showExport, setShowExport] = useState(false);

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

  // ── Period & Report dates ──
  const now = new Date();
  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  const from = new Date(now.getTime() - daysMap[period] * 86400000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  // ── Report hooks ──
  const dailyReport = useDailyReport(from, to);
  const topProducts = useTopProducts(from, to);
  const peakHours = usePeakHours(from, to);
  const customerMetrics = useCustomerMetrics();

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <div className="relative">
            <Button onClick={() => setShowExport(!showExport)} size="sm" variant="secondary">
              📥 Tải báo cáo
            </Button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-10 min-w-[200px]">
                <a
                  href={getExportUrl('orders', from, to)}
                  download
                  className="block px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setShowExport(false)}
                >
                  Đơn hàng (CSV)
                </a>
                <a
                  href={getExportUrl('revenue', from, to)}
                  download
                  className="block px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setShowExport(false)}
                >
                  Doanh thu (CSV)
                </a>
                <a
                  href={getExportUrl('customers', from, to)}
                  download
                  className="block px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setShowExport(false)}
                >
                  Khách hàng (CSV)
                </a>
              </div>
            )}
          </div>
        </div>

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

        {/* Period Toggle */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold">Báo cáo doanh thu</h2>
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p === '7d' ? '7 ngày' : p === '30d' ? '30 ngày' : '90 ngày'}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="mb-6">
          {dailyReport.isLoading ? (
            <Card className="p-6">
              <div className="h-40 bg-gray-100 rounded animate-pulse" />
            </Card>
          ) : dailyReport.error ? (
            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Doanh thu</h3>
              <div className="text-center py-4">
                <p className="text-sm text-red-500 mb-2">Lỗi tải dữ liệu</p>
                <button onClick={() => dailyReport.refetch()} className="text-xs text-blue-600 underline">
                  Thử lại
                </button>
              </div>
            </Card>
          ) : (
            <RevenueChart
              data={dailyReport.data?.data?.map((d) => ({ label: d.date.slice(5), value: d.revenue })) || []}
              period="daily"
            />
          )}
        </div>

        {/* Top Products + Peak Hours */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <TopProductsChart
            data={topProducts.data?.data || []}
            loading={topProducts.isLoading}
            error={topProducts.error?.message || null}
            onRetry={() => topProducts.refetch()}
          />
          <PeakHoursChart
            data={peakHours.data?.data || []}
            loading={peakHours.isLoading}
            error={peakHours.error?.message || null}
            onRetry={() => peakHours.refetch()}
          />
        </div>

        {/* Customer Metrics */}
        <div className="mb-6">
          <CustomerMetrics
            data={customerMetrics.data?.data || null}
            loading={customerMetrics.isLoading}
            error={customerMetrics.error?.message || null}
            onRetry={() => customerMetrics.refetch()}
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
