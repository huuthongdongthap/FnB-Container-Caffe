import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Factory, Coffee, Moon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface StitchHeroNewProps {
  /** Background image URL for the hero visual teaser section */
  bgImageUrl?: string;
  /** Top navigation logo text */
  brandName?: string;
}

const DEFAULT_BG_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBfNKpadgwatJIDobwM9ttZy3Q69wVsM3Vn0TJErgSvTAFZ_fpQDjSL2aR3DOyPPysLqE5q83CIynNaNUnjrYsxvkC_AxpMq3c2ZP5oLCcQoZ1SA3CZoBPgNyio99x3VPl4Cp2rvs5c1Bxo-wYTyx6i9R73q1npmzbQY9LKGy0CjwP3Eo99wiLLFgRQ3dA__JvvA579RlpXZKzFZsCzdteQwjRhiC7UY0aYzs5OOQE0SC_I2NGbhRqk98Vt6b2hSAKi2wGJnyGL7QE';

const SPACE_GROTESK = "'Space Grotesk', sans-serif";
const LIBRE_CASLON = "'Libre Caslon Text', Georgia, serif";

const GLASS_PANEL: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(198, 198, 199, 0.15)',
};

const CHROME_LINE: CSSProperties = {
  background: 'linear-gradient(90deg, transparent, rgba(198, 198, 199, 0.3), transparent)',
  height: '1px',
  width: '100%',
};

export function StitchHeroNew({
  bgImageUrl = DEFAULT_BG_IMAGE,
  brandName = 'AURA CAFE',
}: Readonly<StitchHeroNewProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [navVisible, setNavVisible] = useState(true);
  const glassRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll-based nav hide/show — matches original <script>
  useEffect(() => {
    let lastScrollTop = 0;
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > lastScrollTop && scrollTop > 100) {
        setNavVisible(false);
      } else {
        setNavVisible(true);
      }
      lastScrollTop = scrollTop;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Glass panel mousemove — matches original <script>
  useEffect(() => {
    const panels = glassRefs.current.filter(Boolean) as HTMLElement[];
    const handler = (e: MouseEvent) => {
      const panel = e.currentTarget as HTMLElement;
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      panel.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    };
    panels.forEach((p) => p.addEventListener('mousemove', handler));
    return () => panels.forEach((p) => p.removeEventListener('mousemove', handler));
  }, []);

  const setGlassRef =
    (i: number): ((el: HTMLDivElement | null) => void) =>
    (el) => {
      glassRefs.current[i] = el;
    };

  return (
    <>
      {/* ===== Top Navigation Bar ===== */}
      <nav
        style={{
          transform: navVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
        className="fixed top-0 z-50 w-full border-b border-[rgba(198,198,199,0.3)] bg-white/5 shadow-[0_0_30px_rgba(212,165,116,0.1)] backdrop-blur-xl"
      >
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-4 md:px-16">
          {/* Logo */}
          <Link
            to="/"
            style={{ fontFamily: LIBRE_CASLON, fontSize: '32px', lineHeight: '40px', fontWeight: 400 }}
            className="tracking-widest text-[#d4e3ff] uppercase"
          >
            {brandName}
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-6 md:flex">
            <Link
              to="/menu"
              style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
              className="border-b border-[#b8c7e2] pb-1 text-[#b8c7e2]"
            >
              {t('nav.menu', 'Menu')}
            </Link>
            <Link
              to="/gallery"
              style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
              className="text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
            >
              {t('nav.gallery', 'Gallery')}
            </Link>
            <Link
              to="/table-reservation"
              style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
              className="text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
            >
              {t('nav.reservations', 'Reservations')}
            </Link>
            <Link
              to="/about"
              style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
              className="text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
            >
              {t('nav.about', 'About')}
            </Link>
          </div>

          {/* Book Now CTA */}
          <button
            style={{
              fontFamily: SPACE_GROTESK,
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              border: '1px solid rgba(239, 189, 138, 0.5)',
            }}
            className="bg-[#291500] px-6 py-2 uppercase tracking-widest text-[#efbd8a] transition-all duration-300 hover:bg-[#efbd8a] hover:text-[#472a03] active:scale-95"
            onClick={() => navigate('/table-reservation')}
          >
            {t('hero.bookNow', 'Book Now')}
          </button>
        </div>
      </nav>

      {/* ===== Hero Section ===== */}
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-6 pt-24 md:px-16"
        style={{
          background: [
            'radial-gradient(circle at top right, rgba(184, 199, 226, 0.05), transparent 60%)',
            'radial-gradient(circle at bottom left, rgba(212, 165, 116, 0.03), transparent 50%)',
          ].join(', '),
          backgroundColor: '#00142c',
        }}
      >
        <div className="relative z-10 mx-auto w-full max-w-[1200px] text-center">
          {/* Tagline + chrome divider */}
          <div className="mb-8 inline-block">
            <span
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.3em',
              }}
              className="uppercase text-[rgba(198,198,199,0.6)]"
            >
              {t('hero.est', 'Est. 2024 • Industrial Luxury')}
            </span>
            <div style={CHROME_LINE} className="mt-2" />
          </div>

          {/* Main heading */}
          <h1
            style={{ fontFamily: LIBRE_CASLON }}
            className="mb-8 italic leading-tight text-[#d4e3ff] text-[40px] leading-[48px] tracking-[-0.01em] md:text-[64px] md:leading-[72px] md:tracking-[-0.02em]"
          >
            {t('hero.theArt', 'The Art of the ')}
            <span className="text-[#efbd8a]">{t('hero.nocturnal', 'Nocturnal')}</span>
            {t('hero.pour', ' Pour')}
          </h1>

          {/* Glass description panel */}
          <div
            className="mx-auto mb-6 max-w-2xl p-6"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
            }}
          >
            <p
              style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
              className="leading-relaxed text-[#c5c6cd]"
            >
              {t(
                'hero.description',
                'A redefined coffee experience set within architecturally salvaged shipping containers. AURA CAFE merges raw industrial textures with the warmth of boutique artisan roasts and the ambient glow of a premium night lounge.',
              )}
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <button
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                borderRadius: '4px',
              }}
              className="w-full bg-[#efbd8a] px-16 py-4 uppercase tracking-widest text-[#472a03] transition-all duration-500 hover:shadow-[0_0_30px_rgba(212,165,116,0.2)] md:w-auto"
              onClick={() => navigate('/table-reservation')}
            >
              {t('hero.bookTable', 'Book Your Table')}
            </button>
            <button
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                borderRadius: '4px',
              }}
              className="w-full border border-[rgba(198,198,199,0.3)] px-16 py-4 uppercase tracking-widest text-[#c6c6c7] transition-all duration-300 hover:bg-white/5 md:w-auto"
              onClick={() => navigate('/menu')}
            >
              {t('hero.exploreMenu', 'Explore Menu')}
            </button>
          </div>
        </div>

        {/* Decorative bottom line */}
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[rgba(198,198,199,0.2)] to-transparent" />
      </main>

      {/* ===== Feature Bento Grid ===== */}
      <section className="bg-[#000e23] px-5 py-16 md:px-16">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1: Industrial Roots */}
          <div
            ref={setGlassRef(0)}
            className="flex flex-col items-start gap-6 p-6 transition-transform duration-500 hover:-translate-y-2"
            style={GLASS_PANEL}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(239,189,138,0.3)] text-[#efbd8a]">
              <Factory className="h-6 w-6" />
            </div>
            <h3
              style={{ fontFamily: LIBRE_CASLON, fontSize: '24px', lineHeight: '32px', fontWeight: 400 }}
              className="text-[#d4e3ff]"
            >
              {t('home.industrialRoots', 'Industrial Roots')}
            </h3>
            <p
              style={{ fontFamily: SPACE_GROTESK, fontSize: '16px', lineHeight: '24px', fontWeight: 400 }}
              className="text-[#c5c6cd]"
            >
              {t(
                'home.industrialRootsDesc',
                'Housed in repurposed steel vessels, our space celebrates raw materials—polished concrete, exposed beams, and matte metal finishes.',
              )}
            </p>
            <div className="mt-auto w-full pt-8">
              <div style={CHROME_LINE} className="mb-4" />
              <span
                style={{
                  fontFamily: SPACE_GROTESK,
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
                className="text-[rgba(198,198,199,0.4)]"
              >
                {t('home.architecturalConcept', 'Architectural Concept')}
              </span>
            </div>
          </div>

          {/* Card 2: Artisan Roasts */}
          <div
            ref={setGlassRef(1)}
            className="relative flex flex-col items-start gap-6 overflow-hidden p-6 transition-transform duration-500 hover:-translate-y-2"
            style={GLASS_PANEL}
          >
            {/* Signature badge */}
            <div className="absolute right-0 top-0 p-4">
              <span
                style={{
                  fontFamily: SPACE_GROTESK,
                  fontSize: '10px',
                  lineHeight: '16px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  border: '1px solid rgba(239, 189, 138, 0.2)',
                }}
                className="bg-[rgba(239,189,138,0.1)] px-2 py-1 text-[#efbd8a]"
              >
                {t('home.signature', 'Signature')}
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(239,189,138,0.3)] text-[#efbd8a]">
              <Coffee className="h-6 w-6" />
            </div>
            <h3
              style={{ fontFamily: LIBRE_CASLON, fontSize: '24px', lineHeight: '32px', fontWeight: 400 }}
              className="text-[#d4e3ff]"
            >
              {t('home.artisanRoasts', 'Artisan Roasts')}
            </h3>
            <p
              style={{ fontFamily: SPACE_GROTESK, fontSize: '16px', lineHeight: '24px', fontWeight: 400 }}
              className="text-[#c5c6cd]"
            >
              {t(
                'home.artisanRoastsDesc',
                'Small-batch beans sourced from volcanic highlands, roasted specifically to enhance the depth of night-time caffeine rituals.',
              )}
            </p>
            <div className="mt-auto w-full pt-8">
              <div style={CHROME_LINE} className="mb-4" />
              <span
                style={{
                  fontFamily: SPACE_GROTESK,
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
                className="text-[rgba(198,198,199,0.4)]"
              >
                {t('home.theCraft', 'The Craft')}
              </span>
            </div>
          </div>

          {/* Card 3: Lounge Atmosphere */}
          <div
            ref={setGlassRef(2)}
            className="flex flex-col items-start gap-6 p-6 transition-transform duration-500 hover:-translate-y-2"
            style={GLASS_PANEL}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(239,189,138,0.3)] text-[#efbd8a]">
              <Moon className="h-6 w-6" />
            </div>
            <h3
              style={{ fontFamily: LIBRE_CASLON, fontSize: '24px', lineHeight: '32px', fontWeight: 400 }}
              className="text-[#d4e3ff]"
            >
              {t('home.loungeAtmosphere', 'Lounge Atmosphere')}
            </h3>
            <p
              style={{ fontFamily: SPACE_GROTESK, fontSize: '16px', lineHeight: '24px', fontWeight: 400 }}
              className="text-[#c5c6cd]"
            >
              {t(
                'home.loungeAtmosphereDesc',
                'Transitioning as the sun sets, our lighting shifts to a warm bronze glow, complemented by a curated lo-fi industrial soundscape.',
              )}
            </p>
            <div className="mt-auto w-full pt-8">
              <div style={CHROME_LINE} className="mb-4" />
              <span
                style={{
                  fontFamily: SPACE_GROTESK,
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
                className="text-[rgba(198,198,199,0.4)]"
              >
                {t('home.experience', 'Experience')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Visual Teaser ===== */}
      <section className="relative flex h-[614px] w-full items-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-[10000ms] hover:scale-100"
          style={{ backgroundImage: `url('${bgImageUrl}')` }}
          role="img"
          aria-label="A cinematic, low-light photograph of a high-end industrial cafe interior at night. The setting features dark navy steel shipping container walls with warm bronze pendant lighting casting soft glows on chrome silver espresso machines. A single barista in a dark apron is silhouetted against a softly blurred background of industrial luxury furniture and frosted glass partitions."
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#00142c] via-[rgba(0,20,44,0.4)] to-transparent" />
        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 md:px-16">
          <div className="max-w-xl">
            <h2
              style={{ fontFamily: LIBRE_CASLON, fontSize: '32px', lineHeight: '40px', fontWeight: 400 }}
              className="mb-4 text-[#d4e3ff]"
            >
              {t('home.nightCanvas', 'The Night is Your Canvas')}
            </h2>
            <p
              style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
              className="italic text-[#c5c6cd]"
            >
              {t('home.findClarity', 'Find clarity in the shadows.')}
            </p>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="w-full border-t border-[rgba(198,198,199,0.1)] bg-[#00142c] py-6">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-8 px-5 md:flex-row md:items-center md:justify-between md:px-16">
          {/* Brand & copyright */}
          <div className="flex flex-col items-center gap-2 md:items-start">
            <div
              style={{ fontFamily: LIBRE_CASLON, fontSize: '24px', lineHeight: '32px', fontWeight: 400 }}
              className="tracking-widest text-[#d4e3ff] uppercase"
            >
              {brandName}
            </div>
            <p
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '10px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              className="text-[#c5c6cd]"
            >
              {'©'} 2024 {brandName}.{' '}
              {t('footer.allRights', 'All rights reserved.')}
            </p>
          </div>

          {/* Social links */}
          <div className="flex gap-6">
            <Link
              to="#"
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              className="uppercase tracking-widest text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
            >
              {t('footer.instagram', 'Instagram')}
            </Link>
            <Link
              to="#"
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              className="uppercase tracking-widest text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
            >
              {t('footer.linkedin', 'LinkedIn')}
            </Link>
            <Link
              to="/contact"
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              className="uppercase tracking-widest text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
            >
              {t('footer.contact', 'Contact')}
            </Link>
            <Link
              to="#"
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              className="uppercase tracking-widest text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
            >
              {t('footer.privacy', 'Privacy')}
            </Link>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#efbd8a]" />
            <span
              style={{
                fontFamily: SPACE_GROTESK,
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              className="uppercase tracking-widest text-[#efbd8a]"
            >
              {t('home.statusOpen', 'Currently Open')}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
