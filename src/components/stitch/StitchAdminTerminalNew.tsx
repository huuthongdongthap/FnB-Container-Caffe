/**
 * StitchAdminTerminalNew — Aura Cafe Admin Terminal (Stitch v2 design)
 *
 * Dark navy glassmorphism admin panel with chrome/bronze accents.
 * Serves as the admin layout shell wrapping <Outlet /> for nested routes.
 */
'use client';

import { useState, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { DEFAULT_ADMIN_AVATAR } from './StitchAdminTerminalNew-constants';
import { Sidebar } from './StitchAdminTerminalNew-sidebar';
import { TopBar } from './StitchAdminTerminalNew-topbar';
import type { StitchAdminTerminalNewProps } from './StitchAdminTerminalNew-types';

export type { StitchAdminTerminalNewProps, NavItemData, NavSectionData } from './StitchAdminTerminalNew-types';

export function StitchAdminTerminalNew({
  brandName = 'Aura Cafe',
  brandSubtitle = '',
  adminName = 'Aura Admin',
  terminalId = '',
  adminAvatarUrl = DEFAULT_ADMIN_AVATAR,
  children,
}: Readonly<StitchAdminTerminalNewProps>) {
  const { t } = useTranslation();
  const location = useLocation();
  const isPosRoute = location.pathname.startsWith('/admin/pos');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useFocusTrap(sidebarOpen, () => setSidebarOpen(false), sidebarRef);
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <div data-shell="admin" className="relative min-h-screen bg-[var(--aura-bg-page, var(--aura-bg-surface))] font-body text-[var(--aura-text-primary, #e8e8e8)]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <button type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden print:hidden no-print"
          onClick={() => setSidebarOpen(false)}
          aria-label={tTerminal('closeSidebar')}
        />
      )}

      <Sidebar
        ref={sidebarRef}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        brandName={brandName}
        brandSubtitle={brandSubtitle}
        adminName={adminName}
        terminalId={terminalId}
        adminAvatarUrl={adminAvatarUrl}
      />

      {!isPosRoute && (
        <TopBar
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      )}

      {/* Main Content (routed via Outlet or children) */}
      <main
        className={cn(
          'min-h-screen print:min-h-0 print:ml-0 print:pt-0 print:px-0 print:pb-0',
          isPosRoute ? 'p-0' : 'pt-24 px-4 pb-8 md:px-10 md:ml-72',
        )}
        aria-label={tTerminal('mainContent')}
      >
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
