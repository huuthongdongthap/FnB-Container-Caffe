import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
    <>
      {/* ===== Top Navigation Bar ===== */}
      <nav
        className="fixed top-0 z-50 w-full border-b border-[var(--aura-border-muted)] bg-white/5 shadow-[var(--aura-glow-chrome)] backdrop-blur-xl"
        aria-label={t('nav.openMenu')}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-16">
          {/* Logo */}
          <Link
            to="/"
            className="font-['Libre_Caslon_Text',serif] text-2xl tracking-widest text-[var(--aura-chrome-bright)] uppercase"
            aria-label={brandName}
          >
            {t('hero.title')}
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-6 md:flex">
            <Link
              to="/menu"
              className="border-b border-[var(--aura-chrome-light)] pb-1 font-['Space_Grotesk',sans-serif] text-lg text-[var(--aura-chrome-light)]"
              aria-label={t('nav.menu')}
            >
              {t('nav.menu')}
            </Link>
            <Link
              to="/about"
              className="font-['Space_Grotesk',sans-serif] text-lg text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label={t('nav.spaces')}
            >
              {t('nav.spaces')}
            </Link>
            <Link
              to="/table-reservation"
              className="font-['Space_Grotesk',sans-serif] text-lg text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label={t('nav.reservations')}
            >
              {t('nav.reservations')}
            </Link>
            <Link
              to="/events"
              className="font-['Space_Grotesk',sans-serif] text-lg text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label={t('nav.events')}
            >
              {t('nav.events')}
            </Link>
          </div>

          {/* Book Now CTA */}
          <Link
            to="/table-reservation"
            className="border border-[var(--aura-chrome-light)]/50 bg-[var(--aura-noir-deep)] px-6 py-2 font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-chrome-light)] transition-all duration-300 hover:bg-[var(--aura-chrome-light)] hover:text-[var(--aura-noir-void)] active:scale-95"
            aria-label={t('hero.bookNow')}
          >
            {t('hero.bookNow')}
          </Link>
        </div>
      </nav>

      {/* ===== Hero Section ===== */}
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--aura-noir-void)] px-5 pb-6 pt-24 md:px-16"
        aria-label={t('hero.title')}
        style={{
          backgroundImage:
            'radial-gradient(circle at top right, rgba(201, 214, 223, 0.05), transparent 60%), radial-gradient(circle at bottom left, rgba(107, 159, 184, 0.03), transparent 50%)',
        }}
      >
        <div className="relative z-10 mx-auto w-full max-w-6xl text-center">
          {/* Tagline + chrome divider */}
          <div className="mb-8 inline-block">
            <span className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-[0.3em] text-[var(--aura-text-body)]/60">
              Est. 2024 &bull; {t('home.statsSpaces')}
            </span>
            <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-[var(--aura-chrome-light)]/20 to-transparent" />
          </div>

          {/* Main heading */}
          <h1 className="mb-8 font-['Libre_Caslon_Text',serif] text-4xl leading-tight italic text-[var(--aura-chrome-bright)] md:text-6xl md:leading-tight md:tracking-[-0.02em]">
            {t('hero.tagline')}{' '}
            <span className="text-[var(--aura-chrome-light)]">{t('hero.subtitle')}</span>
          </h1>

          {/* Glass description panel */}
          <div
            className="mx-auto mb-6 max-w-2xl rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
            aria-label="Description panel"
          >
            <p className="font-['Space_Grotesk',sans-serif] text-lg leading-relaxed text-[var(--aura-text-body)]">
              A redefined coffee experience set within architecturally salvaged shipping containers.
              AURA CAFE merges raw industrial textures with the warmth of boutique artisan roasts
              and the ambient glow of a premium night lounge.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <Link
              to="/table-reservation"
              className="w-full rounded-lg bg-[var(--aura-chrome-light)] px-16 py-4 font-['Space_Grotesk',sans-serif] text-xs font-bold uppercase tracking-widest text-[var(--aura-noir-void)] shadow-[var(--aura-glow-chrome)] transition-all duration-500 hover:shadow-[var(--aura-glow-chrome-strong)] md:w-auto"
              aria-label={t('hero.bookNow')}
            >
              {t('hero.bookNow')}
            </Link>
            <Link
              to="/menu"
              className="w-full rounded-lg border border-[var(--aura-border-muted)] px-16 py-4 font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-all duration-300 hover:bg-white/5 md:w-auto"
              aria-label={t('hero.viewMenu')}
            >
              {t('hero.viewMenu')}
            </Link>
          </div>
        </div>

        {/* Bottom chrome divider */}
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--aura-chrome-light)]/15 to-transparent" />
      </main>

      {/* ===== Feature Bento Grid ===== */}
      <section
        className="bg-[var(--aura-noir-void)] px-5 py-16 md:px-16"
        aria-label={t('home.statsLabel')}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1: Industrial Roots */}
          <article
            className="flex flex-col items-start gap-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-transform duration-500 hover:-translate-y-2"
            aria-label="Industrial Roots"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-chrome-light)]/30 text-[var(--aura-chrome-light)]">
              <span
                className="material-symbols-outlined select-none"
                aria-hidden="true"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24" }}
              >
                factory
              </span>
            </div>
            <h3 className="font-['Libre_Caslon_Text',serif] text-2xl text-[var(--aura-chrome-bright)]">
              Industrial Roots
            </h3>
            <p className="font-['Space_Grotesk',sans-serif] text-base text-[var(--aura-text-body)]">
              Housed in repurposed steel vessels, our space celebrates raw materials&mdash;polished
              concrete, exposed beams, and matte metal finishes.
            </p>
            <div className="mt-auto w-full pt-8">
              <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[var(--aura-chrome-light)]/20 to-transparent" />
              <span className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)]/40">
                Architectural Concept
              </span>
            </div>
          </article>

          {/* Card 2: Artisan Roasts */}
          <article
            className="relative flex flex-col items-start gap-6 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-transform duration-500 hover:-translate-y-2"
            aria-label="Artisan Roasts"
          >
            {/* Badge */}
            <div className="absolute right-0 top-0 p-2">
              <span className="border border-[var(--aura-chrome-light)]/20 bg-[var(--aura-chrome-light)]/10 px-2 py-1 font-['Space_Grotesk',sans-serif] text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-chrome-light)]">
                Signature
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-chrome-light)]/30 text-[var(--aura-chrome-light)]">
              <span
                className="material-symbols-outlined select-none"
                aria-hidden="true"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' 0, 'opsz' 24" }}
              >
                coffee
              </span>
            </div>
            <h3 className="font-['Libre_Caslon_Text',serif] text-2xl text-[var(--aura-chrome-bright)]">
              Artisan Roasts
            </h3>
            <p className="font-['Space_Grotesk',sans-serif] text-base text-[var(--aura-text-body)]">
              Small-batch beans sourced from volcanic highlands, roasted specifically to enhance the
              depth of night-time caffeine rituals.
            </p>
            <div className="mt-auto w-full pt-8">
              <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[var(--aura-chrome-light)]/20 to-transparent" />
              <span className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)]/40">
                The Craft
              </span>
            </div>
          </article>

          {/* Card 3: Lounge Atmosphere */}
          <article
            className="flex flex-col items-start gap-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-transform duration-500 hover:-translate-y-2"
            aria-label="Lounge Atmosphere"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-chrome-light)]/30 text-[var(--aura-chrome-light)]">
              <span
                className="material-symbols-outlined select-none"
                aria-hidden="true"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24" }}
              >
                nightlight
              </span>
            </div>
            <h3 className="font-['Libre_Caslon_Text',serif] text-2xl text-[var(--aura-chrome-bright)]">
              Lounge Atmosphere
            </h3>
            <p className="font-['Space_Grotesk',sans-serif] text-base text-[var(--aura-text-body)]">
              Transitioning as the sun sets, our lighting shifts to a warm bronze glow,
              complemented by a curated lo-fi industrial soundscape.
            </p>
            <div className="mt-auto w-full pt-8">
              <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[var(--aura-chrome-light)]/20 to-transparent" />
              <span className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)]/40">
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
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] via-[var(--aura-noir-void)]/40 to-transparent" />
        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 md:px-16">
          <div className="max-w-xl">
            <h2 className="mb-2 font-['Libre_Caslon_Text',serif] text-3xl text-[var(--aura-chrome-bright)] md:text-4xl">
              The Night is Your Canvas
            </h2>
            <p className="font-['Space_Grotesk',sans-serif] text-lg italic text-[var(--aura-text-body)]">
              Find clarity in the shadows.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer
        className="w-full border-t border-[var(--aura-border-muted)] bg-[var(--aura-noir-void)] py-6"
        aria-label={t('footer.connect')}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 md:flex-row md:items-center md:justify-between md:px-16">
          {/* Brand & copyright */}
          <div className="flex flex-col items-center gap-2 md:items-start">
            <Link
              to="/"
              className="font-['Libre_Caslon_Text',serif] text-2xl tracking-widest text-[var(--aura-chrome-bright)] uppercase"
              aria-label={t('hero.title')}
            >
              {t('hero.title')}
            </Link>
            <p className="font-['Space_Grotesk',sans-serif] text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-text-body)]">
              &copy; 2024 {t('hero.title')}. All rights reserved.
            </p>
          </div>

          {/* Social links */}
          <div className="flex gap-6">
            <Link
              to="#"
              className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label="Instagram"
            >
              Instagram
            </Link>
            <Link
              to="#"
              className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label="LinkedIn"
            >
              LinkedIn
            </Link>
            <Link
              to="/contact"
              className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label={t('footer.contact')}
            >
              Contact
            </Link>
            <Link
              to="#"
              className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-body)] transition-colors hover:text-[var(--aura-chrome-light)]"
              aria-label="Privacy"
            >
              Privacy
            </Link>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--aura-chrome-light)]" />
            <span className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest text-[var(--aura-chrome-light)]">
              {t('home.statsCustomers')}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
