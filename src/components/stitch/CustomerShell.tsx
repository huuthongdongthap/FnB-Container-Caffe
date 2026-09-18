import { MD3AppShell } from '@/components/md3';
import { useDefaultNavItems } from '@/components/md3';
import { getShellConfig } from './shell-config';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export default function CustomerShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navItems = useDefaultNavItems();
  const shellConfig = getShellConfig(location.pathname);
  const showNav = shellConfig?.showNav ?? true;
  const showTop = shellConfig?.showTop ?? true;
  const variant = shellConfig?.variant ?? 'small';
  const title = shellConfig?.title ?? 'AURA CAFE';

  return (
    <div data-shell="customer" className="min-h-dvh">
      <MD3AppShell
        title={title}
        navigationItems={navItems}
        topAppBarVariant={variant}
        showTopAppBar={showTop}
        showNavigationBar={showNav}
      >
        <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
      </MD3AppShell>
    </div>
  );
}