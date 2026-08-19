import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  heroBgUrl: string;
}

/** Hero section with background image, tagline, title, description and CTA buttons. */
export function HeroSection({ heroBgUrl }: HeroSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="relative z-10 px-6 py-10 sm:px-16 sm:py-20 flex flex-col items-center justify-center min-h-[600px] sm:min-h-[870px] text-center">
      <div
        className="p-12 md:p-24 max-w-5xl w-full relative overflow-hidden"
        style={{
          background: 'rgba(148, 163, 184, 0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-dim) 30%, transparent)',
        }}
        data-glass-panel
      >
        {/* Background image behind hero content */}
        <div className="absolute inset-0 opacity-40 z-0" aria-hidden="true">
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url('${heroBgUrl}')` }}
          />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <span
            className="mb-6 tracking-[0.4em] uppercase"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '12px',
              lineHeight: '1',
              fontWeight: 600,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {t('landing.heroTagline', 'Sa Dec • Premium Coffee')}
          </span>
          <h1
            className="mb-8 max-w-3xl"
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: 'clamp(36px, 8vw, 64px)',
              lineHeight: '1.1',
              letterSpacing: '-0.02em',
              fontWeight: 500,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {t('landing.heroTitle', 'AURA CAFE')}
          </h1>
          <p
            className="max-w-2xl mb-12"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '18px',
              lineHeight: '1.6',
              fontWeight: 400,
              color: 'var(--aura-chrome-soft)',
            }}
          >
            {t(
              'landing.heroDescription',
              'Trải nghiệm cà phê container thượng hàng giữa không gian công nghiệp sang trọng. Nơi ánh sáng và bóng tối hòa quyền tạo nên bản giao hưởng kiến trúc độc bản.',
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-6">
            <button
              className="px-10 py-5 transition-all duration-500 uppercase flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, var(--aura-chrome-bright) 0%, #B48554 100%)',
                color: '#0c1c30',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '12px',
                lineHeight: '1',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 30px color-mix(in srgb, var(--aura-chrome-bright) 35%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {t('landing.exploreNow', 'Khám phá ngay')}
              <ArrowRight className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
            <button
              className="bg-transparent border px-10 py-5 uppercase transition-all flex items-center gap-3"
              style={{
                borderColor: 'var(--aura-chrome-dim)',
                color: 'var(--aura-chrome-bright)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '12px',
                lineHeight: '1',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--aura-bg-high) 30%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {t('landing.viewMenu', 'Thực đơn')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
