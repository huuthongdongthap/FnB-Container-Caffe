import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface StitchHeroProps {
  bgImageUrl?: string;
}

const defaultBgImageUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAQ7LKJyxWHBZcahZcqLuOOZM7PTKGFtggxdHK_crQ5cRvcKDc6pXZ-KbeUzRXpiri9SQ29t63K-hKfK-QLqkqSLT7OQzl9hB-TuYYp7SxjUinCA8AXMwLonZmvq21vIFllN8y_crlJK7s1I6n0g0G3yZ9POmp6HIrs8GDYgf0Hy6DZPQHqf1KJriKtxtukwxKgVB5ogq3OawmDNqg_BmK9Yg40Egv7XYYVmpm9615nYuUbDe3715B2M27qL3-HclVAi0lSeWLWZUMj';

export default function StitchHero({
  bgImageUrl = defaultBgImageUrl,
}: Readonly<StitchHeroProps>) {
  const { t } = useTranslation();
  return (
    <header className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a2e]/80 via-transparent to-[#0a1a2e] z-10" />
        <div
          className="w-full h-full bg-cover bg-center scale-105 animate-[pulse_10s_infinite_alternate]"
          style={{ backgroundImage: `url('${bgImageUrl}')` }}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 text-center px-[24px] max-w-4xl">
        <p className="text-sm tracking-[0.3em] uppercase text-[#b8c7e2] mb-4 font-['Space_Grotesk',sans-serif] font-semibold">
          {t('hero.tagline')}
        </p>
        <h1 className="font-display text-[clamp(2.5rem,10vw,4rem)] text-[#e4e2e4] mb-8 leading-tight font-medium tracking-[-0.02em]">
          {t('hero.title')}
          <br />
          <span className="italic font-light">5 khu vực độc đáo: Cafe, Trà Sữa, Beer, Lounge &amp; Garden</span>
          <span className="block text-sm tracking-[0.15em] text-[#b8c7e2]/70 mt-3 font-['Space_Grotesk',sans-serif]">{t('hero.subtitle')}</span>
        </h1>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <Link
            to="/table-reservation"
            className="w-full md:w-auto bg-gradient-to-br from-[#e0e0e0] via-[#a0a0a0] to-[#c0c0c0] text-black text-sm tracking-[0.1em] font-semibold px-10 py-5 font-['Space_Grotesk',sans-serif] hover:scale-105 transition-transform duration-300 inline-block text-center"
          >
            {t('hero.bookNow')}
          </Link>
          <Link
            to="/menu"
            className="w-full md:w-auto border border-[#b8c7e2]/50 text-[#b8c7e2] text-sm tracking-[0.1em] font-semibold px-10 py-5 font-['Space_Grotesk',sans-serif] backdrop-blur-sm hover:bg-[#b8c7e2]/10 transition-all duration-300 inline-block text-center"
          >
            {t('hero.viewMenu')}
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-50 pointer-events-none">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </header>
  );
}
