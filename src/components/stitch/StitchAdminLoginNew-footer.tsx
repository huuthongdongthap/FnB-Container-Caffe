/**
 * StitchAdminLoginNew — Footer sub-component
 *
 * Fixed footer with copyright and legal links.
 */

'use client';

import { useTranslation } from 'react-i18next';

interface LoginFooterProps {
  brandName: string;
}

export function LoginFooter({ brandName }: Readonly<LoginFooterProps>) {
  const { t } = useTranslation();

  return (
    <footer className="fixed bottom-0 left-0 w-full flex flex-wrap justify-between items-center gap-2 px-4 sm:px-12 py-3 pointer-events-none">
      <div className="font-label-caps text-label-caps text-on-surface-variant">
        {`© ${new Date().getFullYear()} ${brandName} INDUSTRIAL LUXE`}
      </div>
      <div className="flex gap-2 sm:gap-6 pointer-events-auto">
        <a
          href="#"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors no-underline"
          onClick={(e) => e.preventDefault()}
          aria-label={t('adminLogin.privacyAriaLabel')}
        >
          {t('adminLogin.privacy')}
        </a>
        <a
          href="#"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors no-underline"
          onClick={(e) => e.preventDefault()}
          aria-label={t('adminLogin.termsAriaLabel')}
        >
          {t('adminLogin.terms')}
        </a>
        <a
          href="#"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1 font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors no-underline"
          onClick={(e) => e.preventDefault()}
          aria-label={t('adminLogin.securityAriaLabel')}
        >
          {t('adminLogin.security')}
        </a>
      </div>
    </footer>
  );
}
