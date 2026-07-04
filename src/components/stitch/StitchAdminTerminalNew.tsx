/**
 * StitchAdminTerminalNew — Aura Cafe Admin Terminal (Stitch v2 design)
 *
 * Dark navy glassmorphism admin panel with chrome/bronze accents.
 * Serves as the admin layout shell wrapping <Outlet /> for nested routes.
 * Features:
 * - Sidebar nav with section groups and active state
 * - Top app bar with search and notifications
 * - Mobile-first responsive layout (sidebar drawer on mobile)
 * - Full i18n support (bilingual EN + VI)
 * - Accessible ARIA labels
 */
'use client';

import { useState, useRef, type ReactNode } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import {
  LayoutDashboard,
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
  Cake,
  Search,
  Bell,
  HelpCircle,
  LogOut,
  Menu,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface NavItemData {
  label: string;
  labelEn: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface NavSectionData {
  title?: string;
  items: NavItemData[];
}

export interface StitchAdminTerminalNewProps {
  /** Brand title shown in sidebar */
  brandName?: string;
  /** Subtitle shown below brand */
  brandSubtitle?: string;
  /** Admin profile display name */
  adminName?: string;
  /** Admin terminal identifier */
  terminalId?: string;
  /** Admin avatar image URL */
  adminAvatarUrl?: string;
  /** Optional children to render in main area (falls back to <Outlet />) */
  children?: ReactNode;
}

/* ─── Nav Data from AdminSidebar ────────────────────────────────── */

const SECTIONS: NavSectionData[] = [
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
      { label: 'Sinh nhật', labelEn: 'Birthday Config', to: '/admin/birthday-config', icon: Cake },
    ],
  },
];

const DEFAULT_ADMIN_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA1O_JHnI2TB5NXoAW5JCxJk1sSSA5-VpsSne05ApSN-rAJ-0nZByALpEIQP0jDi81VcUdUTqmqIPUxAISZG8ce8lE1zr0g9utVt3TdasEGgtqlvwwh5jtT51uOTNZ3Yu5WSCvwy2JgQY8SqO96F5PMwz94ZpMPu4hXscVEgQXsFKCcPEUiXJ3uYozgXn41R0wWQxhmP0CHH6Sf43J3-RX3Mx5wz98iZ2QUlKfUhx-OWXscVee7kNzMR5FbWYCY5z2ZmVc3VODJBqM';

/* ─── Component ────────────────────────────────────────────────── */

export function StitchAdminTerminalNew({
  brandName = 'Aura Cafe',
  brandSubtitle = 'Admin Terminal',
  adminName = 'Aura Admin',
  terminalId = 'Terminal #012',
  adminAvatarUrl = DEFAULT_ADMIN_AVATAR,
  children,
}: Readonly<StitchAdminTerminalNewProps>) {
  const { t } = useTranslation();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sidebarRef = useRef<HTMLElement>(null);

  useFocusTrap(sidebarOpen, () => setSidebarOpen(false), sidebarRef);

  const isActive = (to: string) => {
    if (to === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(to);
  };

  const tNav = (key: string) => t(`nav.${key}`);
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <div className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] font-body text-[var(--aura-text-primary, #e8e8e8)]">
      {/* ─── Mobile Sidebar Overlay ─── */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={tTerminal('closeSidebar')}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        ref={sidebarRef}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-[#44474d]/20 bg-[#0b203a]/40 py-6 backdrop-blur-xl shadow-[0_0_20px_rgba(205,127,50,0.15)] transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
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
          {SECTIONS.map((section, si) => (
            <div key={si} className="mb-4">
              {section.title && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const active = isActive(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
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
                  borderImageSource:
                    'linear-gradient(135deg, #E5E4E2 0%, rgba(22, 42, 68, 0.2) 100%)',
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

      {/* ─── Top App Bar ─── */}
      <header
        className={cn(
          'fixed right-0 top-0 z-30 flex h-20 items-center justify-between border-b bg-[var(--aura-bg-page, #0A1A2E)]/60 px-4 backdrop-blur-md md:px-10',
          'left-0 md:left-72',
        )}
        style={{
          borderImage:
            'linear-gradient(to right, rgba(229,228,226,0.3), transparent) 1',
        }}
        aria-label={tTerminal('topBar')}
      >
        <div className="flex items-center gap-4 md:gap-8">
          {/* Mobile hamburger */}
          <button
            className="text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-primary, #c6c6c7)] md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label={tTerminal('openSidebar')}
          >
            <Menu size={24} />
          </button>

          <span className="font-display text-2xl font-bold text-[#ffb779]">
            {tTerminal('managementTitle')}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aura-text-secondary, #a0a8b0)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tTerminal('searchPlaceholder')}
              className="w-40 border-b border-[#44474d] bg-black/20 py-2 pl-10 pr-4 text-sm text-[var(--aura-text-primary, #e8e8e8)] outline-none transition-all placeholder:text-[var(--aura-text-secondary, #a0a8b0)]/60 focus:border-[#ffb779] md:w-64"
              aria-label={tTerminal('search')}
            />
          </div>

          {/* Icon buttons */}
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
        </div>
      </header>

      {/* ─── Main Content (routed via Outlet or children) ─── */}
      <main
        className={cn(
          'min-h-screen pt-24 px-4 pb-8 md:px-10',
          'md:ml-72',
        )}
        aria-label={tTerminal('mainContent')}
      >
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
