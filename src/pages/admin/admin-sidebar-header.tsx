import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { X, ChevronLeft } from 'lucide-react';

interface AdminSidebarHeaderProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

export function AdminSidebarHeader({ collapsed, mobileOpen, onClose }: AdminSidebarHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex h-16 items-center justify-between border-b border-[var(--glass-border)] px-4">
      {!collapsed && (
        <span className="text-sm font-semibold tracking-wide text-[var(--aura-chrome-light)]">
          AURA CAFE
        </span>
      )}
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--aura-chrome-light)]/60 hover:text-[var(--aura-chrome-light)] hover:bg-[rgba(201,214,223,0.08)] transition-colors"
        aria-label={collapsed ? t('adminSidebar.openMenu') : t('adminSidebar.closeSidebar')}
      >
        {mobileOpen
          ? <X className="h-4 w-4" />
          : <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />}
      </button>
    </div>
  );
}
