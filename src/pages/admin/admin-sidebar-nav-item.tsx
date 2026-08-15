import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { NavItem } from './admin-sidebar-nav-config';

interface AdminSidebarNavItemProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

export function AdminSidebarNavItem({ item, active, collapsed, onClick }: AdminSidebarNavItemProps) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-accent/15 text-accent'
          : 'text-[var(--aura-chrome-light)]/60 hover:bg-[rgba(201,214,223,0.06)] hover:text-[var(--aura-chrome-light)]',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className={cn(
        'h-[18px] w-[18px] shrink-0 transition-colors',
        active ? 'text-accent' : 'text-[var(--aura-chrome-light)]/40 group-hover:text-[var(--aura-chrome-light)]',
      )} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
