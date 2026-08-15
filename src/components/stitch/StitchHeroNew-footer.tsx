import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SPACE_GROTESK, LIBRE_CASLON } from './StitchHeroNew-types';

interface StitchHeroNewFooterProps {
  brandName: string;
}

const SOCIAL_LINKS = [
  { to: '#', labelKey: 'footer.instagram', fallback: 'Instagram' },
  { to: '#', labelKey: 'footer.linkedin', fallback: 'LinkedIn' },
  { to: '/contact', labelKey: 'footer.contact', fallback: 'Contact' },
  { to: '#', labelKey: 'footer.privacy', fallback: 'Privacy' },
];

const LINK_STYLE = {
  fontFamily: SPACE_GROTESK,
  fontSize: '12px',
  lineHeight: '16px',
  fontWeight: 600,
  letterSpacing: '0.1em',
} as const;

export function StitchHeroNewFooter({ brandName }: StitchHeroNewFooterProps) {
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t border-[rgba(198,198,199,0.1)] bg-[#00142c] py-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-8 px-5 md:flex-row md:items-center md:justify-between md:px-16">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <div
            style={{ fontFamily: LIBRE_CASLON, fontSize: '24px', lineHeight: '32px', fontWeight: 400 }}
            className="tracking-widest text-[var(--aura-chrome-bright)] uppercase"
          >
            {brandName}
          </div>
          <p
            style={LINK_STYLE}
            className="text-[var(--aura-chrome-soft)]"
          >
            {'©'} 2024 {brandName}.{' '}
            {t('footer.allRights', 'All rights reserved.')}
          </p>
        </div>

        <div className="flex gap-6">
          {SOCIAL_LINKS.map((link) => (
            <Link
              key={link.labelKey}
              to={link.to}
              style={LINK_STYLE}
              className="uppercase tracking-widest text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
            >
              {t(link.labelKey, link.fallback)}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--aura-chrome-bright)]" />
          <span
            style={LINK_STYLE}
            className="uppercase tracking-widest text-[var(--aura-chrome-bright)]"
          >
            {t('home.statusOpen', 'Currently Open')}
          </span>
        </div>
      </div>
    </footer>
  );
}
