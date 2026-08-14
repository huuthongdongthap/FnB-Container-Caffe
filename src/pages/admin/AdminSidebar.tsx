import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  ShoppingCart,
  CreditCard,
  UtensilsCrossed,
  CalendarCheck,
  Users,
  UserCog,
  BarChart3,
  FileBarChart,
  Megaphone,
  Percent,
  Send,
  MessageSquare,
  ScrollText,
  ClipboardCheck,
  RefreshCw,
  Gem,
  Receipt,
  QrCode,
  LayoutDashboard,
  Menu,
  X,
  ChevronLeft,
  Cake,
  Bell,
  TabletSmartphone,
} from 'lucide-react';

type NavItem = {
  label: string;
  to: string;
  icon: typeof ShoppingCart;
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

function getSections(t: (key: string) => string): NavSection[] {
  const item = (key: string, to: string, icon: typeof ShoppingCart): NavItem =>
    ({ label: t(`adminSidebar.items.${key}`), to, icon });
  return [
    {
      items: [
        item('dashboard', '/admin', LayoutDashboard),
      ],
    },
    {
      title: t('adminSidebar.sectionOperations'),
      items: [
        item('orders', '/admin/orders', ShoppingCart),
        item('pos', '/admin/pos', CreditCard),
        item('menu', '/admin/manage-menu', UtensilsCrossed),
        item('reservations', '/admin/reservations', CalendarCheck),
        item('customers', '/admin/customers', Users),
        item('staff', '/admin/staff', UserCog),
        item('devices', '/admin/devices', TabletSmartphone),
      ],
    },
    {
      title: t('adminSidebar.sectionAnalytics'),
      items: [
        item('metrics', '/admin/metrics', BarChart3),
        item('salesReports', '/admin/sales-reports', FileBarChart),
      ],
    },
    {
      title: t('adminSidebar.sectionMarketing'),
      items: [
        item('promotions', '/admin/promotions', Percent),
        item('broadcast', '/admin/broadcast', Megaphone),
        item('chat', '/admin/chat', MessageSquare),
      ],
    },
    {
      title: t('adminSidebar.sectionSystem'),
      items: [
        item('auditLogs', '/admin/audit-logs', ScrollText),
        item('checkinApprove', '/admin/checkin-approve', ClipboardCheck),
        item('erpnext', '/admin/erpnext-sync', RefreshCw),
        item('subscriptions', '/admin/subscriptions', Gem),
        item('invoices', '/admin/invoice-history', Receipt),
        item('qrCodes', '/admin/generate-qr', QrCode),
        item('notifications', '/admin/notification-settings', Bell),
        item('birthdayConfig', '/admin/birthday-config', Cake),
      ],
    },
  ];
}

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
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--glass-border)] px-4">
          {!collapsed && (
            <span className="text-sm font-semibold tracking-wide text-[var(--aura-chrome-light)]">
              AURA CAFE
            </span>
          )}
          <button
            onClick={() => {
              if (mobileOpen) {
                setMobileOpen(false);
              } else if (onToggle) {
                onToggle();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--aura-chrome-light)]/60 hover:text-[var(--aura-chrome-light)] hover:bg-[rgba(201,214,223,0.08)] transition-colors"
            aria-label={collapsed ? t('adminSidebar.openMenu') : t('adminSidebar.closeSidebar')}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />}
          </button>
        </div>

        {/* Navigation */}
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
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
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
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
