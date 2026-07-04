import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface StitchHeaderProps {
  logoSrc?: string;
}

// Matches original Stitch design nav: Menu, Reservation, Location, About
const NAV_ITEMS = [
  { key: 'nav.menu', to: '/menu' },
  { key: 'nav.reservations', to: '/table-reservation' },
  { key: 'nav.location', to: '/about' },
  { key: 'nav.about', to: '/about' },
] as const;

export default function StitchHeader(_props: StitchHeaderProps) {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <nav
      className="fixed top-0 w-full z-50 flex justify-between items-center px-16 py-4 backdrop-blur-xl border-b border-[#44474d]/30"
      style={{ backgroundColor: 'rgba(8, 20, 37, 0.15)' }}
      aria-label="Main navigation"
    >
      {/* Logo — exact match to original Stitch design */}
      <Link
        to="/"
        className="text-[32px] leading-[1.3] font-medium text-[#d8e3fb] tracking-tight no-underline"
        style={{ fontFamily: "'EB Garamond', serif" }}
      >
        AURA CAFE
      </Link>

      {/* Nav links — exact match to original Stitch design */}
      <div className="hidden md:flex items-center gap-10">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                active
                  ? 'text-[24px] leading-[1.4] font-semibold border-b-2 pb-1 no-underline'
                  : 'text-[24px] leading-[1.4] font-semibold no-underline transition-colors hover:text-[#d8e3fb]'
              }
              style={{
                fontFamily: "'EB Garamond', serif",
                color: active ? '#efbd8a' : '#c5c6cd',
                borderColor: active ? '#efbd8a' : 'transparent',
              }}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </div>

      {/* Order Now CTA */}
      <Link
        to="/table-reservation"
        className="px-6 py-2 text-xs leading-[1] tracking-[0.1em] font-semibold uppercase text-[#472a03] no-underline hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#efbd8a', fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {t('nav.bookNow', 'Order Now')}
      </Link>
    </nav>
  );
}
