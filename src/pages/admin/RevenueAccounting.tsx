'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClientSessionScope } from '@/lib/client-session';
import { apiFetch } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StatsCard } from '@/components/admin/StatsCard';
import { DollarSign, TrendingUp, Package, FileDown } from 'lucide-react';

interface DailyPnlEntry {
  date: string;
  orders: number;
  gross_sales: number;
  discounts: number;
  net_revenue: number;
  shipping_fee: number;
  service_fee: number;
  tip_amount: number;
  total_collected: number;
  refunds: number;
  cogs: number;
  waste_cost: number;
  gross_profit: number;
  gross_margin_pct: number;
}

interface PnlSummaryReport {
  from: string;
  to: string;
  timezone: string;
  totals: {
    orders: number;
    gross_sales: number;
    discounts: number;
    net_revenue: number;
    shipping_fee: number;
    service_fee: number;
    tip_amount: number;
    total_collected: number;
    refunds: number;
    cogs: number;
    waste_cost: number;
    gross_profit: number;
    gross_margin_pct: number;
  };
  daily: DailyPnlEntry[];
}

function defaultStoreDate(daysOffset = 0): string {
  const ictMs = Date.now() + 7 * 3600_000 + daysOffset * 86400_000;
  return new Date(ictMs).toISOString().slice(0, 10);
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

export default function RevenueAccountingPage() {
  const session = useClientSessionScope();
  const [from, setFrom] = useState(() => defaultStoreDate(-29));
  const [to, setTo] = useState(() => defaultStoreDate(0));

  const pnlQuery = useQuery<{ success: boolean; data: PnlSummaryReport }>({
    queryKey: ['admin-pnl-report', session.tenantId, session.userScope, from, to],
    queryFn: () => apiFetch(`/api/reports/pnl?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  });

  const report = pnlQuery.data?.data;
  const totals = report?.totals;
  const daily = report?.daily ?? [];

  const handleExportCsv = () => {
    const headers = [
      'Ngày (UTC+7)',
      'Số đơn',
      'Doanh thu gộp',
      'Chiết khấu',
      'Doanh thu thuần',
      'Hoàn tiền',
      'Giá vốn BOM (COGS)',
      'Hao hụt kho',
      'Lợi nhuận gộp',
      'Biên lợi nhuận (%)',
    ];
    const rows = daily.map((d) => [
      d.date,
      d.orders,
      d.gross_sales,
      d.discounts,
      d.net_revenue,
      d.refunds,
      d.cogs,
      d.waste_cost,
      d.gross_profit,
      d.gross_margin_pct,
    ]);
    const csv = `﻿${headers.join(',')}\n${rows.map((r) => r.join(',')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aura-pnl-report-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <HelmetHead
        title="Báo cáo Lãi Lỗ & Giá vốn (P&L) | Aura Cafe Admin"
        description="Báo cáo doanh thu ròng, giá vốn nguyên liệu BOM và đối soát ca tiền mặt AURA SPACE"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--aura-text-primary)]">
            Báo cáo Lãi Lỗ & Giá vốn BOM (P&L)
          </h1>
          <p className="text-sm text-[var(--aura-text-muted)]">
            Chốt sổ theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Từ ngày"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
          <span className="text-sm text-white/60">→</span>
          <input
            type="date"
            aria-label="Đến ngày"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={daily.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--aura-primary,#c8965a)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Xuất CSV P&L
          </button>
        </div>
      </div>

      {pnlQuery.isError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <span>
            Không thể tải báo cáo Lãi/Lỗ (P&L). Vui lòng thử lại.
          </span>
          <button
            type="button"
            onClick={() => pnlQuery.refetch()}
            className="rounded-lg border border-red-400/40 px-3 py-1 text-xs font-medium hover:bg-red-500/20"
          >
            Thử lại
          </button>
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Doanh thu thuần (Net Revenue)"
            value={totals.net_revenue}
            type="revenue"
            icon={<DollarSign className="h-6 w-6 text-[var(--aura-primary)]" />}
          />
          <StatsCard
            title="Giá vốn & Hao hụt (COGS)"
            value={totals.cogs + totals.waste_cost}
            type="revenue"
            icon={<Package className="h-6 w-6 text-amber-400" />}
          />
          <StatsCard
            title="Lợi nhuận gộp (Gross Profit)"
            value={totals.gross_profit}
            type="revenue"
            icon={<TrendingUp className="h-6 w-6 text-emerald-400" />}
          />
          <Card className="flex flex-col justify-between p-5">
            <span className="text-sm text-[var(--aura-text-muted)]">Biên lợi nhuận gộp</span>
            <span className="mt-2 text-2xl font-bold text-emerald-400">
              {totals.gross_margin_pct.toFixed(1)}%
            </span>
            <span className="mt-1 text-xs text-white/50">
              {totals.orders} đơn hợp lệ · Chiết khấu {formatVnd(totals.discounts)}
            </span>
          </Card>
        </div>
      )}

      <Card className="overflow-x-auto p-4">
        {pnlQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-white/60">Đang tải dữ liệu đối soát lãi lỗ...</p>
        ) : daily.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/60">Chưa có phát sinh doanh thu hoặc xuất kho trong kỳ này.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-white/60">
              <tr>
                <th className="py-3 pr-4">Ngày</th>
                <th className="py-3 pr-4 text-right">Đơn</th>
                <th className="py-3 pr-4 text-right">Doanh thu thuần</th>
                <th className="py-3 pr-4 text-right">Hoàn tiền</th>
                <th className="py-3 pr-4 text-right">Giá vốn BOM</th>
                <th className="py-3 pr-4 text-right">Hao hụt</th>
                <th className="py-3 pr-4 text-right">Lợi nhuận gộp</th>
                <th className="py-3 text-right">Biên gộp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {daily.map((row) => (
                <tr key={row.date}>
                  <td className="py-3 pr-4 font-medium">{row.date}</td>
                  <td className="py-3 pr-4 text-right">{row.orders}</td>
                  <td className="py-3 pr-4 text-right">{formatVnd(row.net_revenue)}</td>
                  <td className="py-3 pr-4 text-right">{formatVnd(row.refunds)}</td>
                  <td className="py-3 pr-4 text-right text-amber-300">{formatVnd(row.cogs)}</td>
                  <td className="py-3 pr-4 text-right text-rose-300">{formatVnd(row.waste_cost)}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-emerald-400">{formatVnd(row.gross_profit)}</td>
                  <td className="py-3 text-right">{row.gross_margin_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
