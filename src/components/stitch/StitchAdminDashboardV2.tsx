/**
 * StitchAdminDashboardV2 — AURA CAFE Admin Dashboard (Stitch v2 design)
 *
 * Dark navy glassmorphism admin panel with Chrome/bronze accents.
 * Source: Stitch AI admin-v2 export.
 */
'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Search,
  Bell,
  Settings,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */
export interface StatCardData {
  label: string;
  value: string;
  change: number;
  icon: 'revenue' | 'orders' | 'customers' | 'products';
}

export interface OrderData {
  id: string;
  table: string;
  items: string;
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid';
  time: string;
}

export interface StitchAdminDashboardV2Props {
  stats?: StatCardData[];
  recentOrders?: OrderData[];
  title?: string;
}

/* ─── Default Data ───────────────────────────────────────────────── */
const DEFAULT_STATS: StatCardData[] = [
  { label: 'Doanh thu hôm nay', value: '₫8,450,000', change: 12.5, icon: 'revenue' },
  { label: 'Đơn hàng', value: '47', change: 8.3, icon: 'orders' },
  { label: 'Khách hàng mới', value: '12', change: -2.1, icon: 'customers' },
  { label: 'Món bán chạy', value: 'Cà phê sữa', change: 5.7, icon: 'products' },
];

const DEFAULT_ORDERS: OrderData[] = [
  { id: '#0247', table: 'B05', items: '2× Espresso, 1× Cold Brew', total: 185000, status: 'preparing', time: '5 phút' },
  { id: '#0246', table: 'B03', items: '1× Matcha, 1× Bánh mì', total: 95000, status: 'pending', time: '2 phút' },
  { id: '#0245', table: 'B08', items: '3× Cappuccino', total: 210000, status: 'ready', time: '12 phút' },
  { id: '#0244', table: 'B01', items: '1× Cold Brew, 1× Bánh', total: 135000, status: 'paid', time: '25 phút' },
  { id: '#0243', table: 'B06', items: '2× Trà đào', total: 90000, status: 'served', time: '18 phút' },
];

/* ─── Stat Icon ──────────────────────────────────────────────────── */
function StatIcon({ icon }: { icon: StatCardData['icon'] }) {
  const className = 'w-5 h-5';
  switch (icon) {
    case 'revenue': return <DollarSign className={className} />;
    case 'orders': return <ShoppingCart className={className} />;
    case 'customers': return <Users className={className} />;
    case 'products': return <TrendingUp className={className} />;
  }
}

/* ─── Status Badge ───────────────────────────────────────────────── */
function StatusBadge({ status }: { status: OrderData['status'] }) {
  const config = {
    pending: { label: 'Chờ xử lý', class: 'bg-[rgba(198,198,199,0.1)] text-[#c6c6c7] border-[rgba(198,198,199,0.2)]' },
    preparing: { label: 'Đang pha chế', class: 'bg-[rgba(212,165,116,0.1)] text-[#d4a574] border-[rgba(212,165,116,0.2)]' },
    ready: { label: 'Sẵn sàng', class: 'bg-[rgba(76,175,80,0.1)] text-[#4CAF50] border-[rgba(76,175,80,0.2)]' },
    served: { label: 'Đã phục vụ', class: 'bg-[rgba(198,198,199,0.05)] text-[#a0a8b0] border-[rgba(198,198,199,0.1)]' },
    paid: { label: 'Đã thanh toán', class: 'bg-[rgba(198,198,199,0.05)] text-[#a0a8b0] border-[rgba(198,198,199,0.1)]' },
  };
  const c = config[status];
  return (
    <span className={clsx(
      'inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border',
      c.class
    )}>
      {c.label}
    </span>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ stat }: { stat: StatCardData }) {
  const isPositive = stat.change >= 0;
  return (
    <div className="glass-panel-admin p-5 flex flex-col gap-3 group">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-['Space_Grotesk',sans-serif] font-medium tracking-wide text-[#a0a8b0] uppercase">
          {stat.label}
        </span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[rgba(198,198,199,0.08)] text-[#c6c6c7] group-hover:bg-[rgba(198,198,199,0.12)] transition-colors">
          <StatIcon icon={stat.icon} />
        </div>
      </div>
      <span className="text-[28px] font-display text-[#e8e8e8] font-semibold leading-none">
        {stat.value}
      </span>
      <div className="flex items-center gap-1.5">
        {isPositive
          ? <ArrowUpRight className="w-3.5 h-3.5 text-[#4CAF50]" />
          : <ArrowDownRight className="w-3.5 h-3.5 text-[#ffb4ab]" />
        }
        <span className={clsx(
          'text-[12px] font-[\'Space_Grotesk\',sans-serif] font-medium',
          isPositive ? 'text-[#4CAF50]' : 'text-[#ffb4ab]'
        )}>
          {Math.abs(stat.change)}%
        </span>
        <span className="text-[12px] text-[#a0a8b0] font-['Space_Grotesk',sans-serif]">so với hôm qua</span>
      </div>
    </div>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { label: 'Tổng quan', icon: 'grid', active: true },
  { label: 'Đơn hàng', icon: 'shopping-cart' },
  { label: 'Thực đơn', icon: 'coffee' },
  { label: 'Khách hàng', icon: 'users' },
  { label: 'Bàn', icon: 'layout' },
  { label: 'Báo cáo', icon: 'bar-chart' },
  { label: 'Nhân viên', icon: 'user-check' },
  { label: 'Cài đặt', icon: 'settings' },
];

/* ─── Main Component ─────────────────────────────────────────────── */
export default function StitchAdminDashboardV2({
  stats = DEFAULT_STATS,
  recentOrders = DEFAULT_ORDERS,
  title = 'Admin Terminal',
}: Readonly<StitchAdminDashboardV2Props>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#00142c' }}>
      {/* Sidebar */}
      <aside className={clsx(
        'fixed top-0 left-0 h-full w-64 z-50 transition-transform duration-300 border-r',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
        'bg-[rgba(0,20,44,0.95)] backdrop-blur-xl border-[rgba(198,198,199,0.08)]'
      )}>
        <div className="p-6 border-b border-[rgba(198,198,199,0.08)]">
          <h2 className="font-display text-[22px] text-[#c6c6c7] tracking-wider uppercase">
            AURA
          </h2>
          <p className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.15em] uppercase mt-1">
            {title}
          </p>
        </div>
        <nav className="p-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={clsx(
                'w-full text-left px-4 py-3 rounded-lg font-[\'Space_Grotesk\',sans-serif] text-[13px] font-medium tracking-wide transition-all duration-200',
                item.active
                  ? 'bg-[rgba(198,198,199,0.1)] text-[#c6c6c7]'
                  : 'text-[#a0a8b0] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#e8e8e8]'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[rgba(0,20,44,0.8)] backdrop-blur-xl border-b border-[rgba(198,198,199,0.08)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="lg:hidden text-[#c6c6c7] hover:text-[#e8e8e8] transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a8b0]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  className="w-64 pl-10 pr-4 py-2 rounded-lg text-[13px] font-['Space_Grotesk',sans-serif] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[#e8e8e8] placeholder:text-[#a0a8b0] focus:outline-none focus:border-[#c6c6c7] focus:ring-1 focus:ring-[rgba(198,198,199,0.15)] transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" className="relative text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#d4a574] animate-bronze-glow-admin" />
              </button>
              <button type="button" className="text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-full bg-[rgba(198,198,199,0.15)] flex items-center justify-center text-[12px] font-semibold text-[#c6c6c7] font-['Space_Grotesk',sans-serif]">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </div>

          {/* Recent Orders */}
          <div className="glass-panel-admin p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-[22px] text-[#e8e8e8] font-semibold">
                Đơn hàng gần đây
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-['Space_Grotesk',sans-serif] font-medium text-[#a0a8b0] border border-[rgba(198,198,199,0.15)] hover:border-[rgba(198,198,199,0.3)] hover:text-[#c6c6c7] transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Lọc
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-['Space_Grotesk',sans-serif] font-medium bg-[rgba(198,198,199,0.1)] text-[#c6c6c7] hover:bg-[rgba(198,198,199,0.15)] transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Xuất CSV
                </button>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    {['Mã đơn', 'Bàn', 'Món', 'Tổng tiền', 'Trạng thái', 'Thời gian'].map((h) => (
                      <th
                        key={h}
                        className="text-left pb-3 font-['Space_Grotesk',sans-serif] text-[11px] font-semibold tracking-wider uppercase text-[#a0a8b0] last:text-right"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="py-4 font-['Space_Grotesk',sans-serif] text-[14px] text-[#c6c6c7] font-medium">{order.id}</td>
                      <td className="py-4 font-['Space_Grotesk',sans-serif] text-[14px] text-[#e8e8e8]">{order.table}</td>
                      <td className="py-4 font-['Space_Grotesk',sans-serif] text-[13px] text-[#a0a8b0]">{order.items}</td>
                      <td className="py-4 font-display text-[16px] text-[#e8e8e8] font-semibold">
                        {order.total.toLocaleString()}₫
                      </td>
                      <td className="py-4"><StatusBadge status={order.status} /></td>
                      <td className="py-4 text-right font-['Space_Grotesk',sans-serif] text-[12px] text-[#a0a8b0]">{order.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Order Cards */}
            <div className="md:hidden flex flex-col gap-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#c6c6c7] font-medium">{order.id}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#e8e8e8]">{order.table}</span>
                      <span className="mx-2 text-[#a0a8b0]">·</span>
                      <span className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#a0a8b0]">{order.items}</span>
                    </div>
                    <span className="font-display text-[16px] text-[#e8e8e8] font-semibold">
                      {order.total.toLocaleString()}₫
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        .glass-panel-admin {
          background: rgba(11, 32, 58, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(198, 198, 199, 0.08);
          border-radius: 12px;
        }
        @keyframes pulse-bronze-admin {
          0% { box-shadow: 0 0 0 0 rgba(212, 165, 116, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(212, 165, 116, 0); }
          100% { box-shadow: 0 0 0 0 rgba(212, 165, 116, 0); }
        }
        .animate-bronze-glow-admin { animation: pulse-bronze-admin 2s infinite; }
      `}</style>
    </div>
  );
}
