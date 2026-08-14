/**
 * Fixed site header with nav links and reservation CTA.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { COLORS, FONTS, type NavLink } from './stitch-container-new2-types';

export function SiteHeader({
  navLinks,
  onNavClick,
  onReservation,
}: {
  navLinks: NavLink[];
  onNavClick?: (linkId: string) => void;
  onReservation?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header
      className="fixed top-0 w-full z-50"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-surface-dim) 80%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid color-mix(in srgb, var(--aura-chrome-dim) 20%, transparent)',
      }}
      aria-label={t('common.mainNavigation')}
    >
      <nav className="flex justify-between items-center px-5 py-6 md:px-[64px] max-w-[1280px] mx-auto">
        {/* Logo */}
        <div
          className="font-bold tracking-tighter"
          style={{
            fontFamily: FONTS.display,
            fontSize: '32px',
            lineHeight: '40px',
            fontWeight: 500,
            color: COLORS.primary,
          }}
        >
          {t('containerNew2.brandName', { defaultValue: 'AURA CAFE' })}
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                onNavClick?.(link.id);
              }}
              className={clsx('cursor-pointer active:scale-95 transition-transform')}
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: link.isActive ? 700 : 600,
                color: link.isActive ? COLORS.primary : COLORS.onSurfaceVariant,
                borderBottom: link.isActive ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                paddingBottom: link.isActive ? '4px' : undefined,
                transition: 'color 300ms, border-color 300ms, transform 200ms',
              }}
              onMouseEnter={(e) => {
                if (!link.isActive) e.currentTarget.style.color = COLORS.primaryFixedDim;
              }}
              onMouseLeave={(e) => {
                if (!link.isActive) e.currentTarget.style.color = COLORS.onSurfaceVariant;
              }}
              aria-current={link.isActive ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Reservation button */}
        <button
          type="button"
          onClick={onReservation}
          className="px-6 py-2 rounded-lg font-bold active:scale-95 transition-all duration-300"
          style={{
            fontFamily: FONTS.body,
            fontSize: '14px',
            lineHeight: '20px',
            letterSpacing: '0.1em',
            fontWeight: 700,
            backgroundColor: COLORS.primaryContainer,
            color: COLORS.onPrimaryContainer,
            transition: 'background-color 300ms, transform 200ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.primaryFixedDim;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.primaryContainer;
          }}
          aria-label={t('containerNew2.reservationAria')}
        >
          {t('containerNew2.reservation')}
        </button>
      </nav>
    </header>
  );
}
