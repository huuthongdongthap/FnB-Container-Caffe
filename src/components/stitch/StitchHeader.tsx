import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface StitchHeaderProps {
  logoSrc?: string;
}

// 10-link nav matching the expanded site structure
const NAV_ITEMS = [
  { key: 'nav.menu', to: '/menu' },
  { key: 'nav.spaces', to: '/about' },
  { key: 'nav.reservations', to: '/table-reservation' },
  { key: 'nav.promotions', to: '/promotions' },
  { key: 'nav.reviews', to: '/reviews' },
  { key: 'nav.trackOrder', to: '/track-order' },
  { key: 'nav.events', to: '/events' },
  { key: 'nav.loyalty', to: '/loyalty' },
  { key: 'nav.referral', to: '/referral' },
  { key: 'nav.contact', to: '/contact' },
] as const;

export default function StitchHeader(_props: StitchHeaderProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = (active: boolean) =>
    active
      ? 'text-[24px] leading-[1.4] font-semibold border-b-2 pb-1 no-underline whitespace-nowrap'
      : 'text-[24px] leading-[1.4] font-semibold no-underline whitespace-nowrap transition-colors hover:text-[var(--aura-chrome-bright, #E8EEF3)]';

  const linkStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--aura-font-display)",
    color: active ? 'var(--aura-chrome-light, #C9D6DF)' : 'var(--aura-text-body, #c5c6cd)',
    borderColor: active ? 'var(--aura-chrome-light, #C9D6DF)' : 'transparent',
  });

  return (
    <nav
      className="fixed top-0 w-full z-50 flex justify-between items-center px-4 sm:px-8 md:px-16 py-4 backdrop-blur-[8px] border-b border-[var(--aura-text-muted, #8A8E96)]/30"
      style={{ backgroundColor: 'rgba(var(--aura-noir-void), 0.15)' }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <Link
        to="/"
        className="text-[28px] sm:text-[32px] leading-[1.3] font-medium text-[var(--aura-chrome-bright, #E8EEF3)] tracking-tight no-underline shrink-0"
        style={{ fontFamily: "var(--aura-font-display)" }}
      >
        AURA CAFE
      </Link>

      {/* Desktop nav links */}
      <div
        className="hidden md:flex items-center gap-6 lg:gap-10 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={linkClass(active)}
              style={linkStyle(active)}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </div>

      {/* Right group: CTA + Hamburger */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Order Now CTA */}
        <Link
          to="/table-reservation"
          className="px-4 sm:px-6 py-2 text-[10px] sm:text-xs leading-[1] tracking-[0.1em] font-semibold uppercase text-[var(--aura-noir-void, #050D1A)] no-underline hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: 'var(--aura-chrome-light, #efbd8a)', fontFamily: "var(--aura-font-body)" }}
        >
          {t('nav.bookNow', 'Order Now')}
        </Link>

        {/* Hamburger button (mobile only) */}
        <button type="button"
          className="md:hidden flex flex-col gap-1.5 p-2 bg-transparent border-none cursor-pointer"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? t('nav.closeMenu', 'Close menu') : t('nav.openMenu', 'Open menu')}
          aria-expanded={menuOpen}
        >
          <span
            className="block w-6 h-[2px] bg-[var(--aura-text-body, #c6c6c7)] transition-transform duration-200"
            style={{ transform: menuOpen ? 'rotate(45deg) translateY(6px)' : 'rotate(0deg)' }}
          />
          <span
            className="block w-6 h-[2px] bg-[var(--aura-text-body, #c6c6c7)] transition-opacity duration-200"
            style={{ opacity: menuOpen ? 0 : 1 }}
          />
          <span
            className="block w-6 h-[2px] bg-[var(--aura-text-body, #c6c6c7)] transition-transform duration-200"
            style={{ transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : 'rotate(0deg)' }}
          />
        </button>
      </div>

      {/* Mobile dropdown overlay */}
      {menuOpen && (
        <>
          {/* Backdrop for dismiss */}
          <button type="button"
            className="fixed inset-0 z-40 md:hidden bg-transparent border-none cursor-default"
            onClick={() => setMenuOpen(false)}
            aria-hidden
            tabIndex={-1}
          />
          {/* Dropdown panel */}
          <div
            className="fixed top-[68px] left-0 w-full z-50 backdrop-blur-[8px] border-b border-[var(--aura-text-muted, #8A8E96)]/30 md:hidden"
            style={{ backgroundColor: 'rgba(var(--aura-noir-void), 0.95)' }}
          >
            <div className="flex flex-col items-center gap-5 py-8 px-4 max-h-[70vh] overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="text-[22px] leading-[1.4] font-semibold no-underline"
                    style={{
                      fontFamily: "var(--aura-font-display)",
                      color: active ? 'var(--aura-chrome-light, #C9D6DF)' : 'var(--aura-text-body, #c5c6cd)',
                    }}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
