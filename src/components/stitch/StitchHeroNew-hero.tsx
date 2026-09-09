import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SPACE_GROTESK, LIBRE_CASLON, CHROME_LINE } from './StitchHeroNew-types';

export function StitchHeroNewHero() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-6 pt-24 md:px-16"
      style={{
        background: [
          'radial-gradient(circle at top right, color-mix(in srgb, var(--aura-noir-void) 5%, transparent), transparent 60%)',
          'radial-gradient(circle at bottom left, color-mix(in srgb, var(--aura-chrome-bright) 3%, transparent), transparent 50%)',
        ].join(', '),
        backgroundColor: 'var(--aura-noir-deep,#00142c)',
      }}
    >
      <div className="relative z-10 mx-auto w-full max-w-[1200px] text-center">
        <div className="mb-8 inline-block">
          <span
            style={{
              fontFamily: SPACE_GROTESK,
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 600,
              letterSpacing: '0.3em',
            }}
            className="uppercase text-[color-mix(in_srgb,var(--aura-chrome-light)_60%,transparent)]"
          >
            {t('hero.est', 'Est. 2024 • Industrial Luxury')}
          </span>
          <div style={CHROME_LINE} className="mt-2" />
        </div>

        <h1
          style={{ fontFamily: LIBRE_CASLON }}
          className="mb-8 italic leading-tight text-[var(--aura-chrome-bright)] text-[40px] leading-[48px] tracking-[-0.01em] md:text-[64px] md:leading-[72px] md:tracking-[-0.02em]"
        >
          {t('hero.theArt', 'The Art of the ')}
          <span className="text-[var(--aura-chrome-bright)]">{t('hero.nocturnal', 'Nocturnal')}</span>
          {t('hero.pour', ' Pour')}
        </h1>

        <div
          className="mx-auto mb-6 max-w-2xl p-6"
          style={{
            background: 'color-mix(in srgb, var(--aura-glass-bg) 5%, transparent)',
            backdropFilter: 'blur(8px)',
            border: '1px solid color-mix(in srgb, var(--aura-glass-bg) 10%, transparent)',
            borderRadius: '8px',
          }}
        >
          <p
            style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
            className="leading-relaxed text-[var(--aura-chrome-soft)]"
          >
            {t(
              'hero.description',
              'A redefined coffee experience set within architecturally salvaged shipping containers. AURA CAFE merges raw industrial textures with the warmth of boutique artisan roasts and the ambient glow of a premium night lounge.',
            )}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
          <button type="button"
            style={{
              fontFamily: SPACE_GROTESK,
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              borderRadius: '4px',
            }}
            className="w-full bg-[var(--aura-chrome-bright)] px-16 py-4 uppercase tracking-widest text-[var(--aura-noir-deep)] transition-all duration-500 hover:shadow-[0_0_30px_color-mix(in_srgb,var(--aura-chrome-light)_20%,transparent)] md:w-auto"
            onClick={() => navigate('/table-reservation')}
          >
            {t('hero.bookTable', 'Book Your Table')}
          </button>
          <button type="button"
            style={{
              fontFamily: SPACE_GROTESK,
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              borderRadius: '4px',
            }}
            className="w-full border border-[color-mix(in_srgb,var(--aura-chrome-light)_30%,transparent)] px-16 py-4 uppercase tracking-widest text-[var(--aura-text-body,#c6c6c7)] transition-all duration-300 hover:bg-white/5 md:w-auto"
            onClick={() => navigate('/menu')}
          >
            {t('hero.exploreMenu', 'Explore Menu')}
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--aura-chrome-light)_20%,transparent)] to-transparent" />
    </main>
  );
}
