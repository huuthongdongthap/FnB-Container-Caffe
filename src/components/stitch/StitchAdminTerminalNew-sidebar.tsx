import { forwardRef, type Ref } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SECTIONS } from './StitchAdminTerminalNew-constants';
import type { NavSectionData } from './StitchAdminTerminalNew-types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  brandName: string;
  brandSubtitle: string;
  adminName: string;
  terminalId: string;
  adminAvatarUrl: string;
}

function isActivePath(pathname: string, to: string): boolean {
  if (to === '/admin') {
    return pathname === '/admin' || pathname === '/admin/dashboard';
  }
  return pathname.startsWith(to);
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    { open, onClose, brandName, brandSubtitle, adminName, terminalId, adminAvatarUrl },
    ref: Ref<HTMLElement>,
  ) => {
    const { t } = useTranslation();
    const location = useLocation();
    const tNav = (key: string) => t(`nav.${key}`);
    const tTerminal = (key: string) => t(`terminal.${key}`);

    return (
      <aside
        ref={ref}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-[#44474d]/20 bg-[#0b203a]/40 py-6 backdrop-blur-xl shadow-[0_0_20px_rgba(205,127,50,0.15)] transition-transform duration-300 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={tTerminal('sidebar')}
      >
        {/* Brand header */}
        <div className="mb-6 px-6" aria-label={brandName}>
          <Link to="/admin">
            <h1 className="font-display text-[32px] font-semibold leading-10 tracking-tight text-[var(--aura-text-primary, #e8e8e8)]">
              {t('hero.title') || brandName}
            </h1>
          </Link>
          <p className="text-sm text-[var(--aura-text-secondary, #a0a8b0)] opacity-70">{brandSubtitle}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3" aria-label={tTerminal('mainNavigation')}>
          {SECTIONS.map((section: NavSectionData, si: number) => (
            <div key={si} className="mb-4">
              {section.title && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const active = isActivePath(location.pathname, item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 text-sm transition-all duration-300 ease-in-out rounded-lg mb-0.5',
                      active
                        ? 'border-r-2 border-[#ffb779] bg-[#955200]/20 text-[#ffb779]'
                        : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-[#273a55]/30 hover:text-[var(--aura-text-primary, #e8e8e8)]',
                    )}
                    aria-current={active ? 'page' : undefined}
                    aria-label={tNav(item.to)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto px-6">
          <button
            className="mb-6 w-full rounded-lg bg-[#CD7F32] py-3 font-bold text-white transition-transform active:scale-95"
            aria-label={tTerminal('generateReport')}
          >
            {tTerminal('generateReport')}
          </button>

          <div className="border-t border-[#44474d]/20 pt-6">
            {/* Admin profile */}
            <div className="mb-6 flex items-center gap-3">
              <div
                className="h-10 w-10 overflow-hidden rounded-full"
                style={{
                  border: '1px solid',
                  borderImageSource: 'linear-gradient(135deg, #E5E4E2 0%, rgba(22, 42, 68, 0.2) 100%)',
                  borderImageSlice: 1,
                }}
              >
                <img
                  className="h-full w-full object-cover"
                  src={adminAvatarUrl}
                  alt={tTerminal('adminAvatar')}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--aura-text-primary, #e8e8e8)]">{adminName}</p>
                <p className="text-xs text-[var(--aura-text-secondary, #a0a8b0)]">{terminalId}</p>
              </div>
            </div>

            {/* Logout */}
            <Link
              to="/"
              className="flex items-center gap-4 text-sm text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#ffb4ab]"
              aria-label={tTerminal('logout')}
            >
              <LogOut size={20} />
              <span>{tTerminal('logout')}</span>
            </Link>
          </div>
        </div>
      </aside>
    );
  },
);

Sidebar.displayName = 'Sidebar';
