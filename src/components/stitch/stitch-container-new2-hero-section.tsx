/**
 * Hero section with tagline, heading, description, and CTA buttons.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from './stitch-container-new2-types';

export function HeroSection({
  heroTag,
  heroTitle,
  heroSubtitle,
  heroDescription,
  reservationLabel,
  viewGalleryLabel,
  onReservation,
  onViewGallery,
}: {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  reservationLabel: string;
  viewGalleryLabel: string;
  onReservation?: () => void;
  onViewGallery?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative h-[921px] flex items-center px-5 md:px-[64px] max-w-[1280px] mx-auto overflow-hidden"
      aria-label={t('containerNew2.heroAriaLabel')}
    >
      <div className="grid grid-cols-12 w-full z-10" style={{ gap: '24px' }}>
        <div className="col-span-12 md:col-span-8 flex flex-col justify-center space-y-8">
          {/* Tag + Heading */}
          <div className="space-y-2">
            <span
              className="uppercase"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.2em',
                fontWeight: 600,
                color: COLORS.primary,
              }}
            >
              {heroTag}
            </span>
            <h1
              className="leading-tight"
              style={{
                fontFamily: FONTS.display,
                fontSize: '64px',
                lineHeight: '72px',
                letterSpacing: '-0.02em',
                fontWeight: 500,
                color: COLORS.onSurface,
              }}
            >
              {heroTitle}
              <br />
              <span
                className="italic"
                style={{
                  color: COLORS.primaryFixedDim,
                  fontFamily: FONTS.display,
                  fontSize: '64px',
                  lineHeight: '72px',
                  letterSpacing: '-0.02em',
                  fontWeight: 500,
                }}
              >
                {heroSubtitle}
              </span>
            </h1>
          </div>

          {/* Description */}
          <p
            className="max-w-xl"
            style={{
              fontFamily: FONTS.body,
              fontSize: '18px',
              lineHeight: '28px',
              fontWeight: 400,
              color: COLORS.onSurfaceVariant,
            }}
          >
            {heroDescription}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onReservation}
              className="px-8 py-4 font-bold uppercase tracking-wider rounded-none active:scale-95 transition-all duration-500"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: 700,
                backgroundColor: COLORS.primary,
                color: COLORS.onPrimary,
                boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent)',
                transition: 'background-color 500ms, transform 200ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.primaryFixedDim;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.primary;
              }}
              aria-label={t('containerNew2.reservationAria')}
            >
              {reservationLabel}
            </button>
            <button
              type="button"
              onClick={onViewGallery}
              className="shimmer-hover px-8 py-4 font-bold uppercase tracking-wider rounded-none hover:bg-white/5 active:scale-95 transition-all duration-500"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: 700,
                color: COLORS.secondary,
                border: '1px solid color-mix(in srgb, var(--aura-chrome-soft) 30%, transparent)',
              }}
              aria-label={t('containerNew2.viewGalleryAria')}
            >
              {viewGalleryLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Abstract Industrial Visual */}
      <div className="absolute right-0 top-0 w-1/2 h-full -z-10 opacity-60" aria-hidden="true" />
    </section>
  );
}
