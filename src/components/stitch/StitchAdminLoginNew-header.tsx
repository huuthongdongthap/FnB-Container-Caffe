/**
 * StitchAdminLoginNew — Header sub-component
 *
 * Top navigation shell with brand logo and utility icons.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Headphones, Moon } from 'lucide-react';

interface LoginHeaderProps {
  brandName: string;
}

export function LoginHeader({ brandName }: Readonly<LoginHeaderProps>) {
  const { t } = useTranslation();

  return (
    <header className="fixed top-0 left-0 w-full flex justify-between items-center px-12 py-6 z-50">
      <div className="font-display-logo text-display-logo text-primary tracking-wider">
        {brandName}
      </div>
      <div className="flex gap-4" aria-hidden="true">
        <Headphones
          className="w-5 h-5 text-primary cursor-pointer transition-all active:scale-95"
          aria-label={t('adminLogin.supportAriaLabel')}
        />
        <Moon
          className="w-5 h-5 text-primary cursor-pointer transition-all active:scale-95"
          aria-label={t('adminLogin.darkModeAriaLabel')}
        />
      </div>
    </header>
  );
}
