'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StatsCard } from '@/components/admin/StatsCard';
import { DollarSign, LayoutGrid, TrendingUp } from 'lucide-react';

interface FranchiseLocationItem {
  id: string;
  code: string;
  name: string;
  tenant_id: string;
  city?: string | null;
  royalty_percentage: number;
  status: string;
}

interface FranchiseLocationMetrics {
  location_id: string;
  code: string;
  name: string;
  tenant_id: string;
  order_count: number;
  gross_sales: number;
  royalty_percentage: number;
  royalty_amount: number;
  net_franchisee_payout: number;
}

function defaultStoreDate(daysOffset = 0): string {
  const ictMs = Date.now() + 7 * 3600_000 + daysOffset * 86400_000;
  return new Date(ictMs).toISOString().slice(0, 10);
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

export default function FranchiseReportsPage() {
  const [startDate, setStartDate] = useState(() => defaultStoreDate(-29));
  const [endDate, setEndDate] = useState(() => defaultStoreDate(0));

  const locationsQuery = useQuery<{ success: boolean; data: FranchiseLocationItem[] }>({
    queryKey: ['admin-franchise-locations'],
    queryFn: () => apiFetch('/api/franchise/locations'),
  });

  const locations = locationsQuery.data?.data ?? [];

  const metricsQuery = useQuery<FranchiseLocationMetrics[]>({
    queryKey: ['admin-franchise-metrics', locations.map((l) => l.id).join(','), startDate, endDate],
    enabled: locations.length > 0,
    queryFn: async () => {
      const settled = await Promise.allSettled(
        locations.map(async (loc) => {
          const res = await apiFetch<{ success: boolean; data: FranchiseLocationMetrics }>(
            `/api/franchise/locations/${encodeURIComponent(loc.id)}/metrics?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
          );
          return res.data;
        })
      );
      return settled
        .filter((r): r is PromiseFulfilledResult<FranchiseLocationMetrics> => r.status === 'fulfilled' && Boolean(r.value))
        .map((r) => r.value);
    },
  });

  const rows = metricsQuery.data ?? [];
  const totalGross = rows.reduce((sum, r) => sum + r.gross_sales, 0);
  const totalRoyalty = rows.reduce((sum, r) => sum + r.royalty_amount, 0);
  const totalNetPayout = rows.reduce((sum, r) => sum + r.net_franchisee_payout, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <HelmetHead
        title="Báo cáo Nhượng quyền & Royalty | Aura Cafe Admin"
        description="Đối soát doanh thu đa chi nhánh và phí bản quyền nhượng quyền AURA SPACE"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--aura-text-primary)]">
            Đối soát Nhượng quyền & Phí Bản quyền (Royalty)
          </h1>
          <p className="text-sm text-[var(--aura-text-muted)]">
            Tổng hợp doanh thu từng điểm bán Container và phí bản quyền thu về HQ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Từ ngày"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
          <span className="text-sm text-white/60">→</span>
          <input
            type="date"
            aria-label="Đến ngày"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Tổng doanh thu chuỗi (Gross Sales)"
          value={totalGross}
          type="revenue"
          icon={<DollarSign className="h-6 w-6 text-[var(--aura-primary)]" />}
        />
        <StatsCard
          title="Tổng phí Royalty phải thu"
          value={totalRoyalty}
          type="revenue"
          icon={<TrendingUp className="h-6 w-6 text-emerald-400" />}
        />
        <StatsCard
          title="Thực nhận đối tác (Net Payout)"
          value={totalNetPayout}
          type="revenue"
          icon={<LayoutGrid className="h-6 w-6 text-sky-400" />}
        />
      </div>

      <Card className="overflow-x-auto p-4">
        {locationsQuery.isLoading || metricsQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-white/60">Đang tải số liệu nhượng quyền...</p>
        ) : locations.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/60">
            Chưa có cửa hàng nhượng quyền nào được đăng ký trong phạm vi chi nhánh này.
          </p>
        ) : (
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-white/60">
              <tr>
                <th className="py-3 pr-4">Mã điểm bán</th>
                <th className="py-3 pr-4">Tên cửa hàng</th>
                <th className="py-3 pr-4 text-right">Số đơn</th>
                <th className="py-3 pr-4 text-right">Doanh thu gộp</th>
                <th className="py-3 pr-4 text-right">Royalty (%)</th>
                <th className="py-3 pr-4 text-right">Phí Royalty</th>
                <th className="py-3 text-right">Đối tác thực nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => (
                <tr key={row.location_id}>
                  <td className="py-3 pr-4 font-mono text-xs">{row.code}</td>
                  <td className="py-3 pr-4 font-medium">{row.name}</td>
                  <td className="py-3 pr-4 text-right">{row.order_count}</td>
                  <td className="py-3 pr-4 text-right">{formatVnd(row.gross_sales)}</td>
                  <td className="py-3 pr-4 text-right">{row.royalty_percentage}%</td>
                  <td className="py-3 pr-4 text-right font-semibold text-emerald-400">{formatVnd(row.royalty_amount)}</td>
                  <td className="py-3 text-right">{formatVnd(row.net_franchisee_payout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
