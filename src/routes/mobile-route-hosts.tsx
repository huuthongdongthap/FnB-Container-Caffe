import { type ReactNode, lazy, Suspense } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { TABS, canAccess } from '@/pages/mobile/mobile-layout-constants';
import type { MobileUser, Tab } from '@/pages/mobile/mobile-layout-types';

const NotificationsScreen = lazy(() => import('@/pages/mobile/mobile-layout-notifications'));
const ProfileScreen = lazy(() => import('@/pages/mobile/mobile-layout-profile'));

/**
 * Route-boundary hosts for the /mobile surface.
 *
 * These replace the deprecated in-app tab switching inside `pages/mobile/mobile-layout.tsx`.
 * Navigation is owned by the router under OpsShell, so deep linking and station
 * tablet refresh preserve view state.
 */

const EMPTY_USER: MobileUser = { id: '', name: '', role: 'staff' };

const TAB_ROUTES: Record<Tab, string> = {
  kds: '/mobile/kds',
  orders: '/mobile/orders',
  tables: '/mobile/tables',
  notifications: '/mobile/notifications',
  profile: '/mobile/profile',
};

function useSafeUser(): { user: MobileUser; logout: () => void } {
  const { user, logout } = useMobileAuth();
  return {
    user: (user as unknown as MobileUser) ?? EMPTY_USER,
    logout,
  };
}

/**
 * Layout host for the screen that also exposes a `header` slot.
 * OpsShell owns the dark chrome; this supplies its own tool header.
 */
export function MobileStationHost({
  title,
  children,
  header,
}: {
  title: string;
  children: ReactNode;
  header?: ReactNode;
}) {
  return (
    <div data-shell="ops" className="flex min-h-dvh flex-col">
      {header}
      <main className="flex-1" aria-label={title}>
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}

/** Layout host that opens a route with back navigation. */
export function MobileOverlayHost({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 md:p-6">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--md-sys-shape-corner-sm)] text-[var(--md-sys-color-on-surface-variant)]"
      >
        ← Quay lại / Back
      </button>
      {children}
    </div>
  );
}

/** Route page for the mobile notifications screen. */
export function MobileNotificationsPage() {
  return (
    <MobileOverlayHost>
      <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">Đang tải thông báo...</div>}>
        <NotificationsScreen />
      </Suspense>
    </MobileOverlayHost>
  );
}

/** Route page for the mobile staff profile screen. */
export function MobileProfilePage() {
  const { user, logout } = useSafeUser();
  return (
    <MobileOverlayHost>
      <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">Đang tải hồ sơ...</div>}>
        <ProfileScreen user={user} onLogout={logout} />
      </Suspense>
    </MobileOverlayHost>
  );
}

/**
 * Role-filtered destination bar. Renders nothing when the signed-in role has no
 * accessible destination.
 */
export function MobileTabBar() {
  const { user } = useSafeUser();
  const location = useLocation();
  const visibleTabs = TABS.filter((t) => canAccess(t.id, user.role));
  if (visibleTabs.length === 0) return null;

  return (
    <nav
      data-testid="mobile-tab-bar"
      aria-label="Điều hướng / Navigation"
      className="sticky bottom-0 flex border-t border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]"
    >
      {visibleTabs.map((t) => {
        const routePath = TAB_ROUTES[t.id];
        const isActive = location.pathname.startsWith(routePath);
        return (
          <Link
            key={t.id}
            to={routePath}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 text-[12px] font-medium transition-colors ${
              isActive
                ? 'text-[var(--md-sys-color-primary)] font-semibold'
                : 'text-[var(--md-sys-color-on-surface-variant)]'
            }`}
          >
            <span aria-hidden="true" className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
