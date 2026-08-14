/**
 * StitchOrderMgmtNew Header & Sidebar
 * Collapsible sidebar navigation and top app bar with search and actions.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  Settings,
  LogOut,
  Bell,
  HelpCircle,
  Menu,
} from 'lucide-react';
import { DEFAULT_NAV_ITEMS } from './stitch-order-mgmt-default';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface HeaderProps {
  brandName: string;
  brandSubtitle: string;
  headerTitle: string;
  headerSubtitle: string;
  adminName: string;
  adminAvatarUrl: string;
  activeNav: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/* ─── Sidebar ────────────────────────────────────────────────────────── */

function Sidebar({
  brandName,
  brandSubtitle,
  activeNav,
  sidebarOpen,
  onClose,
}: {
  brandName: string;
  brandSubtitle: string;
  activeNav: string;
  sidebarOpen: boolean;
  onClose: () => void;
}) {
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

/* ─── Top App Bar ────────────────────────────────────────────────────── */

function TopAppBar({
  headerTitle,
  headerSubtitle,
  adminName,
  adminAvatarUrl,
  onToggleSidebar,
}: {
  headerTitle: string;
  headerSubtitle: string;
  adminName: string;
  adminAvatarUrl: string;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[var(--aura-bg-page, #0A1A2E)]/60 px-4 backdrop-blur-md md:px-6',
        'left-0 md:left-[280px]',
      )}
      aria-label={tTerminal('topBar')}
    >
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <button
          className="text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-primary, #c6c6c7)] md:hidden"
          onClick={onToggleSidebar}
          aria-label={tTerminal('openSidebar')}
        >
          <Menu size={24} />
        </button>

        <span className="font-sans text-xl font-semibold text-[var(--aura-primary, #c6c6c7)]">
          {headerTitle}
        </span>

        <span className="hidden h-4 w-px bg-white/10 md:block" aria-hidden="true" />

        <span className="hidden font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] md:block">
          {headerSubtitle}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4 md:gap-6">
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
        {/* Admin avatar */}
        <div
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#292a2c]"
          aria-label={tTerminal('adminAvatar')}
        >
          {adminAvatarUrl ? (
            <img
              className="h-full w-full object-cover"
              src={adminAvatarUrl}
              alt={tTerminal('adminAvatar')}
            />
          ) : (
            <span className="text-xs font-bold text-[var(--aura-text-secondary, #a0a8b0)]">
              {adminName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── Combined Header Export ─────────────────────────────────────────── */

export function StitchOrderMgmtHeader(props: Readonly<HeaderProps>) {
  const { sidebarOpen, onToggleSidebar, ...rest } = props;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onToggleSidebar}
          aria-label="Close sidebar"
        />
      )}

      <Sidebar
        brandName={rest.brandName}
        brandSubtitle={rest.brandSubtitle}
        activeNav={rest.activeNav}
        sidebarOpen={sidebarOpen}
        onClose={onToggleSidebar}
      />

      <TopAppBar
        headerTitle={rest.headerTitle}
        headerSubtitle={rest.headerSubtitle}
        adminName={rest.adminName}
        adminAvatarUrl={rest.adminAvatarUrl}
        onToggleSidebar={onToggleSidebar}
      />
    </>
  );
}
