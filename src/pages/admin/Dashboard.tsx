import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { StatsCard } from '@/components/admin/StatsCard';
import { StuckPaymentsCard } from '@/components/admin/StuckPaymentsCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { OrderTable } from '@/components/admin/OrderTable';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';
import { useReviewsStats, useReviews } from '@/hooks/use-reviews';
import { usePromotions } from '@/hooks/use-promotions';
import { useAdminShiftsStore } from '@/hooks/stores/admin/use-admin-shifts-store';

export default function AdminDashboardPage() {
  const { fetchDashboard } = useAdminDashboardStore();
  const { orders, loading: ordersLoading, fetchOrders } = useAdminOrdersStore();
  const { customers, isLoadingCustomers } = useAdmin();

  // ── Today's dashboard data ──
  const todayOrdersQuery = useQuery<{ success: boolean; data: Array<{ id: string; customer_name: string; total: number; status: string; created_at: string }> }>({
    queryKey: ['dashboard-today-orders'],
    queryFn: () => apiFetch('/api/orders?limit=50'),
    staleTime: 60_000,
  });

  const dashboardCustomersQuery = useQuery<{ success: boolean; customers: Array<{ id: string; name: string; phone: string; created_at: string }> }>({
    queryKey: ['dashboard-customers'],
    queryFn: () => apiFetch('/api/customers'),
    staleTime: 60_000,
  });

  const reviewsStats = useReviewsStats();
  const recentReviews = useReviews(1, 3);
  const promotions = usePromotions();
  const { todayShifts, loading: shiftsLoading, error: shiftsError, fetchToday } = useAdminShiftsStore();

  const dashboardToday = new Date().toISOString().slice(0, 10);
  const isTodayStr = (dateStr: string) => dateStr && dateStr.slice(0, 10) === dashboardToday;

  const todayOrders = useMemo(() => {
    const orders = todayOrdersQuery.data?.data;
    if (!orders) return [];
    return orders.filter((o) => isTodayStr(o.created_at));
  }, [todayOrdersQuery.data]);

  const todayRevenue = useMemo(() => {
    return todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [todayOrders]);

  const newCustomersToday = useMemo(() => {
    const customers = dashboardCustomersQuery.data?.customers;
    if (!customers) return 0;
    return customers.filter((c) => isTodayStr(c.created_at)).length;
  }, [dashboardCustomersQuery.data]);

  useEffect(() => {
    fetchDashboard();
    fetchOrders();
    fetchToday();
  }, [fetchDashboard, fetchOrders, fetchToday]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-display font-bold mb-6">Dashboard</h1>

        {/* Stuck Payments Alert (owner-only, hidden when clean) */}
        <div className="mb-6">
          <StuckPaymentsCard />
        </div>

        {/* Tổng quan hôm nay */}
        <h2 className="text-lg font-display font-semibold mb-3">Tổng quan hôm nay</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Orders Today */}
          {todayOrdersQuery.isLoading ? (
            <Card className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-12" />
            </Card>
          ) : todayOrdersQuery.error ? (
            <Card className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
              <p className="text-xs text-red-500 text-center">Lỗi tải đơn hàng</p>
              <button onClick={() => todayOrdersQuery.refetch()} className="text-xs text-blue-600 underline">
                Thử lại
              </button>
            </Card>
          ) : (
            <StatsCard
              title="Đơn hàng hôm nay"
              value={todayOrders.length}
              type="count"
              icon="📋"
            />
          )}

          {/* Revenue Today */}
          {todayOrdersQuery.isLoading ? (
            <Card className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </Card>
          ) : todayOrdersQuery.error ? (
            <Card className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
              <p className="text-xs text-red-500 text-center">Lỗi tải doanh thu</p>
              <button onClick={() => todayOrdersQuery.refetch()} className="text-xs text-blue-600 underline">
                Thử lại
              </button>
            </Card>
          ) : (
            <StatsCard
              title="Doanh thu hôm nay"
              value={todayRevenue}
              type="revenue"
              icon="💰"
            />
          )}

          {/* New Customers Today */}
          {dashboardCustomersQuery.isLoading ? (
            <Card className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-12" />
            </Card>
          ) : dashboardCustomersQuery.error ? (
            <Card className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
              <p className="text-xs text-red-500 text-center">Lỗi tải khách hàng</p>
              <button onClick={() => dashboardCustomersQuery.refetch()} className="text-xs text-blue-600 underline">
                Thử lại
              </button>
            </Card>
          ) : (
            <StatsCard
              title="Khách hàng mới"
              value={newCustomersToday}
              type="count"
              icon="👤"
            />
          )}

          {/* Reviews Today */}
          {reviewsStats.isLoading ? (
            <Card className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-12" />
            </Card>
          ) : reviewsStats.error ? (
            <Card className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
              <p className="text-xs text-red-500 text-center">Lỗi tải đánh giá</p>
              <button onClick={() => reviewsStats.refetch()} className="text-xs text-blue-600 underline">
                Thử lại
              </button>
            </Card>
          ) : (
            <StatsCard
              title="Đánh giá"
              value={reviewsStats.data?.total_reviews ?? 0}
              type="count"
              icon="⭐"
            />
          )}
        </div>

        {/* Revenue Chart */}
        <div className="mb-6">
          <RevenueChart
            data={generateMockChartData()}
            period="daily"
          />
        </div>

        {/* Hoạt động gần đây */}
        <div className="mb-6">
          <h2 className="text-lg font-display font-semibold mb-3">Hoạt động gần đây</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Clocked-in Staff */}
            <Card>
              <CardBody>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                  <span>👥</span> Nhân viên đang làm
                </h3>
                {shiftsLoading.today ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-full" />
                        <div className="flex-1">
                          <div className="h-3 bg-gray-200 rounded w-24 mb-1" />
                          <div className="h-2 bg-gray-200 rounded w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : shiftsError ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-red-500 mb-2">{shiftsError}</p>
                    <button onClick={() => fetchToday()} className="text-xs text-blue-600 underline">
                      Thử lại
                    </button>
                  </div>
                ) : todayShifts.length === 0 ? (
                  <div className="text-center py-6 text-muted">
                    <p className="text-2xl mb-2">🛌</p>
                    <p className="text-xs">Chưa có nhân viên check-in hôm nay</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayShifts.map((s) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">
                          👤
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{s.staff_name}</p>
                          <p className="text-xs text-muted">
                            Từ {s.clock_in ? new Date(s.clock_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '...'}
                          </p>
                        </div>
                        <Badge variant="success">Đang làm</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Recent Reviews */}
            <Card>
              <CardBody>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                  <span>💬</span> Đánh giá gần đây
                </h3>
                {recentReviews.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse flex items-start gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                        <div className="flex-1">
                          <div className="h-3 bg-gray-200 rounded w-20 mb-1" />
                          <div className="h-2 bg-gray-200 rounded w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentReviews.error ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-red-500 mb-2">Lỗi tải đánh giá</p>
                    <button onClick={() => recentReviews.refetch()} className="text-xs text-blue-600 underline">
                      Thử lại
                    </button>
                  </div>
                ) : !recentReviews.data?.data?.length ? (
                  <div className="text-center py-6 text-muted">
                    <p className="text-2xl mb-2">📝</p>
                    <p className="text-xs">Chưa có đánh giá nào</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentReviews.data.data.slice(0, 3).map((r) => (
                      <div key={r.id} className="border-b border-border last:border-0 pb-2 last:pb-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                            {r.customer_name || 'Khách'}
                          </span>
                          <span className="text-xs text-amber-500">
                            {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="text-xs text-muted line-clamp-2">{r.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Active Promotions */}
            <Card>
              <CardBody>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                  <span>🏷️</span> Khuyến mãi đang chạy
                </h3>
                {promotions.isLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-12 bg-gray-200 rounded" />
                  </div>
                ) : promotions.error ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-red-500 mb-2">Lỗi tải khuyến mãi</p>
                    <button onClick={() => promotions.refetch()} className="text-xs text-blue-600 underline">
                      Thử lại
                    </button>
                  </div>
                ) : !promotions.data?.length ? (
                  <div className="text-center py-6 text-muted">
                    <p className="text-2xl mb-2">🎯</p>
                    <p className="text-xs">Chưa có khuyến mãi nào</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold font-display text-foreground mb-2">
                      {promotions.data.length}
                    </p>
                    <p className="text-xs text-muted mb-3">Khuyến mãi đang hoạt động</p>
                    <div className="space-y-1.5">
                      {promotions.data.slice(0, 4).map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-foreground">{p.icon} {p.code}</span>
                          <span className="text-muted">-{p.percent}%</span>
                        </div>
                      ))}
                      {promotions.data.length > 4 && (
                        <p className="text-xs text-muted pt-1">
                          +{promotions.data.length - 4} khuyến mãi khác
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
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
