/**
 * StitchAdminTerminalNew — Aura Cafe Admin Terminal (Stitch v2 design)
 *
 * Dark navy glassmorphism admin panel with chrome/bronze accents.
 * Features:
 * - Collapsible sidebar nav with active state
 * - Top app bar with search and notifications
 * - 4 stat overview cards (Revenue, Orders, Customers, Avg Order Value)
 * - Revenue growth SVG chart with gradient fill
 * - Mobile-first responsive layout
 * - Full i18n support (bilingual EN + VI)
 * - Accessible ARIA labels
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard,
  Factory,
  Package,
  BadgeCheck,
  Banknote,
  Settings,
  Search,
  Bell,
  HelpCircle,
  TrendingUp,
  Coffee,
  Users,
  BarChart3,
  LogOut,
  Menu,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface StatCardData {
  label: string;
  value: string;
  change?: number;
  icon: 'revenue' | 'orders' | 'customers' | 'avgOrder';
}

export interface NavItem {
  label: string;
  key: string;
  icon: React.ReactNode;
  active?: boolean;
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
  /** Stat card data (defaults to built-in data) */
  stats?: StatCardData[];
  /** Active nav item key */
  activeNav?: string;
  /** Top bar tabs */
  topTabs?: { key: string; label: string; active?: boolean }[];
}

/* ─── Default Data ─────────────────────────────────────────────── */

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', key: 'dashboard', icon: <LayoutDashboard size={20} />, active: true },
  { label: 'Operations', key: 'operations', icon: <Factory size={20} /> },
  { label: 'Inventory', key: 'inventory', icon: <Package size={20} /> },
  { label: 'Staffing', key: 'staffing', icon: <BadgeCheck size={20} /> },
  { label: 'Financials', key: 'financials', icon: <Banknote size={20} /> },
  { label: 'Settings', key: 'settings', icon: <Settings size={20} /> },
];

const DEFAULT_STATS: StatCardData[] = [
  { label: 'TOTAL REVENUE', value: '$42,850.00', change: 12, icon: 'revenue' },
  { label: 'ACTIVE ORDERS', value: '156', icon: 'orders' },
  { label: 'NEW CUSTOMERS', value: '1,204', icon: 'customers' },
  { label: 'AVG. ORDER VALUE', value: '$28.50', icon: 'avgOrder' },
];

const DEFAULT_TOP_TABS = [
  { key: 'live-view', label: 'Live View', active: true },
  { key: 'analytics', label: 'Analytics' },
  { key: 'reports', label: 'Reports' },
];

const DEFAULT_ADMIN_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA1O_JHnI2TB5NXoAW5JCxJk1sSSA5-VpsSne05ApSN-rAJ-0nZByALpEIQP0jDi81VcUdUTqmqIPUxAISZG8ce8lE1zr0g9utVt3TdasEGgtqlvwwh5jtT51uOTNZ3Yu5WSCvwy2JgQY8SqO96F5PMwz94ZpMPu4hXscVEgQXsFKCcPEUiXJ3uYozgXn41R0wWQxhmP0CHH6Sf43J3-RX3Mx5wz98iZ2QUlKfUhx-OWXscVee7kNzMR5FbWYCY5z2ZmVc3VODJBqM';

/* ─── Stat Icon Map ────────────────────────────────────────────── */

const STAT_ICONS: Record<StatCardData['icon'], React.ReactNode> = {
  revenue: <TrendingUp size={18} className="text-[#CD7F32]" />,
  orders: <Coffee size={20} className="text-[#c5c6cd]" />,
  customers: <Users size={20} className="text-[#c5c6cd]" />,
  avgOrder: <BarChart3 size={20} className="text-[#c5c6cd]" />,
};

/* ─── Component ────────────────────────────────────────────────── */

export function StitchAdminTerminalNew({
  brandName = 'Aura Cafe',
  brandSubtitle = 'Admin Terminal',
  adminName = 'Aura Admin',
  terminalId = 'Terminal #012',
  adminAvatarUrl = DEFAULT_ADMIN_AVATAR,
  stats = DEFAULT_STATS,
  activeNav = 'dashboard',
  topTabs = DEFAULT_TOP_TABS,
}: Readonly<StitchAdminTerminalNewProps>) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tNav = (key: string) => t(`nav.${key}`);
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <div className="relative min-h-screen bg-[#0A1A2E] font-['Space_Grotesk',sans-serif] text-[#d4e3ff]">
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
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-[#44474d]/20 bg-[#0b203a]/40 py-6 backdrop-blur-xl shadow-[0_0_20px_rgba(205,127,50,0.15)] transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={tTerminal('sidebar')}
      >
        {/* Brand header */}
        <div className="mb-10 px-6" aria-label={brandName}>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[32px] font-semibold leading-10 tracking-tight text-[#d4e3ff]">
            {t('hero.title') || brandName}
          </h1>
          <p className="text-sm text-[#c5c6cd] opacity-70">{brandSubtitle}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1" aria-label={tTerminal('mainNavigation')}>
          {DEFAULT_NAV_ITEMS.map((item) => {
            const isActive = item.key === activeNav;
            return (
              <a
                key={item.key}
                href="#"
                className={cn(
                  'flex items-center gap-4 px-6 py-4 text-sm transition-all duration-300 ease-in-out',
                  isActive
                    ? 'border-r-2 border-[#ffb779] bg-[#955200]/20 text-[#ffb779]'
                    : 'text-[#c5c6cd] hover:bg-[#273a55]/30 hover:text-[#d4e3ff]',
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tNav(item.key)}
              >
                {item.icon}
                <span>{tNav(item.key)}</span>
              </a>
            );
          })}
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
                <p className="text-sm font-semibold text-[#d4e3ff]">{adminName}</p>
                <p className="text-xs text-[#c5c6cd]">{terminalId}</p>
              </div>
            </div>

            {/* Logout */}
            <a
              href="#"
              className="flex items-center gap-4 text-sm text-[#c5c6cd] transition-colors hover:text-[#ffb4ab]"
              aria-label={tTerminal('logout')}
            >
              <LogOut size={20} />
              <span>{tTerminal('logout')}</span>
            </a>
          </div>
        </div>
      </aside>

      {/* ─── Top App Bar ─── */}
      <header
        className={cn(
          'fixed right-0 top-0 z-30 flex h-20 items-center justify-between border-b bg-[#00142c]/60 px-4 backdrop-blur-md md:px-10',
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
            className="text-[#c5c6cd] transition-colors hover:text-[#b8c7e2] md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label={tTerminal('openSidebar')}
          >
            <Menu size={24} />
          </button>

          <span className="font-['Libre_Caslon_Text',serif] text-2xl font-bold text-[#ffb779]">
            {tTerminal('managementTitle')}
          </span>

          {/* Desktop tabs */}
          <div className="hidden gap-6 md:flex">
            {topTabs.map((tab) => (
              <a
                key={tab.key}
                href="#"
                className={cn(
                  'text-sm transition-all',
                  tab.active
                    ? 'border-b border-[#ffb779] pb-1 text-[#ffb779]'
                    : 'text-[#c5c6cd] hover:text-[#d4e3ff]',
                )}
                aria-current={tab.active ? 'page' : undefined}
                aria-label={tTerminal(`tab.${tab.key}`)}
              >
                {tTerminal(`tab.${tab.key}`)}
              </a>
            ))}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c5c6cd]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tTerminal('searchPlaceholder')}
              className="w-40 border-b border-[#44474d] bg-black/20 py-2 pl-10 pr-4 text-sm text-[#d4e3ff] outline-none transition-all placeholder:text-[#c5c6cd]/60 focus:border-[#ffb779] md:w-64"
              aria-label={tTerminal('search')}
            />
          </div>

          {/* Icon buttons */}
          <button
            className="text-[#c5c6cd] transition-all hover:text-[#b8c7e2]"
            aria-label={tTerminal('notifications')}
          >
            <Bell size={20} />
          </button>
          <button
            className="text-[#c5c6cd] transition-all hover:text-[#b8c7e2]"
            aria-label={tTerminal('help')}
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main
        className={cn(
          'min-h-screen pt-24 px-4 pb-8 md:px-10',
          'md:ml-72',
        )}
        aria-label={tTerminal('mainContent')}
      >
        {/* ─── Analytics Overview ─── */}
        <section className="mb-12" aria-label={tTerminal('analyticsOverview')}>
          {/* Stat cards grid */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex h-40 flex-col justify-between rounded-lg p-6"
                style={{
                  background: 'rgba(11, 32, 58, 0.4)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid',
                  borderImageSource:
                    'linear-gradient(135deg, #E5E4E2 0%, rgba(22, 42, 68, 0.2) 100%)',
                  borderImageSlice: 1,
                }}
                aria-label={tTerminal(`stat.${stat.icon}`)}
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <span className="font-['Space_Grotesk',sans-serif] text-[12px] font-bold uppercase leading-4 tracking-[0.1em] text-[#ffb779]">
                    {stat.label}
                  </span>
                  {stat.change !== undefined ? (
                    <span className="flex items-center text-sm font-bold text-[#CD7F32]">
                      +{stat.change}%{' '}
                      <TrendingUp size={14} className="ml-1" />
                    </span>
                  ) : (
                    <span className="text-[#c5c6cd]">
                      {STAT_ICONS[stat.icon]}
                    </span>
                  )}
                </div>

                {/* Value */}
                <div className="mt-4">
                  <span className="font-['Cormorant_Garamond',serif] text-[40px] font-normal leading-[48px] tracking-[0.05em] text-[#d4e3ff]">
                    {stat.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Revenue Chart ─── */}
          <div
            className="relative h-[400px] w-full overflow-hidden rounded-lg p-6 md:p-8"
            style={{
              background: 'rgba(11, 32, 58, 0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid',
              borderImageSource:
                'linear-gradient(135deg, #E5E4E2 0%, rgba(22, 42, 68, 0.2) 100%)',
              borderImageSlice: 1,
            }}
            aria-label={tTerminal('revenueChart')}
          >
            {/* Chart header */}
            <div className="relative z-10 mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-['Libre_Caslon_Text',serif] text-2xl font-semibold leading-10 text-[#d4e3ff] md:text-[32px]">
                  {tTerminal('revenueGrowth')}
                </h2>
                <p className="text-sm text-[#c5c6cd]">
                  {tTerminal('revenueSubtitle')}
                </p>
              </div>

              {/* Period toggle */}
              <div className="flex gap-2">
                <button className="rounded border border-[#ffb779]/20 bg-[#955200]/30 px-4 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#ffb779]">
                  {tTerminal('monthly')}
                </button>
                <button className="rounded px-4 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#c5c6cd] transition-colors hover:bg-white/5">
                  {tTerminal('quarterly')}
                </button>
              </div>
            </div>

            {/* SVG Chart Visualization */}
            <div className="absolute inset-0 px-6 pb-8 pt-32 md:px-8" aria-hidden="true">
              <div className="flex h-full w-full items-end gap-1">
                <svg
                  className="h-full w-full"
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 300"
                  role="img"
                  aria-label={tTerminal('chartVisualization')}
                >
                  <defs>
                    <linearGradient id="chartGradientAdmin" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#CD7F32" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#CD7F32" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* Area fill */}
                  <path
                    d="M0,250 Q100,220 200,240 T400,150 T600,180 T800,80 T1000,50 L1000,300 L0,300 Z"
                    fill="url(#chartGradientAdmin)"
                  />
                  {/* Line stroke */}
                  <path
                    d="M0,250 Q100,220 200,240 T400,150 T600,180 T800,80 T1000,50"
                    fill="none"
                    stroke="#CD7F32"
                    strokeWidth={3}
                    strokeLinecap="round"
                    filter="drop-shadow(0 0 8px rgba(205,127,50,0.6))"
                  />
                  {/* Data points */}
                  <circle cx="200" cy="240" fill="#CD7F32" r={4} />
                  <circle cx="400" cy="150" fill="#CD7F32" r={4} />
                  <circle cx="600" cy="180" fill="#CD7F32" r={4} />
                  <circle cx="800" cy="80" fill="#CD7F32" r={4} />
                  <circle
                    cx="1000"
                    cy="50"
                    fill="#CD7F32"
                    r={6}
                    className="animate-pulse"
                  />
                </svg>
              </div>
            </div>

            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 opacity-10 md:p-8">
              <div className="w-full border-b border-[#d4e3ff]" />
              <div className="w-full border-b border-[#d4e3ff]" />
              <div className="w-full border-b border-[#d4e3ff]" />
              <div className="w-full border-b border-[#d4e3ff]" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
