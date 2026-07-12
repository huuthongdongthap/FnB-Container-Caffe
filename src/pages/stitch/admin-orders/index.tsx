import { useState, useEffect } from 'react';

export default function OrderManagementTerminal() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard / Tổng quan' },
    { id: 'operations', icon: '⚙️', label: 'Operations / Vận hành' },
    { id: 'inventory', icon: '📦', label: 'Inventory / Kho' },
    { id: 'staffing', icon: '👥', label: 'Staffing / Nhân sự' },
    { id: 'financials', icon: '💰', label: 'Financials / Tài chính' },
    { id: 'settings', icon: '🔧', label: 'Settings / Cài đặt' },
  ] as const;

  const orderStats = [
    { label: 'Active Orders / Đơn mở', value: '24', color: 'var(--aura-tertiary)' },
    { label: 'In Preparation / Đang làm', value: '12', color: '#D4A574' },
    { label: 'Ready / Sẵn sàng', value: '6', color: '#7BA89C' },
    { label: 'Avg Lead Time / TG phục vụ TB', value: '8.5m', color: 'var(--aura-chrome-mid)' },
  ] as const;

  type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled';
  interface Order {
    id: string;
    customer: string;
    table: string;
    service: string;
    items: string[];
    status: OrderStatus;
    total: string;
    time: string;
  }

  const STATUS_STYLES: Record<OrderStatus, string> = {
    Pending: 'border-l-[var(--aura-dark-bronze)]',
    Preparing: 'border-l-[var(--aura-tertiary)]',
    Ready: 'border-l-emerald-500',
    Served: 'border-l-[#7BA89C]',
    Cancelled: 'border-l-red-500/50',
  };

  const STATUS_BADGE: Record<OrderStatus, { bg: string; text: string }> = {
    Pending: { bg: 'rgba(212,165,116,0.15)', text: 'var(--aura-dark-bronze)' },
    Preparing: { bg: 'var(--aura-tertiary)/15', text: 'var(--aura-tertiary)' },
    Ready: { bg: 'rgba(123,168,156,0.15)', text: '#7BA89C' },
    Served: { bg: 'rgba(123,168,156,0.15)', text: '#7BA89C' },
    Cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  };

  const orders: Order[] = [
    { id: 'ORD-2847', customer: 'Nguyễn Văn A / John Doe', table: 'Table 01', service: 'DINE IN', items: ['Midnight Espresso x2', 'Smoked Truffle Croissant'], status: 'Pending', total: '$18.50', time: '2 min ago' },
    { id: 'ORD-2846', customer: 'Trần Thị B / Jane Smith', table: 'Table 05', service: 'DINE IN', items: ['Chrome Velvet Latte', 'Bronze Chai'], status: 'Preparing', total: '$22.00', time: '5 min ago' },
    { id: 'ORD-2845', customer: 'Lê Văn C', table: 'Counter', service: 'TAKEAWAY', items: ['Industrial Cold Brew x3'], status: 'Ready', total: '$21.00', time: '10 min ago' },
    { id: 'ORD-2844', customer: 'Phạm Thị D', table: 'Table 12', service: 'DELIVERY', items: ['Midnight Espresso', 'Silver Leaf Pastry'], status: 'Served', total: '$14.50', time: '18 min ago' },
    { id: 'ORD-2843', customer: 'Hoàng Văn E', table: '–', service: 'TAKEAWAY', items: ['Chrome Velvet Latte x2'], status: 'Cancelled', total: '$16.00', time: '22 min ago' },
  ];

  return (
    <div className="flex h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
      {/* Side Nav */}
      <aside className="w-64 bg-[var(--aura-noir-void)] border-r border-white/10 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <h1 className="font-display text-headline-md text-[var(--aura-tertiary)] tracking-wider">AURA CAFE</h1>
          <p className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)] mt-1 opacity-60">Admin Terminal / Quản trị</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-body text-sm transition-all active:scale-[0.98] ${
                activeTab === tab.id
                  ? 'bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/30'
                  : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="font-label-caps text-label-caps tracking-wider">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <span className="w-8 h-8 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm">👤</span>
            <div>
              <p className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">Admin User / QTV</p>
              <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] opacity-60">admin@auracafe.vn</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-white/10 px-8 h-16 flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-[var(--aura-chrome-bright)] uppercase tracking-widest">
            Order Management / Quản lý đơn
          </h2>
          <div className="flex items-center gap-4">
            <span className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)]">Last sync / đồng bộ: Just now</span>
            <button type="button" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors">🔔</button>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {orderStats.map(stat => (
              <div key={stat.label} className="glass-panel rounded-xl p-5 border-l-4" style={{ borderLeftColor: stat.color }}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)] uppercase tracking-wider">{stat.label}</p>
                    <p className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mt-1" style={{ fontFamily: 'var(--font-display, serif)' }}>{stat.value}</p>
                  </div>
                  <span className="text-2xl opacity-30">●</span>
                </div>
              </div>
            ))}
          </div>

          {/* Orders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)]">Active Orders / Đơn hiện tại</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg font-label-caps text-label-caps text-xs bg-white/5 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">All / Tất cả</button>
                <button className="px-3 py-1.5 rounded-lg font-label-caps text-label-caps text-xs bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/30">Pending / Chờ</button>
                <button className="px-3 py-1.5 rounded-lg font-label-caps text-label-caps text-xs bg-white/5 text-[var(--aura-chrome-mid)]">Preparing / Làm</button>
                <button className="px-3 py-1.5 rounded-lg font-label-caps text-label-caps text-xs bg-white/5 text-[var(--aura-chrome-mid)]">Ready / Sẵn</button>
              </div>
            </div>

            <div className="space-y-3">
              {orders.map(order => {
                const badge = STATUS_BADGE[order.status];
                return (
                  <div key={order.id} className={`glass-panel rounded-xl p-6 bg-[var(--aura-noir-void)]/60 border-l-4 ${STATUS_STYLES[order.status]}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)]">{order.id}</p>
                          <p className="font-body-sm text-body-sm text-[var(--aura-chrome-mid)]">{order.customer}</p>
                        </div>
                        <div className="h-10 w-px bg-white/10" />
                        <div>
                          <p className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">{order.table}</p>
                          <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase">{order.service}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-2.5 py-1 rounded-full font-label-caps text-[10px] uppercase tracking-wider" style={{ backgroundColor: badge.bg, color: badge.text }}>
                          {order.status}
                        </span>
                        <span className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">{order.total}</span>
                        <span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">{order.time}</span>
                        <button className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 font-label-caps text-label-caps text-xs text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] active:scale-95 transition-all">View / Xem</button>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                      {order.items.map(item => (
                        <span key={item} className="px-2 py-1 rounded bg-white/5 font-body-sm text-xs text-[var(--aura-chrome-mid)]">{item}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <span className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)]">Showing 1-5 of 24 orders / Hiển thị 1-5 / 24 đơn</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-white/5 font-label-caps text-xs text-[var(--aura-chrome-mid)] disabled:opacity-40" disabled>Prev / Trước</button>
              <button className="px-3 py-1.5 rounded-lg bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/30 font-label-caps text-xs">1</button>
              <button className="px-3 py-1.5 rounded-lg bg-white/5 font-label-caps text-xs text-[var(--aura-chrome-mid)]">2</button>
              <button className="px-3 py-1.5 rounded-lg bg-white/5 font-label-caps text-xs text-[var(--aura-chrome-mid)]">3</button>
              <button className="px-3 py-1.5 rounded-lg bg-white/5 font-label-caps text-xs text-[var(--aura-chrome-mid)]">Next / Sau</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}