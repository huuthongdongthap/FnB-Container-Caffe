import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { MD3TopAppBar } from './md3-top-app-bar';
import { MD3NavigationBar, MD3NavigationBarItem } from './md3-navigation-bar';

/* ─── Types ───────────────────────────────────────────────── */
export interface MD3NavItem {
  /** Route path — matched against location.pathname */
  value: string;
  label: string;
  /** lucide icon element */
  icon: ReactNode;
  badge?: number | 'dot';
}

export interface MD3AppShellProps {
  title: string;
  /** Max 5 per M3 spec; enforced by MD3NavigationBar dev warning */
  navigationItems: MD3NavItem[];
  children: ReactNode;
  /** Hide top app bar (e.g. landing hero pages) */
  showTopAppBar?: boolean;
  /** Hide bottom navigation bar (e.g. checkout steps) */
  showNavigationBar?: boolean;
  /** Top app bar variant */
  topAppBarVariant?: 'small' | 'center-aligned' | 'medium' | 'large';
  /** Extra actions rendered right of the title (search, cart, …) */
  actions?: ReactNode[];
  /** Leading icon — defaults to AURA CAFE logo linking to / */
  leadingIcon?: ReactNode;
  onLeadingClick?: () => void;
  className?: string;
}

/* ─── Default nav items (customer core) ────────────────────── */
export function useDefaultNavItems(): MD3NavItem[] {
  const { t } = useTranslation();
  return [
    {
      value: '/',
      label: t('nav.home', 'Trang chủ'),
      icon: <HomeIcon />,
    },
    {
      value: '/menu',
      label: t('nav.menu', 'Thực đơn'),
      icon: <MenuIcon />,
    },
    {
      value: '/table-reservation',
      label: t('nav.reservations', 'Đặt bàn'),
      icon: <CalendarIcon />,
    },
    {
      value: '/account',
      label: t('nav.account', 'Tài khoản'),
      icon: <UserIcon />,
    },
  ];
}

/* ─── Icons (lucide, tree-shaken) ─────────────────────────── */
import { Home, Coffee, CalendarCheck, User } from 'lucide-react';

const HomeIcon = () => <Home aria-hidden="true" />;
const MenuIcon = () => <Coffee aria-hidden="true" />;
const CalendarIcon = () => <CalendarCheck aria-hidden="true" />;
const UserIcon = () => <User aria-hidden="true" />;

/* ─── Logo — AURA CAFE ────────────────────────────────────── */
function AuraLogo() {
  return (
    <img
      src="/images/logo.svg"
      alt="AURA CAFE"
      className="h-8 w-auto"
      // Container logos sit on dark navy — keep original colors
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

/* ─── Component ───────────────────────────────────────────── */
export function MD3AppShell({
  title,
  navigationItems,
  children,
  showTopAppBar = true,
  showNavigationBar = true,
  topAppBarVariant = 'small',
  actions,
  leadingIcon,
  onLeadingClick,
  className,
}: MD3AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  // Track scroll for TopAppBar surface → surface-container transition
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to top on route change (M3 back/forward behavior)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Active nav = longest matching path (so /order matches /order too)
  const activeValue = useMemo(() => {
    let best = '';
    for (const item of navigationItems) {
      if (
        (item.value === '/' && location.pathname === '/') ||
        (item.value !== '/' && location.pathname.startsWith(item.value))
      ) {
        if (item.value.length > best.length) best = item.value;
      }
    }
    return best;
  }, [location.pathname, navigationItems]);

  const handleNavChange = useCallback(
    (value: string) => navigate(value),
    [navigate],
  );

  return (
    <div className={cn('flex min-h-dvh flex-col bg-md-surface', className)}>
      {/* Skip to content — visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:bg-md-primary focus:text-md-on-primary focus:text-sm focus:font-semibold focus:outline-none"
      >
        Skip to content / Bỏ qua nội dung
      </a>
      {showTopAppBar && (
        <MD3TopAppBar
          title={title}
          variant={topAppBarVariant}
          scrollY={scrollY}
          leadingIcon={leadingIcon ?? <AuraLogo />}
          onLeadingClick={onLeadingClick ?? (() => navigate('/'))}
          actions={actions}
        />
      )}

      <div
        id="main-content"
        role="main"
        className={cn(
          'flex-1',
          showTopAppBar && 'pt-16',
          showNavigationBar && 'pb-20',
        )}
      >
        {children}
      </div>

      {showNavigationBar && (
        <MD3NavigationBar value={activeValue} onChange={handleNavChange}>
          {navigationItems.map((item) => (
            <MD3NavigationBarItem
              key={item.value}
              icon={item.icon}
              label={item.label}
              value={item.value}
              badge={item.badge}
            />
          ))}
        </MD3NavigationBar>
      )}
    </div>
  );
}
