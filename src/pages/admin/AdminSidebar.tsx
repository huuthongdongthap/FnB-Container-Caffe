import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Menu } from 'lucide-react';
import { getSections } from './admin-sidebar-nav-config';
import { AdminSidebarHeader } from './admin-sidebar-header';
import { AdminSidebarNavItem } from './admin-sidebar-nav-item';

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const { t } = useTranslation('common');
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = getSections(t);

  const isActive = (to: string) => {
    if (to === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(to);
  };

  const handleClose = () => {
    if (mobileOpen) {
      setMobileOpen(false);
    } else if (onToggle) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--aura-bg-elevated)] text-[var(--aura-chrome-light)] shadow-lg backdrop-blur-sm lg:hidden"
        aria-label={t('adminSidebar.openMenu')}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--glass-border)] bg-[var(--aura-bg-elevated)]/90 backdrop-blur-xl transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[260px]',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0',
        )}
      >
        <AdminSidebarHeader collapsed={!!collapsed} mobileOpen={mobileOpen} onClose={handleClose} />

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {section.title && (
                <h3 className={cn(
                  'mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-chrome-light)]/40',
                  collapsed && 'text-center',
                )}>
                  {collapsed ? section.title.charAt(0) : section.title}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <AdminSidebarNavItem
                    key={item.to}
                    item={item}
                    active={isActive(item.to)}
                    collapsed={!!collapsed}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
