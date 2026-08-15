import { useTranslation } from 'react-i18next';
import { Search, Bell, HelpCircle, Menu } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenSidebar: () => void;
}

export function TopBar({ searchQuery, onSearchChange, onOpenSidebar }: TopBarProps) {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-30 flex h-20 items-center justify-between border-b bg-[var(--aura-bg-page, #0A1A2E)]/60 px-4 backdrop-blur-md md:px-10',
        'left-0 md:left-72',
      )}
      style={{
        borderImage: 'linear-gradient(to right, rgba(229,228,226,0.3), transparent) 1',
      }}
      aria-label={tTerminal('topBar')}
    >
      <div className="flex items-center gap-4 md:gap-8">
        {/* Mobile hamburger */}
        <button
          className="text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-primary, #c6c6c7)] md:hidden"
          onClick={onOpenSidebar}
          aria-label={tTerminal('openSidebar')}
        >
          <Menu size={24} />
        </button>

        <span className="font-display text-2xl font-bold text-[#ffb779]">
          {tTerminal('managementTitle')}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aura-text-secondary, #a0a8b0)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={tTerminal('searchPlaceholder')}
            className="w-40 border-b border-[#44474d] bg-black/20 py-2 pl-10 pr-4 text-sm text-[var(--aura-text-primary, #e8e8e8)] outline-none transition-all placeholder:text-[var(--aura-text-secondary, #a0a8b0)]/60 focus:border-[#ffb779] md:w-64"
            aria-label={tTerminal('search')}
          />
        </div>

        {/* Icon buttons */}
        <button
          className="text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:text-[var(--aura-primary, #c6c6c7)]"
          aria-label={tTerminal('notifications')}
        >
          <Bell size={20} />
        </button>
        <button
          className="text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:text-[var(--aura-primary, #c6c6c7)]"
          aria-label={tTerminal('help')}
        >
          <HelpCircle size={20} />
        </button>
      </div>
    </header>
  );
}
