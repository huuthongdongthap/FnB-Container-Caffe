import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  labelEn: string;
  to: string;
  icon: typeof ShoppingCart;
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Tổng quan', labelEn: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Vận hành / Operations',
    items: [
      { label: 'Đơn hàng', labelEn: 'Orders', to: '/admin/orders', icon: ShoppingCart },
      { label: 'POS', labelEn: 'POS', to: '/admin/pos', icon: CreditCard },
      { label: 'Thực đơn', labelEn: 'Menu', to: '/admin/manage-menu', icon: UtensilsCrossed },
      { label: 'Đặt bàn', labelEn: 'Reservations', to: '/admin/reservations', icon: CalendarCheck },
      { label: 'Khách hàng', labelEn: 'Customers', to: '/admin/customers', icon: Users },
      { label: 'Nhân viên', labelEn: 'Staff', to: '/admin/staff', icon: UserCog },
  { label: 'Thiết bị', labelEn: 'Devices', to: '/admin/devices', icon: TabletSmartphone },
    ],
  },
  {
    title: 'Phân tích / Analytics',
    items: [
      { label: 'Phân tích', labelEn: 'Metrics', to: '/admin/metrics', icon: BarChart3 },
      { label: 'Báo cáo', labelEn: 'Sales Reports', to: '/admin/sales-reports', icon: FileBarChart },
    ],
  },
  {
    title: 'Tiếp thị / Marketing',
    items: [
      { label: 'Chiến dịch', labelEn: 'Campaigns', to: '/admin/campaigns', icon: Megaphone },
      { label: 'Khuyến mãi', labelEn: 'Promotions', to: '/admin/promotions', icon: Percent },
      { label: 'Tin nhắn', labelEn: 'Broadcast', to: '/admin/broadcasts', icon: Send },
    ],
  },
  {
    title: 'Giao tiếp / Communication',
    items: [
      { label: 'Chat', labelEn: 'Chat', to: '/admin/chat', icon: MessageSquare },
    ],
  },
  {
    title: 'Hệ thống / System',
    items: [
      { label: 'Nhật ký', labelEn: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText },
      { label: 'Duyệt Check-in', labelEn: 'Check-in Approve', to: '/admin/checkin-approve', icon: ClipboardCheck },
      { label: 'Đồng bộ ERPNext', labelEn: 'ERPNext Sync', to: '/admin/erpnext-sync', icon: RefreshCw },
      { label: 'Gói thuê bao', labelEn: 'Subscriptions', to: '/admin/subscriptions', icon: Gem },
      { label: 'Hóa đơn', labelEn: 'Invoices', to: '/admin/invoice-history', icon: Receipt },
      { label: 'QR Code', labelEn: 'QR Codes', to: '/admin/generate-qr', icon: QrCode },
      { label: 'Thông báo', labelEn: 'Notifications', to: '/admin/notification-settings', icon: Bell },
{ label: 'Sinh nhật', labelEn: 'Birthday Config', to: '/admin/birthday-config', icon: Cake },
    ],
  },
];

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        aria-label="Mở menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--aura-border-subtle)] bg-[var(--aura-bg-elevated)] shadow-[var(--aura-shadow-lg)] transition-all duration-300',
          // Desktop: always visible
          'hidden lg:flex',
          collapsed ? 'w-16' : 'w-64',
          // Mobile: drawer overlay
          mobileOpen ? 'flex w-72 translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--aura-border-subtle)] px-4">
          {!collapsed && (
            <Link to="/admin" className="font-display text-lg font-bold tracking-wide text-[var(--aura-chrome-bright)]">
              Quản trị
            </Link>
          )}
          <div className="flex items-center gap-1">
            {onToggle && (
              <button
                onClick={onToggle}
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--aura-chrome-mid)] hover:bg-white/5 hover:text-[var(--aura-chrome-bright)] transition-colors lg:flex"
                aria-label={collapsed ? 'Mở rộng' : 'Thu gọn'}
              >
                <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
              </button>
            )}
            <button
              onClick={() => setMobileOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--aura-chrome-mid)] hover:bg-white/5 hover:text-[var(--aura-chrome-bright)] transition-colors lg:hidden"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {SECTIONS.map((section, si) => (
            <div key={si} className="mb-4">
              {section.title && !collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-chrome-mid)]">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.to);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          active
                            ? 'bg-[var(--aura-primary)]/10 text-[var(--aura-primary)] shadow-sm'
                            : 'text-[var(--aura-text-body)] hover:bg-white/5 hover:text-[var(--aura-chrome-bright)]',
                          collapsed && 'justify-center px-2',
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className={cn('h-5 w-5 shrink-0', active && 'text-[var(--aura-primary)]')} />
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-[var(--aura-border-subtle)] px-4 py-3">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--aura-chrome-mid)] hover:bg-white/5 hover:text-[var(--aura-chrome-bright)] transition-colors"
            >
              ← Về trang chủ
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
