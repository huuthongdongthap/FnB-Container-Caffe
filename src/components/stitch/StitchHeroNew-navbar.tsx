import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SPACE_GROTESK, LIBRE_CASLON } from './StitchHeroNew-types';

interface StitchHeroNewNavbarProps {
  brandName: string;
  navVisible: boolean;
}

export function StitchHeroNewNavbar({ brandName, navVisible }: StitchHeroNewNavbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <nav
      style={{
        transform: navVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease-in-out',
      }}
      className="fixed top-0 z-50 w-full border-b border-[rgba(198,198,199,0.3)] bg-white/5 shadow-[0_0_30px_rgba(212,165,116,0.1)] backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-4 md:px-16">
        <Link
          to="/"
          style={{ fontFamily: LIBRE_CASLON, fontSize: '32px', lineHeight: '40px', fontWeight: 400 }}
          className="tracking-widest text-[var(--aura-chrome-bright)] uppercase"
        >
          {brandName}
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            to="/menu"
            style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
            className="border-b border-[var(--aura-noir-void)] pb-1 text-[var(--aura-noir-void)]"
          >
            {t('nav.menu', 'Menu')}
          </Link>
          <Link
            to="/gallery"
            style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
            className="text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
          >
            {t('nav.gallery', 'Gallery')}
          </Link>
          <Link
            to="/table-reservation"
            style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
            className="text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
          >
            {t('nav.reservations', 'Reservations')}
          </Link>
          <Link
            to="/about"
            style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
            className="text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
          >
            {t('nav.about', 'About')}
          </Link>
        </div>

        <button
          style={{
            fontFamily: SPACE_GROTESK,
            fontSize: '12px',
            lineHeight: '16px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 50%, transparent)',
          }}
          className="bg-[#291500] px-6 py-2 uppercase tracking-widest text-[var(--aura-chrome-bright)] transition-all duration-300 hover:bg-[var(--aura-chrome-bright)] hover:text-[var(--aura-noir-deep)] active:scale-95"
          onClick={() => navigate('/table-reservation')}
        >
          {t('hero.bookNow', 'Book Now')}
        </button>
      </div>
    </nav>
  );
}
