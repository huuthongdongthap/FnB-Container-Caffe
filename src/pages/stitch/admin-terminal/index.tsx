import { useState } from 'react';
import { StitchShell } from '../StitchBase';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '📊', active: true },
  { label: 'Operations', icon: '⚙️', active: false },
  { label: 'Inventory', icon: '📦', active: false },
  { label: 'Staffing', icon: '👥', active: false },
  { label: 'Financials', icon: '💰', active: false },
  { label: 'Settings', icon: '🛠️', active: false },
] as const;

const ANALYTICS_CARDS = [
  { label: 'TOTAL REVENUE', value: '$42,850.00', change: '+12%', trendUp: true },
  { label: 'ACTIVE ORDERS', value: '156', change: null, trendUp: null },
  { label: 'NEW CUSTOMERS', value: '1,204', change: null, trendUp: null },
  { label: 'AVG. ORDER VALUE', value: '$28.50', change: null, trendUp: null },
] as const;

export default function AdminTerminal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [chartView, setChartView] = useState<'monthly' | 'quarterly'>('monthly');

  return (
    <StitchShell>
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[var(--aura-noir-deep)]/40 backdrop-blur-xl border-r border-[var(--aura-border-chrome)]/20 shadow-[0_0_20px_rgba(205,127,50,0.15)] flex flex-col py-6 z-50">
        {/* Brand */}
        <div className="px-6 mb-10">
          <h1 className="font-display text-2xl font-semibold text-[var(--aura-chrome-bright)] tracking-tight">
            Aura Cafe
          </h1>
          <p className="text-[var(--aura-chrome-mid)] text-sm font-body opacity-70">
            Admin Terminal
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              className={`flex items-center gap-4 px-6 py-4 transition-all duration-300 ease-in-out active:scale-95 ${
                item.active
                  ? 'text-[var(--aura-tertiary)] bg-[var(--aura-primary)]/20 border-r-2 border-[var(--aura-tertiary)]'
                  : 'text-[var(--aura-chrome-mid)] hover:bg-white/5 hover:text-[var(--aura-chrome-bright)]'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="font-body text-sm">{item.label}</span>
            </a>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-6 mt-auto">
          <button className="w-full py-3 bg-[#CD7F32] text-white font-bold rounded-lg mb-6 active:scale-95 transition-transform">
            Generate Report
          </button>

          <div className="border-t border-[var(--aura-border-chrome)]/20 pt-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--aura-border-chrome)]">
                <div className="w-full h-full bg-[var(--aura-noir-void)] flex items-center justify-center text-lg">
                  👤
                </div>
              </div>
              <div>
                <p className="text-[var(--aura-chrome-bright)] font-semibold text-sm">
                  Aura Admin
                </p>
                <p className="text-[var(--aura-chrome-mid)] text-xs">Terminal #012</p>
              </div>
            </div>
            <a
              href="#"
              className="flex items-center gap-4 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-error)] transition-colors"
            >
              <span className="text-xl leading-none">🚪</span>
              <span className="font-body text-sm">Logout</span>
            </a>
          </div>
        </div>
      </aside>

      {/* ── Top App Bar ─────────────────────────────────── */}
      <header className="fixed top-0 right-0 left-72 h-20 bg-[var(--aura-noir-void)]/60 backdrop-blur-md border-b border-gradient-to-r from-[#E5E4E2]/30 to-transparent flex justify-between items-center px-10 z-40">
        <div className="flex items-center gap-8">
          <span className="font-display text-2xl font-bold text-[var(--aura-tertiary)]">
            Aura Management
          </span>
          <div className="hidden md:flex gap-6">
            <a
              href="#"
              className="text-[var(--aura-tertiary)] border-b border-[var(--aura-tertiary)] pb-1 font-body text-sm"
            >
              Live View
            </a>
            <a
              href="#"
              className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-all font-body text-sm"
            >
              Analytics
            </a>
            <a
              href="#"
              className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-all font-body text-sm"
            >
              Reports
            </a>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aura-chrome-mid)] text-lg">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search operations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/20 border-b border-[var(--aura-border-chrome)] focus:border-[var(--aura-tertiary)] outline-none py-2 pl-10 pr-4 w-64 font-body text-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-all text-xl">
              🔔
            </button>
            <button className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-all text-xl">
              ❓
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────── */}
      <main className="ml-72 pt-20 p-10 min-h-screen">
        {/* Analytics Overview */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {ANALYTICS_CARDS.map((card) => (
              <div
                key={card.label}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 flex flex-col justify-between h-40"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold tracking-widest text-[var(--aura-tertiary)]">
                    {card.label}
                  </span>
                  {card.change && card.trendUp && (
                    <span className="text-[#CD7F32] flex items-center font-bold text-sm">
                      {card.change} <span className="ml-1">📈</span>
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-[40px] leading-[48px] tracking-widest font-light text-[var(--aura-chrome-bright)]">
                    {card.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 w-full relative overflow-hidden h-[400px]">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div>
                <h2 className="font-display text-2xl text-[var(--aura-chrome-bright)]">
                  Revenue Growth
                </h2>
                <p className="font-body text-[var(--aura-chrome-mid)]">
                  Monthly fiscal performance tracking
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartView('monthly')}
                  className={`px-4 py-1 rounded text-xs font-bold tracking-widest transition-colors ${
                    chartView === 'monthly'
                      ? 'bg-[var(--aura-primary)]/30 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/20'
                      : 'text-[var(--aura-chrome-mid)] hover:bg-white/5'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setChartView('quarterly')}
                  className={`px-4 py-1 rounded text-xs font-bold tracking-widest transition-colors ${
                    chartView === 'quarterly'
                      ? 'bg-[var(--aura-primary)]/30 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/20'
                      : 'text-[var(--aura-chrome-mid)] hover:bg-white/5'
                  }`}
                >
                  Quarterly
                </button>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="absolute inset-0 pt-32 pb-8 px-8 pointer-events-none">
              <div className="w-full h-full flex items-end gap-1">
                <svg
                  className="w-full h-full"
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 300"
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#CD7F32" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#CD7F32" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,250 Q100,220 200,240 T400,150 T600,180 T800,80 T1000,50 L1000,300 L0,300 Z"
                    fill="url(#chartGradient)"
                  />
                  <path
                    d="M0,250 Q100,220 200,240 T400,150 T600,180 T800,80 T1000,50"
                    fill="none"
                    filter="drop-shadow(0 0 8px rgba(205,127,50,0.6))"
                    stroke="#CD7F32"
                    strokeLinecap="round"
                    strokeWidth={3}
                  />
                  <circle cx={200} cy={240} fill="#CD7F32" r={4} />
                  <circle cx={400} cy={150} fill="#CD7F32" r={4} />
                  <circle cx={600} cy={180} fill="#CD7F32" r={4} />
                  <circle cx={800} cy={80} fill="#CD7F32" r={4} />
                  <circle className="animate-pulse" cx={1000} cy={50} fill="#CD7F32" r={6} />
                </svg>
              </div>
            </div>

            {/* Grid Lines */}
            <div className="absolute inset-0 p-8 flex flex-col justify-between opacity-10 pointer-events-none">
              <div className="border-b border-[var(--aura-chrome-bright)] w-full" />
            </div>
          </div>
        </section>
      </main>
    </StitchShell>
  );
}
