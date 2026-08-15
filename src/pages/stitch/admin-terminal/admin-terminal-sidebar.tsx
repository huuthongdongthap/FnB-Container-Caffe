import { NAV_ITEMS } from './admin-terminal-constants';

export function Sidebar() {
  return (
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
  );
}
