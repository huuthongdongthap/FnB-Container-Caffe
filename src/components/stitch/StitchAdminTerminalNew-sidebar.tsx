import { forwardRef, type Ref } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { SECTIONS } from './StitchAdminTerminalNew-constants';
import { filterAdminNavSections } from './admin-nav-visibility';
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
  if (to === '/admin/hq-saas') {
    return pathname.startsWith('/admin/hq-saas') || pathname.startsWith('/admin/hq/tenants');
  }
  return pathname.startsWith(to);
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    { open, onClose, brandName, brandSubtitle, adminName, terminalId, adminAvatarUrl },
    ref: Ref<HTMLElement>,
  ) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const visibleSections = filterAdminNavSections(SECTIONS, user);
    const isPosRoute = location.pathname.startsWith('/admin/pos');
    const isEn = i18n?.language?.startsWith('en') ?? false;
    const tNav = (key: string, fallback: string) => t(`nav.${key}`, { defaultValue: fallback });
    const tTerminal = (key: string) => t(`terminal.${key}`);
    const resolvedAdminName = user?.name || user?.email || adminName;
    const resolvedRoleLabel = user?.role
      ? t(`terminal.role.${user.role}`, { defaultValue: user.role })
      : '';
    const resolvedTerminalId = user
      ? [resolvedRoleLabel, user.tenantId && user.tenantId !== 'default' ? user.tenantId : ''].filter(Boolean).join(' · ') || terminalId
      : terminalId;
    const resolvedBrandSubtitle = brandSubtitle || tTerminal('managementTitle');

    return (
      <aside
        ref={ref}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-[var(--st-outline-variant, #44474d)]/20 bg-[var(--aura-noir-deep, #0A1A2E)]/95 md:bg-[var(--aura-noir-deep, #0A1A2E)]/40 py-6 backdrop-blur-xl shadow-[0_0_20px_rgba(205,127,50,0.15)] transition-transform duration-300',
          !isPosRoute && 'md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={tTerminal('sidebar')}
      >
        {/* Brand header */}
        <div className="mb-6 px-6" aria-label={brandName}>
          <Link to="/admin" onClick={onClose} className="inline-block min-h-[44px]">
            <span className="block font-display text-[32px] font-semibold leading-10 tracking-tight text-[var(--aura-text-primary, #e8e8e8)]">
              {t('hero.title') || brandName}
            </span>
          </Link>
          <p className="text-sm text-[var(--aura-text-secondary, #a0a8b0)] opacity-70">{resolvedBrandSubtitle}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3" aria-label={tTerminal('mainNavigation')}>
          {visibleSections.map((section: NavSectionData, si: number) => (
            <div key={si} className="mb-4">
              {(section.titleKey || section.title) && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
                  {section.titleKey ? t(section.titleKey, { defaultValue: section.title }) : section.title}
                </p>
              )}
              {section.items.map((item) => {
                const active = isActivePath(location.pathname, item.to);
                const Icon = item.icon;
                const itemLabel = isEn ? item.labelEn : item.label;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 text-sm transition-all duration-300 ease-in-out rounded-lg mb-0.5',
                      active
                        ? 'border-r-2 border-[var(--aura-chrome-bright, #E8EEF3)] bg-[rgba(201,214,223,0.1)] text-[var(--aura-chrome-bright, #E8EEF3)]'
                        : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-[var(--st-surface-container-highest, #273a55)]/30 hover:text-[var(--aura-text-primary, #e8e8e8)]',
                    )}
                    aria-current={active ? 'page' : undefined}
                    aria-label={tNav(item.to, itemLabel)}
                  >
                    <Icon size={20} />
                    <span>{itemLabel}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto px-6">
          <button type="button"
            onClick={() => {
              navigate('/admin/sales-reports');
              onClose();
            }}
            className="mb-6 w-full rounded-lg bg-[var(--aura-chrome-mid, #6B9FB8)] py-3 font-bold text-white transition-transform active:scale-95"
            aria-label={tTerminal('generateReport')}
          >
            {tTerminal('generateReport')}
          </button>

          <div className="border-t border-[var(--aura-text-muted, #8A8E96)]/20 pt-6">
            {/* Admin profile */}
            <div className="mb-6 flex items-center gap-3">
              <div
                className="h-10 w-10 overflow-hidden rounded-full"
                style={{
                  border: '1px solid',
                  borderImageSource: 'linear-gradient(135deg, var(--aura-chrome-bright, #E8EEF3) 0%, rgba(22, 42, 68, 0.2) 100%)',
                  borderImageSlice: 1,
                }}
              >
                {adminAvatarUrl?.trim() ? (
                  <img
                    className="h-full w-full object-cover"
                    src={adminAvatarUrl}
                    alt={tTerminal('adminAvatar')}
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-[var(--aura-text-primary, #e8e8e8)]"
                    aria-label={tTerminal('adminAvatar')}
                  >
                    {resolvedAdminName?.charAt(0) || 'A'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--aura-text-primary, #e8e8e8)]">{resolvedAdminName}</p>
                <p className="text-xs text-[var(--aura-text-secondary, #a0a8b0)]">{resolvedTerminalId}</p>
              </div>
            </div>

            {/* Logout */}
            <Link
              to="/admin/login"
              onClick={() => {
                void useAuthStore.getState().logout();
              }}
              className="flex items-center gap-4 text-sm text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-error, #FFB4AB)]"
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
