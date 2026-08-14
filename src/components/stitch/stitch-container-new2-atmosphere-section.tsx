/**
 * Atmosphere parallax section with background image and quote.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from './stitch-container-new2-types';

export function AtmosphereSection({
  title,
  quote,
  attribution,
  bgUrl,
  bgAlt,
}: {
  title: string;
  quote: string;
  attribution: string;
  bgUrl: string;
  bgAlt: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative py-40 overflow-hidden"
      aria-label={t('containerNew2.atmosphereAriaLabel')}
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="w-full h-full bg-cover bg-fixed bg-center"
          style={{ backgroundImage: `url('${bgUrl}')` }}
          role="img"
          aria-label={bgAlt}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, var(--aura-surface-dim), color-mix(in srgb, var(--aura-surface-dim) 60%, transparent), transparent)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 md:px-[64px] max-w-[1280px] mx-auto">
        <div
          className="max-w-xl space-y-8 p-12"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--aura-surface-container) 60%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
            borderLeft: '1px solid color-mix(in srgb, var(--aura-chrome-soft) 10%, transparent)',
          }}
        >
          <h2
            style={{ fontFamily: FONTS.display, color: COLORS.primary }}
            className="text-[40px]/[48px] md:text-[32px]/[40px] font-medium"
          >
            {title}
          </h2>
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: '18px',
              lineHeight: '28px',
              fontWeight: 400,
              color: COLORS.onSurface,
            }}
          >
            {quote}
          </p>
          <div className="flex items-center space-x-4">
            <div
              className="h-px w-12"
              style={{ backgroundColor: COLORS.secondary }}
              aria-hidden="true"
            />
            <span
              className="uppercase tracking-widest"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: 600,
                color: COLORS.secondary,
              }}
            >
              {attribution}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
