/**
 * StitchOrderMgmtNew Sidebar
 * Collapsible sidebar navigation with brand header, nav items, and bottom actions.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Settings, LogOut } from 'lucide-react';
import { DEFAULT_NAV_ITEMS } from './stitch-order-mgmt-default';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface SidebarProps {
  brandName: string;
  brandSubtitle: string;
  activeNav: string;
  sidebarOpen: boolean;
  onClose: () => void;
}

/* ─── Sidebar Component ──────────────────────────────────────────────── */

export function StitchOrderMgmtSidebar({
  brandName,
  brandSubtitle,
  activeNav,
  sidebarOpen,
  onClose,
}: Readonly<SidebarProps>) {
  const { t } = useTranslation();
  const tNav = (key: string) => t(`nav.${key}`);
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col border-r border-white/10 bg-[#0b203a]/40 py-6 backdrop-blur-xl shadow-2xl shadow-black/50 transition-transform duration-300 md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      aria-label={tTerminal('sidebar')}
    >
      {/* Brand header */}
      <div className="mb-10 px-6" aria-label={brandName}>
        <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[0.02em] text-[var(--aura-text-primary, #e8e8e8)]">
          {t('hero.title') || brandName}
        </h1>
        <p className="mt-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
          {brandSubtitle}
        </p>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1" aria-label={tTerminal('mainNavigation')}>
        {DEFAULT_NAV_ITEMS.map((item) => {
          const isActive = item.key === activeNav;
          return (
            <a
              key={item.key}
              href="#"
              className={cn(
                'flex items-center gap-4 px-6 py-4 text-sm transition-all duration-300 active:scale-[0.98]',
                isActive
                  ? 'border-l-2 border-[var(--aura-primary, #c6c6c7)] bg-white/5 text-[var(--aura-primary, #c6c6c7)]'
                  : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/5 hover:text-[var(--aura-text-primary, #e8e8e8)]',
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tNav(item.key)}
            >
              {item.icon}
              <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em]">
                {tNav(item.key)}
              </span>
            </a>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto px-6">
        <button
          className="mb-6 w-full rounded-lg bg-gradient-to-br from-[var(--aura-primary, #c6c6c7)] to-[#8e9097] py-3 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#0c1c30] transition-all hover:brightness-110 active:scale-[0.97]"
          aria-label={tTerminal('newOrder')}
        >
          {tTerminal('newOrder')}
        </button>

        <div className="space-y-1 border-t border-white/5 pt-6">
          <a
            href="#"
            className="flex items-center gap-4 px-6 py-3 text-sm text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-text-primary, #e8e8e8)]"
            aria-label={tTerminal('settings')}
          >
            <Settings size={20} />
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em]">
              {tTerminal('settings')}
            </span>
          </a>
          <a
            href="#"
            className="flex items-center gap-4 px-6 py-3 text-sm text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#ffb4ab]"
            aria-label={tTerminal('logout')}
          >
            <LogOut size={20} />
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em]">
              {tTerminal('logout')}
            </span>
          </a>
        </div>
      </div>
    </aside>
  );
}
