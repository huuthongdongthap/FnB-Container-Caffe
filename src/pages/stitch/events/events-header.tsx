import { FILTER_TABS } from './events-constants';

interface EventsHeaderProps {
  activeFilter: string;
  onFilterChange: (key: string) => void;
}

export function EventsHeader({ activeFilter, onFilterChange }: EventsHeaderProps) {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
          AURA CAFE
        </span>

        {/* Filter Tabs */}
        <nav className="flex items-center gap-2 flex-wrap justify-center">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onFilterChange(tab.key)}
                className={`
                  px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider
                  transition-all duration-300
                  ${
                    isActive
                      ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] shadow-[0_0_16px_rgba(212,165,116,0.3)]'
                      : 'bg-transparent border border-[var(--aura-border-chrome)] text-[var(--aura-chrome-mid)] hover:border-[var(--aura-tertiary)] hover:text-[var(--aura-tertiary)]'
                  }
                `}
              >
                {tab.labelEn} / {tab.labelVn}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
