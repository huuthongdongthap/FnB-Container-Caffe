'use client';

import { useTranslation } from 'react-i18next';

interface StitchMenuNewFooterProps {
  brandName: string;
}

export function StitchMenuNewFooter({ brandName }: StitchMenuNewFooterProps) {
  const { t } = useTranslation();

  return (
    <footer
      className="w-full border-t border-[var(--aura-chrome-dim)] bg-[var(--aura-bg-page)] py-8"
      aria-label={t('footer.connect')}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 md:flex-row md:justify-between">
        <div
          className="text-[32px] leading-[1.2] text-[var(--aura-noir-void)]"
          style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
        >
          {t('stitch.brandName', { defaultValue: brandName })}
        </div>
        <p
          className="text-base leading-[1.6] text-center md:text-left text-[var(--aura-chrome-soft)]"
          style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
        >
          &copy; 2024 {brandName}.{' '}
          {t('stitch.footerTagline', { defaultValue: 'Industrial Luxury Dining.' })}
        </p>
        <nav className="flex gap-4" aria-label={t('footer.connect')}>
          <a
            href="#"
            className="text-xs font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
            style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {t('stitch.footerContact', { defaultValue: 'Contact' })}
          </a>
          <a
            href="#"
            className="text-xs font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
            style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {t('stitch.footerPrivacy', { defaultValue: 'Privacy Policy' })}
          </a>
          <a
            href="#"
            className="text-xs font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
            style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {t('stitch.footerTerms', { defaultValue: 'Terms of Service' })}
          </a>
        </nav>
      </div>
    </footer>
  );
}
