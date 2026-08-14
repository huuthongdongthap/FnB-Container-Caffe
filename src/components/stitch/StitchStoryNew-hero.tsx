/**
 * StitchStoryNew-hero — Navigation bar + Hero section.
 *
 * Fixed glassmorphism nav with AURA CAFE branding, desktop links, and
 * an order-now CTA button. Hero section shows a full-screen background
 * with the established date, title, and scroll indicator.
 */

'use client';

import { useTranslation } from 'react-i18next';

/* ─── Navigation Bar ────────────────────────────────────────────────── */

interface NavBarProps {
  onNavClick?: (section: string) => void;
}

export function NavBar({ onNavClick }: NavBarProps) {
  const { t } = useTranslation();

  const navItems = [
    { key: 'menu', label: t('storyNew.navMenu', { defaultValue: 'Menu' }) },
    { key: 'story', label: t('storyNew.navStory', { defaultValue: 'Story' }), active: true },
    { key: 'locations', label: t('storyNew.navLocations', { defaultValue: 'Locations' }) },
    { key: 'gallery', label: t('storyNew.navGallery', { defaultValue: 'Gallery' }) },
    { key: 'reservation', label: t('storyNew.navReservation', { defaultValue: 'Reservation' }) },
  ];

  return (
    <nav
      className="fixed top-0 w-full z-50 bg-white/5 backdrop-blur-[20px] border-b border-[color-mix(in_srgb,var(--aura-chrome-dim)_30%,transparent)]"
      aria-label="Main navigation"
    >
      <div className="flex justify-between items-center px-[64px] py-2 max-w-[1280px] mx-auto h-20">
        <div
          className="uppercase tracking-tighter text-[var(--aura-noir-void)]"
          style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '20px' }}
        >
          AURA CAFE
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-10">
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.key === 'menu' ? '/menu' : item.key === 'story' ? '/about' : item.key === 'locations' ? '/locations' : item.key === 'gallery' ? '/gallery' : item.key === 'reservation' ? '/reservation' : '#'}
              onClick={(e) => { e.preventDefault(); onNavClick?.(item.key); }}
              className={
                item.active
                  ? 'text-xs uppercase tracking-wider text-[var(--aura-chrome-bright)] border-b-2 border-[var(--aura-chrome-bright)] pb-1'
                  : 'text-xs uppercase tracking-wider text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors duration-300'
              }
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onNavClick?.('order')}
          className="bg-[var(--aura-surface-dim)] text-[var(--aura-noir-deep)] px-6 py-2 font-bold text-xs uppercase tracking-widest hover:bg-[var(--aura-chrome-bright)] transition-all"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t('storyNew.orderNow', { defaultValue: 'Order Now' })}
        </button>
      </div>
    </nav>
  );
}

/* ─── Hero Section ──────────────────────────────────────────────────── */

interface HeroSectionProps {
  bgImageUrl: string;
}

export function HeroSection({ bgImageUrl }: HeroSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--aura-surface-container)]/80 z-10" />
        <div
          className="w-full h-full"
          style={{ backgroundImage: `url('${bgImageUrl}')` }}
          role="img"
          aria-label={t('storyNew.heroImageAlt', {
            defaultValue:
              'A cinematic, high-resolution shot of a modern architectural cafe built from matte black industrial containers at night. Soft bronze lighting spills from floor-to-ceiling glass windows, illuminating a sleek chrome espresso machine. The atmosphere is nocturnal and sophisticated, with deep navy and charcoal tones dominating the palette, reflecting a high-end industrial luxury aesthetic.',
          })}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 text-center px-6">
        <span className="block text-[var(--aura-chrome-soft)] tracking-[0.4em] uppercase mb-6 text-xs animate-pulse" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.established', { defaultValue: 'Established 2024' })}
        </span>
        <h1
          className="text-6xl md:text-8xl lg:text-9xl text-white font-medium mb-8 leading-tight max-w-5xl mx-auto"
          style={{ fontFamily: "var(--aura-font-display, 'EB Garamond', serif)" }}
        >
          {t('storyNew.heroTitle', { defaultValue: 'The Art of the' })}{' '}
          <span className="italic text-[var(--aura-chrome-bright)]">
            {t('storyNew.heroTitleItalic', { defaultValue: 'Nocturnal Pour' })}
          </span>
        </h1>
        <div className="w-24 h-px bg-[var(--aura-chrome-soft)] mx-auto opacity-50" />
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
        <span className="text-xs uppercase tracking-widest text-[var(--aura-chrome-soft)] opacity-60" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.scrollToExplore', { defaultValue: 'Scroll to Explore' })}
        </span>
        <div className="w-px h-16 bg-gradient-to-b from-[var(--aura-chrome-soft)] to-transparent" />
      </div>
    </section>
  );
}
