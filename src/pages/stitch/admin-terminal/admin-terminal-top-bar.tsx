interface TopBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function TopBar({ searchQuery, onSearchChange }: TopBarProps) {
  return (
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
            onChange={(e) => onSearchChange(e.target.value)}
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
  );
}
