import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, UtensilsCrossed, ShoppingBag, User } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  NAVIGATION                                                         */
/* ------------------------------------------------------------------ */

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { path: '/track-order', label: 'Orders', icon: ShoppingBag },
  { path: '/account', label: 'Account', icon: User },
];

/* ------------------------------------------------------------------ */
/*  CSS CUSTOM PROPERTIES (TL;DR for the linter)                       */
/* ------------------------------------------------------------------ */

const GLASS_HEADER =
  'rgba(5, 13, 26, 0.85)';
const GLASS_NAV =
  'rgba(5, 13, 26, 0.92)';
const CHROME = 'var(--aura-primary, #c6c6c7)';
const CHROME_MUTED = 'var(--aura-text-disabled, #5a6270)';
const CHROME_BORDER = 'rgba(198, 198, 199, 0.1)';
const TOUCH = 'var(--aura-touch-target, 48px)';

/* ------------------------------------------------------------------ */
/*  INTERFACE                                                          */
/* ------------------------------------------------------------------ */

interface MobileAppShellProps {
  /** Page content rendered inside the shell */
  children: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function MobileAppShell({ children }: MobileAppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);

  /* Scroll to top on every navigation */
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  /* ---- active tab index ---- */
  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path),
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Mobile header ────────────────────────────────────────────── */}
      <header
        className="relative z-20 md:hidden"
        style={{
          background: GLASS_HEADER,
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          borderBottom: `0.5px solid ${CHROME_BORDER}`,
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          {/* Brand */}
          <span
            className="text-sm font-semibold tracking-[0.12em] uppercase"
            style={{ color: CHROME }}
          >
            Aura Cafe
          </span>

          {/* Cart button */}
          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="relative flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] active:bg-white/[0.10]"
            style={{ width: TOUCH, height: TOUCH }}
            aria-label="Cart"
          >
            <ShoppingBag className="h-[18px] w-[18px]" style={{ color: CHROME }} />
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-[9px] font-bold leading-none"
              style={{
                background: CHROME,
                color: 'var(--aura-bg-void, #050D1A)',
              }}
            >
              0
            </span>
          </button>
        </div>
      </header>

      {/* ── Scrollable content ───────────────────────────────────────── */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
        }}
      >
        <div key={location.pathname} className="page-enter">
          {children}
        </div>
      </main>

      {/* ── Bottom navigation ────────────────────────────────────────── */}
      <nav
        className="relative z-20 md:hidden"
        style={{
          background: GLASS_NAV,
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          borderTop: `0.5px solid ${CHROME_BORDER}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-around py-1">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === activeIndex;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors duration-200"
                style={{ minHeight: TOUCH, minWidth: TOUCH }}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full"
                    style={{ background: CHROME }}
                  />
                )}

                <Icon
                  className="h-5 w-5 transition-colors duration-200"
                  style={{ color: isActive ? CHROME : CHROME_MUTED }}
                />

                <span
                  className="text-[10px] font-medium tracking-wide transition-colors duration-200"
                  style={{ color: isActive ? CHROME : CHROME_MUTED }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
