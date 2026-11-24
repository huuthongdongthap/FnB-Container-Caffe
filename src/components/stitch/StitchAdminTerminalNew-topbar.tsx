import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TopBarProps {
  onOpenSidebar: () => void;
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-30 flex h-20 items-center justify-between gap-3 border-b bg-[var(--aura-bg-page, var(--aura-bg-surface))]/80 px-4 backdrop-blur-md lg:px-10 print:hidden no-print',
        'left-0 md:left-72',
      )}
      style={{
        borderImage: 'linear-gradient(to right, rgba(201,214,223,0.3), transparent) 1',
      }}
      aria-label={tTerminal('topBar')}
    >
      <div className="flex min-w-0 items-center gap-3 md:gap-6">
        {/* Mobile hamburger */}
        <button type="button"
          className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-primary, #c6c6c7)] md:hidden"
          onClick={onOpenSidebar}
          aria-label={tTerminal('openSidebar') || 'Open sidebar'}
        >
          <Menu size={24} />
        </button>

        <span className="truncate whitespace-nowrap font-display text-lg font-bold text-[var(--aura-chrome-bright, #E8EEF3)] lg:text-2xl">
          {tTerminal('managementTitle')}
        </span>
      </div>
    </header>
  );
}
