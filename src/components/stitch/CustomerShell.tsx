import { MD3AppShell } from '@/components/md3';
import { useDefaultNavItems } from '@/components/md3';
import { getShellConfig, hasM3NavBar } from './shell-config';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Award, User } from 'lucide-react';
import type { ReactNode } from 'react';
import CartBottomBar from '@/components/cart/cart-bottom-bar';

export default function CustomerShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navItems = useDefaultNavItems();
  const shellConfig = getShellConfig(location.pathname);
  const showNav = hasM3NavBar(location.pathname);
  const showTop = shellConfig?.showTop ?? true;
  const variant = shellConfig?.variant ?? 'small';
  const title = shellConfig?.title ?? 'AURA CAFE';

  const topBarActions: ReactNode[] = [
    <Link
      key="loyalty-action"
      to="/loyalty"
      aria-label="Tích điểm & Ví hoàn tiền"
      title="Tích điểm & Ví hoàn tiền"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-md-on-surface transition-colors"
    >
      <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Ví &amp; Điểm</span>
    </Link>,
    <Link
      key="account-action"
      to="/account"
      aria-label="Hồ sơ hội viên"
      title="Hồ sơ hội viên"
      className="inline-flex items-center justify-center w-10 h-10 min-h-[40px] min-w-[40px] rounded-full hover:bg-white/10 text-md-on-surface-variant hover:text-md-on-surface transition-colors"
    >
      <User className="w-5 h-5" aria-hidden="true" />
    </Link>,
  ];

  return (
    <div data-shell="customer" className="min-h-dvh">
      <MD3AppShell
        title={title}
        navigationItems={navItems}
        topAppBarVariant={variant}
        showTopAppBar={showTop}
        showNavigationBar={showNav}
        actions={topBarActions}
      >
        <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
      </MD3AppShell>
      <CartBottomBar />
    </div>
  );
}