import { useTranslation } from 'react-i18next';
import { FooterProps } from './StitchMenu2New-types';

export function Footer({ brandName }: FooterProps) {
  const { t } = useTranslation();
  return (
    <footer
      className="w-full border-t border-[#c7c6c4]/30 bg-[var(--aura-bg-page, #0A1A2E)] py-12"
      aria-label={t('stitch.menu2.footerAriaLabel')}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 md:flex-row md:justify-between md:px-16">
        {/* Brand */}
        <div className="font-display text-2xl uppercase text-[#c7c6c4]">
          {brandName}
        </div>

        {/* Footer Links */}
        <nav className="flex gap-8" aria-label={t('stitch.menu2.footerLinksLabel')}>
          <a
            href="#"
            className="font-body text-sm font-medium text-[#8e9097] transition-colors hover:text-[#b5c8e7]"
            aria-label={t('stitch.menu2.footerPrivacy')}
          >
            {t('stitch.menu2.footerPrivacy')}
          </a>
          <a
            href="#"
            className="font-body text-sm font-medium text-[#8e9097] transition-colors hover:text-[#b5c8e7]"
            aria-label={t('stitch.menu2.footerTerms')}
          >
            {t('stitch.menu2.footerTerms')}
          </a>
          <a
            href="#"
            className="font-body text-sm font-medium text-[#8e9097] transition-colors hover:text-[#b5c8e7"
            aria-label={t('stitch.menu2.footerInstagram')}
          >
            {t('stitch.menu2.footerInstagram')}
          </a>
        </nav>

        {/* Copyright */}
        <div className="font-body text-sm text-[#c7c6c4]/60">
          &copy; {new Date().getFullYear()} {brandName}. {t('stitch.menu2.allRightsReserved')}
        </div>
      </div>
    </footer>
  );
}
