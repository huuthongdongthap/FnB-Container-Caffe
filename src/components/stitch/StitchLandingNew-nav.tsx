import { useTranslation } from 'react-i18next';

/** Top navigation bar for AURA Cafe landing page. */
export function LandingNav() {
  const { t } = useTranslation();

  return (
    <nav
      className="fixed top-0 w-full z-50 flex justify-between items-center px-16 py-4 backdrop-blur-xl border-b border-[var(--aura-chrome-dim)]/30"
      style={{ backgroundColor: 'color-mix(in srgb, var(--aura-surface-dim) 15%, transparent)' }}
    >
      <div
        className="tracking-tight"
        style={{
          fontFamily: "'EB Garamond', serif",
          fontSize: '32px',
          lineHeight: '1.3',
          fontWeight: 500,
          color: 'var(--aura-chrome-bright)',
        }}
      >
        AURA CAFE
      </div>
      <div className="hidden md:flex items-center gap-10">
        <a
          href="/menu"
          className="border-b-2 pb-1"
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: '24px',
            lineHeight: '1.4',
            fontWeight: 600,
            color: 'var(--aura-chrome-bright)',
            borderColor: 'var(--aura-chrome-bright)',
          }}
        >
          {t('nav.menu', 'Menu')}
        </a>
        <a
          href="/table-reservation"
          className="transition-colors"
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: '24px',
            lineHeight: '1.4',
            fontWeight: 600,
            color: 'var(--aura-chrome-soft)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-bright)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
        >
          {t('landing.reservation', 'Reservation')}
        </a>
        <a
          href="/about"
          className="transition-colors"
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: '24px',
            lineHeight: '1.4',
            fontWeight: 600,
            color: 'var(--aura-chrome-soft)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-bright)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
        >
          {t('landing.location', 'Location')}
        </a>
        <a
          href="/about"
          className="transition-colors"
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: '24px',
            lineHeight: '1.4',
            fontWeight: 600,
            color: 'var(--aura-chrome-soft)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-bright)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
        >
          {t('landing.about', 'About')}
        </a>
      </div>
      <button
        className="px-6 py-2 active:opacity-80 active:scale-95 transition-all duration-300"
        style={{
          backgroundColor: 'var(--aura-chrome-bright)',
          color: 'var(--aura-noir-deep)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '12px',
          lineHeight: '1',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {t('landing.orderNow', 'Order Now')}
      </button>
    </nav>
  );
}
