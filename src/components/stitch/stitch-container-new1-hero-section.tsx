'use client';

import { useTranslation } from 'react-i18next';
import type { ContainerCafeData } from './stitch-container-new1-types';

/**
 * Hero section for AURA CAFE container page.
 */
export function HeroSection({
  data,
  onExploreMenu,
  onViewSpace,
}: {
  data: ContainerCafeData;
  onExploreMenu?: () => void;
  onViewSpace?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative flex h-screen items-center justify-center overflow-hidden pt-20"
      aria-label={t('containerNew1.heroAriaLabel', { defaultValue: 'Hero Section' })}
    >
      {/* Content */}
      <div className="relative z-10 max-w-4xl px-8 text-center">
        {/* Tag */}
        <span
          className="mb-6 block text-[14px] uppercase leading-[1.0] tracking-[0.3em]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: 'var(--aura-chrome-bright)',
            fontWeight: 500,
          }}
        >
          {data.heroTag}
        </span>

        {/* Title */}
        <h1
          className="mb-6 leading-tight md:text-[80px]"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: '48px',
            color: 'var(--aura-chrome-bright)',
            fontWeight: 500,
          }}
        >
          {data.heroTitle}
          <br />
          <span className="font-normal italic">{data.heroSubtitle}</span>
        </h1>

        {/* Description */}
        <p
          className="mx-auto mb-12 max-w-2xl text-lg"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: '1.6',
            color: 'var(--aura-chrome-soft)',
          }}
        >
          {data.heroDescription}
        </p>

        <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
          {/* Explore the Menu */}
          <button
            type="button"
            onClick={onExploreMenu}
            className="rounded-none px-12 py-3 text-[14px] uppercase leading-[1.0] tracking-widest transition-all"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
              backgroundColor: 'var(--aura-chrome-bright)',
              color: 'var(--aura-noir-deep)',
              boxShadow: '0 0 15px color-mix(in srgb, var(--aura-chrome-bright) 30%, transparent)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 25px color-mix(in srgb, var(--aura-chrome-bright) 60%, transparent)';
              e.currentTarget.style.backgroundColor = 'var(--aura-chrome-bright)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 15px color-mix(in srgb, var(--aura-chrome-bright) 30%, transparent)';
              e.currentTarget.style.backgroundColor = 'var(--aura-chrome-bright)';
            }}
            aria-label={t('containerNew1.exploreMenu', { defaultValue: 'Explore the Menu' })}
          >
            {t('containerNew1.exploreMenu', { defaultValue: 'Explore the Menu' })}
          </button>
          {/* View Space */}
          <button
            type="button"
            onClick={onViewSpace}
            className="rounded-none px-12 py-3 text-[14px] uppercase leading-[1.0] tracking-widest transition-all"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
              border: '1px solid rgba(198, 198, 199, 0.3)',
              color: '#c6c6c7',
              background: 'transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(198, 198, 199, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label={t('containerNew1.viewSpace', { defaultValue: 'View Space' })}
          >
            {t('containerNew1.viewSpace', { defaultValue: 'View Space' })}
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 opacity-60">
        <span
          className="text-xs uppercase tracking-widest"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: '1.0',
            letterSpacing: '0.05em',
            fontWeight: 600,
            color: '#c6c6c7',
          }}
        >
          {t('containerNew1.scroll', { defaultValue: 'Scroll' })}
        </span>
        <div className="h-12 w-[1px] bg-gradient-to-b from-[#c6c6c7] to-transparent" />
      </div>
    </section>
  );
}
