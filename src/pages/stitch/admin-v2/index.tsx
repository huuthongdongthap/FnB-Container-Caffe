import { useState } from 'react';

type NavItem = 'Dashboard' | 'Operations' | 'Inventory' | 'Staffing' | 'Financials' | 'Settings';

const NAV_ITEMS: { id: NavItem; icon: string }[] = [
  { id: 'Dashboard', icon: '📊' },
  { id: 'Operations', icon: '⚙️' },
  { id: 'Inventory', icon: '📦' },
  { id: 'Staffing', icon: '👥' },
  { id: 'Financials', icon: '💰' },
  { id: 'Settings', icon: '🔧' },
];

const STATS = [
  { label: 'Total Revenue / Doanh thu', value: '$42,850', change: '+12.5%', up: true, icon: '💰' },
  { label: 'Active Orders / Đơn mở', value: '156', change: '+23', up: true, icon: '📋' },
  { label: 'New Customers / KH mới', value: '1,204', change: '+120', up: true, icon: '👥' },
  { label: 'Avg Order Value / TB đơn', value: '$28.50', change: '-2.1%', up: false, icon: '💎' },
] as const;

export default function AdminTerminal() {
  const [activeNav, setActiveNav] = useState<NavItem>('Dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-[var(--aura-noir-void)] border-r border-white/10 flex flex-col transition-all duration-300 shrink-0`}>
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm shrink-0">☕</div>
          {!isSidebarCollapsed && <h1 className="font-display text-headline-sm text-[var(--aura-tertiary)] tracking-wider">AURA CAFE</h1>}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm transition-all active:scale-[0.98] ${
                activeNav === item.id
                  ? 'bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/30'
                  : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] hover:bg-white/5'
              }`}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              {!isSidebarCollapsed && <span className="font-label-caps text-label-caps tracking-wider">{item.id}</span>}
            </button>
          ))}
        </nav>
        {!isSidebarCollapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm shrink-0">👤</span>
              <div>
                <p className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">Admin / QTV</p>
                <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] opacity-60">admin@auracafe.vn</p>
              </div>
            </div>
          </div>
        )}
        <button onClick={() => setIsSidebarCollapsed(v => !v)} className="p-3 border-t border-white/10 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] text-xs text-center">
          {isSidebarCollapsed ? '→' : '← Collapse / Thu gọn'}
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-white/10 px-8 h-16 flex items-center justify-between">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-[var(--aura-chrome-bright)] uppercase tracking-widest">Aura Management / Quản lý</h2>
            <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">Workspace Overview / Tổng quan</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="text" placeholder="Search / Tìm kiếm..." className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 font-body text-sm text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-mid)]/50 outline-none focus:border-[var(--aura-tertiary)] transition-colors w-56" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--aura-chrome-mid)]">🔍</span>
            </div>
            <button className="relative w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors">
              🔔<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--aura-tertiary)] text-[8px] text-[var(--aura-noir-deep)] flex items-center justify-center font-bold">3</span>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* Welcome */}
          <div>
            <h3 className="font-display text-3xl text-[var(--aura-chrome-bright)]" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
              Welcome back / Chào lại
            </h3>
            <p className="font-body text-body text-[var(--aura-chrome-mid)] mt-1">Here's what's happening / Dưới đây là tổng quan hôm nay.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(stat => (
              <div key={stat.label} className="glass-panel rounded-xl p-6 transition-all hover:border-[var(--aura-tertiary)]/20">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)] uppercase tracking-wider">{stat.label}</p>
                    <p className="font-display text-4xl text-[var(--aura-chrome-bright)] mt-2" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>{stat.value}</p>
                  </div>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <p className={`mt-3 font-body-sm text-xs font-medium ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stat.change} {stat.up ? '↑' : '↓'} <span className="text-[var(--aura-chrome-mid)] font-normal">vs last month / tháng trước</span>
                </p>
              </div>
            ))}
          </div>

          {/* Revenue Chart placeholder */}
          <div className="glass-panel rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)]">Revenue / Doanh thu</h3>
              <span className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)]">Last 7 days / 7 ngày qua</span>
            </div>
            {/* SVG sparkline */}
            <svg viewBox="0 0 600 120" className="w-full h-32">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4A574" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#D4A574" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,90 C50,85 80,70 120,60 C160,50 200,55 250,40 C300,25 340,35 400,20 C440,10 480,18 520,8 C560,2 580,5 600,0 L600,120 L0,120 Z" fill="url(#chartGrad)" />
              <path d="M0,90 C50,85 80,70 120,60 C160,50 200,55 250,40 C300,25 340,35 400,20 C440,10 480,18 520,8 C560,2 580,5 600,0" fill="none" stroke="#D4A574" strokeWidth="2.5" />
              {[[0,90],[80,70],[160,50],[250,40],[340,35],[440,10],[520,8],[600,0]].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#D4A574" />
              ))}
            </svg>
            <div className="flex justify-between mt-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <span key={d} className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] w-8 text-center">{d}</span>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Recent Orders / Đơn gần đây</h3>
            <div className="space-y-3">
              {['ORD-2847 — Nguyễn Văn A — $18.50', 'ORD-2846 — Trần Thị B — $22.00', 'ORD-2845 — Lê Văn C — $21.00'].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <span className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">{item}</span>
                  <span className={`px-2 py-0.5 rounded-full font-label-caps text-[10px] ${i === 0 ? 'bg-red-500/15 text-red-400' : i === 1 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{i === 0 ? 'Pending' : i === 1 ? 'Preparing' : 'Ready'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}