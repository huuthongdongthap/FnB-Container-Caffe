/**
 * StitchOrderSuccessNew-footer — Footer navigation for order success screen
 *
 * Renders support, privacy, and terms links with copyright notice,
 * matching the original AURA CAFE footer design.
 */

'use client';

import { useTranslation } from 'react-i18next';

export function OrderSuccessNewFooter() {
  const { t } = useTranslation();

  return (
    <footer className="w-full py-8 border-t border-white/5 flex flex-col items-center gap-2 px-5 bg-transparent">
      <nav className="flex gap-4 mb-2" aria-label={t('footer.footerAriaLabel')}>
        <a
          href="#"
          className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
        >
          {t('stitch.orderSuccessNewSupport', {
            defaultValue: 'SUPPORT',
          })}
        </a>
        <a
          href="#"
          className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
        >
          {t('footer.footerPrivacy', {
            defaultValue: 'PRIVACY POLICY',
          })}
        </a>
        <a
          href="#"
          className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
        >
          {t('footer.footerTerms', { defaultValue: 'TERMS' })}
        </a>
      </nav>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-soft)] opacity-40">
        {t('footer.copyright', {
          defaultValue:
            '© {{year}} AURA CAFE. ALL RIGHTS RESERVED.',
          year: 2024,
        })}
      </p>
    </footer>
  );
}
