import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Factory, Coffee, Moon } from 'lucide-react';

export interface StitchHeroNewProps {
  /** Background image URL for the hero visual teaser section */
  bgImageUrl?: string;
  /** Top navigation logo text */
  brandName?: string;
}

const DEFAULT_BG_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBfNKpadgwatJIDobwM9ttZy3Q69wVsM3Vn0TJErgSvTAFZ_fpQDjSL2aR3DOyPPysLqE5q83CIynNaNUnjrYsxvkC_AxpMq3c2ZP5oLCcQoZ1SA3CZoBPgNyio99x3VPl4Cp2rvs5c1Bxo-wYTyx6i9R73q1npmzbQY9LKGy0CjwP3Eo99wiLLFgRQ3dA__JvvA579RlpXZKzFZsCzdteQwjRhiC7UY0aYzs5OOQE0SC_I2NGbhRqk98Vt6b2hSAKi2wGJnyGL7QE';

export function StitchHeroNew({
  bgImageUrl = DEFAULT_BG_IMAGE,
  brandName = 'AURA CAFE',
}: Readonly<StitchHeroNewProps>) {
  const { t } = useTranslation();

  return (
    <div
      style={
        {
          '--aura-noir-void': '#00142c',
          '--aura-chrome-bright': '#d4e3ff',
          '--aura-chrome-light': '#efbd8a',
          '--aura-text-body': '#c5c6cd',
          '--aura-border-muted': 'rgba(198, 198, 199, 0.15)',
          '--aura-glow-chrome': '0 0 30px rgba(212, 165, 116, 0.1)',
          '--aura-glow-chrome-strong': '0 0 30px rgba(212, 165, 116, 0.2)',
          '--aura-font-display': "'Libre Caslon Text', Georgia, serif",
        } as React.CSSProperties
      }
    >
      {/* ===== Top Navigation Bar ===== */}
      <nav
        className="fixed top-0 z-50 w-full border-b border-[rgba(198,198,199,0.3)] bg-white/5 shadow-[0_0_30px_rgba(212,165,116,0.1)] backdrop-blur-xl"
        aria-label={t('nav.openMenu')}
      >
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-4 md:px-16">
          {/* Logo */}
          <Link
            to="/"
            className="font-display text-[32px] tracking-widest text-[var(--aura-chrome-bright)] uppercase"
            aria-label={brandName}
          >
            {brandName}
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-6 md:flex">
            <Link
              to="/menu"
              className="border-b border-[var(--aura-chrome-bright)] pb-1 font-body text-lg text-[var(--aura-chrome-bright)]"
              aria-label={t('nav.menu')}
            >
              {t('nav.menu')}
            </Link>
            <Link
              to="/gallery"
              className="font-body text-lg text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-bright)]"
              aria-label={t('nav.gallery', 'Gallery')}
            >
              {t('nav.gallery', 'Gallery')}
            </Link>
            <Link
              to="/table-reservation"
              className="font-body text-lg text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-bright)]"
              aria-label={t('nav.reservations')}
            >
              {t('nav.reservations')}
            </Link>
            <Link
              to="/about"
              className="font-body text-lg text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-bright)]"
              aria-label={t('nav.about', 'About')}
            >
              {t('nav.about', 'About')}
            </Link>
          </div>

          {/* Book Now CTA */}
          <Link
            to="/table-reservation"
            className="bg-[#291500] px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-chrome-light)] transition-all duration-300 hover:bg-[var(--aura-chrome-light)] hover:text-[#472a03] active:scale-95"
            style={{ border: '1px solid rgba(239, 189, 138, 0.5)' }}
            aria-label={t('hero.bookNow')}
          >
            {t('hero.bookNow', 'Book Now')}
          </Link>
        </div>
      </nav>

      {/* ===== Hero Section ===== */}
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-6 pt-24 md:px-16"
        aria-label={t('hero.title')}
        style={{
          backgroundColor: '#00142c',
          backgroundImage:
            'radial-gradient(circle at top right, rgba(184, 199, 226, 0.05), transparent 60%), radial-gradient(circle at bottom left, rgba(212, 165, 116, 0.03), transparent 50%)',
        }}
      >
        <div className="relative z-10 mx-auto w-full max-w-[1200px] text-center">
          {/* Tagline + chrome divider */}
          <div className="mb-8 inline-block">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(198,198,199,0.6)]">
              Est. 2024 &bull; {t('home.statsSpaces', 'Industrial Luxury')}
            </span>
            <div className="chrome-line mt-2 h-px w-full bg-gradient-to-r from-transparent via-[rgba(198,198,199,0.3)] to-transparent" />
          </div>

          {/* Main heading */}
          <h1 className="mb-8 text-[40px] leading-[48px] italic text-[var(--aura-chrome-bright)] md:text-[64px] md:leading-[72px] md:tracking-[-0.02em]">
            The Art of the{' '}
            <span className="text-[var(--aura-chrome-light)]">
              {t('hero.subtitle', 'Nocturnal')}
            </span>{' '}
            Pour
          </h1>

          {/* Glass description panel */}
          <div
            className="mx-auto mb-6 max-w-2xl border border-white/10 bg-white/5 p-6"
            style={{ backdropFilter: 'blur(20px)', borderRadius: '8px' }}
            aria-label="Description panel"
          >
            <p className="font-body text-lg leading-relaxed text-[var(--aura-text-body)]">
              A redefined coffee experience set within architecturally salvaged shipping containers.
              AURA CAFE merges raw industrial textures with the warmth of boutique artisan roasts
              and the ambient glow of a premium night lounge.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <Link
              to="/table-reservation"
              className="w-full bg-[var(--aura-chrome-light)] px-16 py-2 text-center font-body text-xs font-bold uppercase tracking-widest text-[#472a03] transition-all duration-500 hover:shadow-[var(--aura-glow-chrome-strong)] md:w-auto"
              style={{ borderRadius: '4px' }}
              aria-label={t('hero.bookTable', 'Book Your Table')}
            >
              {t('hero.bookTable', 'Book Your Table')}
            </Link>
            <Link
              to="/menu"
              className="w-full border border-[rgba(198,198,199,0.3)] px-16 py-2 text-center font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-all duration-300 hover:bg-white/5 md:w-auto"
              style={{ borderRadius: '4px' }}
              aria-label={t('hero.exploreMenu', 'Explore Menu')}
            >
              {t('hero.exploreMenu', 'Explore Menu')}
            </Link>
          </div>
        </div>

        {/* Bottom chrome divider */}
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[rgba(198,198,199,0.2)] to-transparent" />
      </main>

      {/* ===== Feature Bento Grid ===== */}
      <section className="bg-[#000e23] px-5 py-16 md:px-16" aria-label={t('home.statsLabel')}>
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1: Industrial Roots */}
          <article
            className="flex flex-col items-start gap-6 bg-white/5 p-6 transition-transform duration-500 hover:-translate-y-2"
            style={{
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(198, 198, 199, 0.15)',
            }}
            aria-label="Industrial Roots"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-chrome-light)]/30 text-[var(--aura-chrome-light)]">
              <Factory className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[24px] text-[var(--aura-chrome-bright)]">
              Industrial Roots
            </h3>
            <p className="font-body text-base text-[var(--aura-text-body)]">
              Housed in repurposed steel vessels, our space celebrates raw materials&mdash;polished
              concrete, exposed beams, and matte metal finishes.
            </p>
            <div className="mt-auto w-full pt-8">
              <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[rgba(198,198,199,0.3)] to-transparent" />
              <span className="font-body text-xs font-semibold uppercase tracking-widest text-[rgba(198,198,199,0.4)]">
                Architectural Concept
              </span>
            </div>
          </article>

          {/* Card 2: Artisan Roasts */}
          <article
            className="relative flex flex-col items-start gap-6 overflow-hidden bg-white/5 p-6 transition-transform duration-500 hover:-translate-y-2"
            style={{
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(198, 198, 199, 0.15)',
            }}
            aria-label="Artisan Roasts"
          >
            {/* Badge */}
            <div className="absolute right-0 top-0 p-2">
              <span className="border border-[var(--aura-chrome-light)]/20 bg-[var(--aura-chrome-light)]/10 px-2 py-1 font-body text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-chrome-light)]">
                Signature
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-chrome-light)]/30 text-[var(--aura-chrome-light)]">
              <Coffee className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[24px] text-[var(--aura-chrome-bright)]">
              Artisan Roasts
            </h3>
            <p className="font-body text-base text-[var(--aura-text-body)]">
              Small-batch beans sourced from volcanic highlands, roasted specifically to enhance
              the depth of night-time caffeine rituals.
            </p>
            <div className="mt-auto w-full pt-8">
              <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[rgba(198,198,199,0.3)] to-transparent" />
              <span className="font-body text-xs font-semibold uppercase tracking-widest text-[rgba(198,198,199,0.4)]">
                The Craft
              </span>
            </div>
          </article>

          {/* Card 3: Lounge Atmosphere */}
          <article
            className="flex flex-col items-start gap-6 bg-white/5 p-6 transition-transform duration-500 hover:-translate-y-2"
            style={{
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(198, 198, 199, 0.15)',
            }}
            aria-label="Lounge Atmosphere"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-chrome-light)]/30 text-[var(--aura-chrome-light)]">
              <Moon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[24px] text-[var(--aura-chrome-bright)]">
              Lounge Atmosphere
            </h3>
            <p className="font-body text-base text-[var(--aura-text-body)]">
              Transitioning as the sun sets, our lighting shifts to a warm bronze glow,
              complemented by a curated lo-fi industrial soundscape.
            </p>
            <div className="mt-auto w-full pt-8">
              <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[rgba(198,198,199,0.3)] to-transparent" />
              <span className="font-body text-xs font-semibold uppercase tracking-widest text-[rgba(198,198,199,0.4)]">
                Experience
              </span>
            </div>
          </article>
        </div>
      </section>

      {/* ===== Visual Teaser ===== */}
      <section
        className="relative flex h-[614px] w-full items-center overflow-hidden"
        aria-label="Visual teaser"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-10000 hover:scale-100"
          role="img"
          aria-label="A cinematic, low-light photograph of a high-end industrial cafe interior at night featuring dark navy steel container walls with warm bronze pendant lighting and chrome espresso machines"
          style={{ backgroundImage: `url('${bgImageUrl}')` }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#00142c] via-[#00142c]/40 to-transparent" />
        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 md:px-16">
          <div className="max-w-xl">
            <h2 className="mb-2 font-display text-[32px] leading-[40px] text-[var(--aura-chrome-bright)]">
              The Night is Your Canvas
            </h2>
            <p className="font-body text-lg italic text-[var(--aura-text-body)]">
              Find clarity in the shadows.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer
        className="w-full border-t border-[rgba(198,198,199,0.1)] bg-[#00142c] py-6"
        aria-label={t('footer.connect')}
      >
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-4 px-5 md:flex-row md:items-center md:justify-between md:px-16">
          {/* Brand & copyright */}
          <div className="flex flex-col items-center gap-2 md:items-start">
            <Link
              to="/"
              className="font-display text-[24px] tracking-widest text-[var(--aura-chrome-bright)] uppercase"
              aria-label={brandName}
            >
              {brandName}
            </Link>
            <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-text-body)]">
              &copy; 2024 {brandName}. All rights reserved.
            </p>
          </div>

          {/* Social links */}
          <div className="flex gap-6">
            <Link
              to="#"
              className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label="Instagram"
            >
              Instagram
            </Link>
            <Link
              to="#"
              className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label="LinkedIn"
            >
              LinkedIn
            </Link>
            <Link
              to="/contact"
              className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label={t('footer.contact')}
            >
              Contact
            </Link>
            <Link
              to="#"
              className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label="Privacy"
            >
              Privacy
            </Link>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--aura-chrome-light)]" />
            <span className="font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-chrome-light)]">
              {t('home.statusOpen', 'Currently Open')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
