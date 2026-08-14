/**
 * StitchReviewsNew — Top navigation header
 *
 * Fixed glassmorphism navbar with brand name, desktop nav links
 * (Menu, Reservations, Reviews, Gallery), and "Book a Table" CTA.
 * Matches the original Stitch AI HTML export exactly.
 */

import { useTranslation } from 'react-i18next';

export function ReviewsNavHeader() {
  const { t } = useTranslation();

  const navLinkStyle = {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize: '16px',
    lineHeight: '1.6',
    fontWeight: 400 as const,
    color: 'var(--aura-chrome-soft)',
  };

  return (
    <header
      className="fixed top-0 z-50 h-16 w-full shadow-sm"
      style={{
        backgroundColor: 'rgba(11, 32, 56, 0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(68, 71, 77, 0.2)',
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between px-6">
        {/* Brand */}
        <span
          className="text-2xl font-bold"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            lineHeight: '1.3',
            fontWeight: 500,
            color: 'var(--aura-noir-void)',
          }}
        >
          Aura Cafe
        </span>

        {/* Desktop Nav */}
        <nav className="hidden gap-8 md:flex">
          <a
            className="transition-colors"
            href="/menu"
            style={navLinkStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-noir-void)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('stitch.navMenu', { defaultValue: 'Menu' })}
          </a>
          <a
            className="transition-colors"
            href="/table-reservation"
            style={navLinkStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-noir-void)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('stitch.navReservations', { defaultValue: 'Reservations' })}
          </a>
          <a
            href="/reviews"
            className="pb-1 font-bold"
            style={{
              ...navLinkStyle,
              fontWeight: 700,
              color: 'var(--aura-chrome-bright)',
              borderBottom: '2px solid var(--aura-chrome-bright)',
            }}
          >
            {t('stitch.navReviews', { defaultValue: 'Reviews' })}
          </a>
          <a
            className="transition-colors"
            href="/about"
            style={navLinkStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-noir-void)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('stitch.navGallery', { defaultValue: 'Gallery' })}
          </a>
        </nav>

        {/* Book a Table */}
        <button
          type="button"
          className="chrome-gradient rounded-full px-6 py-2 text-[#0c1c30] uppercase transition-transform active:scale-95"
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: '12px',
            lineHeight: '1.0',
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}
          aria-label={t('stitch.bookATable', { defaultValue: 'Book a Table' })}
        >
          {t('stitch.bookATable', { defaultValue: 'Book a Table' })}
        </button>
      </div>
    </header>
  );
}
