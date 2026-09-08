import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MD3AppShell, useDefaultNavItems } from '@/components/md3';
import StitchHeader from './StitchHeader';
import StitchFooter from './StitchFooter';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { cn } from '@/lib/cn';

// Pages that have their OWN header/nav built into the Stitch component
// or use their own layout shell (AdminLayout, MobileAppShell)
const PAGES_WITH_OWN_HEADER = new Set([
  '/', '/menu', '/container', '/order', '/order-failure', '/checkout',
  '/account', '/events', '/table-reservation',
  '/admin', '/mobile',
]);

/* ── Customer pages wrapped with MD3AppShell ─────────────── */
// key = pathname prefix; config = TopAppBar variant, nav bar visibility
const MD3_SHELL_CONFIG: {
  match: string;
  exact?: boolean;
  title: string;
  variant: 'small' | 'center-aligned' | 'medium' | 'large';
  showNav: boolean;
  showTop: boolean;
}[] = [
  { match: '/',      exact: true, title: 'AURA CAFE',   variant: 'small',           showNav: true,  showTop: false },
  { match: '/menu',              title: 'Thực đơn',     variant: 'small',           showNav: true,  showTop: true },
  { match: '/table-reservation', title: 'Đặt bàn',      variant: 'small',           showNav: true,  showTop: true },
  { match: '/account',           title: 'Tài khoản',    variant: 'center-aligned',  showNav: true,  showTop: true },
  { match: '/order',             title: 'Đặt món',      variant: 'small',           showNav: false, showTop: false },
  { match: '/checkout',          title: 'Thanh toán',   variant: 'small',           showNav: false, showTop: false },
];

interface StitchAppLayoutProps {
  children: ReactNode;
}

export function getShellConfig(pathname: string) {
  // Exact match first (so '/' doesn't swallow every route)
  const exactHit = MD3_SHELL_CONFIG.find((c) => c.exact && c.match === pathname);
  if (exactHit) return exactHit;
  return MD3_SHELL_CONFIG.find(
    (c) => !c.exact && pathname.startsWith(c.match),
  );
}

/** True when the MD3 bottom NavigationBar is mounted (cart bar must float above it) */
export function hasM3NavBar(pathname: string): boolean {
  return getShellConfig(pathname)?.showNav ?? false;
}

export default function StitchAppLayout({ children }: StitchAppLayoutProps) {
  const location = useLocation();
  const navItems = useDefaultNavItems();
  const shellConfig = getShellConfig(location.pathname);
  const hideHeader = PAGES_WITH_OWN_HEADER.has(location.pathname);

  /* ── Customer core pages → MD3AppShell ── */
  if (shellConfig) {
    return (
      <MD3AppShell
        title={shellConfig.title}
        navigationItems={navItems}
        topAppBarVariant={shellConfig.variant}
        showTopAppBar={shellConfig.showTop}
        showNavigationBar={shellConfig.showNav}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </MD3AppShell>
    );
  }

  /* ── All other pages → legacy Stitch layout ── */
  return (
    <div className="flex min-h-screen flex-col bg-[var(--aura-bg-surface)]">
      {/* Skip to content link -- visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:bg-[var(--aura-chrome-mid,#6B9FB8)] focus:text-white focus:text-sm focus:font-semibold focus:outline-none"
      >
        Skip to content / B&#x1ECF; qua n&#x1ED9;i dung
      </a>
      {!hideHeader && <StitchHeader />}
      <main id="main-content" className={cn('flex-1', hideHeader ? 'pt-0' : 'pt-16')}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      {!hideHeader && <StitchFooter />}
    </div>
  );
}
