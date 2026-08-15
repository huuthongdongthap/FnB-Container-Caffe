/**
 * StitchAdminTerminalNew — Aura Cafe Admin Terminal (Stitch v2 design)
 *
 * Dark navy glassmorphism admin panel with chrome/bronze accents.
 * Serves as the admin layout shell wrapping <Outlet /> for nested routes.
 */
'use client';

import { useState, useRef } from 'react';
import { Outlet } from 'react-router-dom';
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
  brandSubtitle = 'Admin Terminal',
  adminName = 'Aura Admin',
  terminalId = 'Terminal #012',
  adminAvatarUrl = DEFAULT_ADMIN_AVATAR,
  children,
}: Readonly<StitchAdminTerminalNewProps>) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sidebarRef = useRef<HTMLElement>(null);

  useFocusTrap(sidebarOpen, () => setSidebarOpen(false), sidebarRef);
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <div className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] font-body text-[var(--aura-text-primary, #e8e8e8)]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
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

      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Main Content (routed via Outlet or children) */}
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
