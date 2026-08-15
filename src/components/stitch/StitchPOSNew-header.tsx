'use client';

import { useTranslation } from 'react-i18next';
import { Clock, Terminal, PersonStanding } from 'lucide-react';

export function POSHeader({ brandName }: { brandName: string }) {
  const { t } = useTranslation();
  return (
    <header
      className="bg-[rgba(24,16,10,0.8)] backdrop-blur-xl border-b border-[rgba(242,192,141,0.08)] flex justify-between items-center px-6 h-16 w-full fixed top-0 z-50"
      role="banner"
    >
      <div className="flex items-center gap-4">
        <h1 className="text-[14px] text-[var(--aura-primary, #f2c08d)] uppercase tracking-widest font-semibold font-body">
          {brandName}
        </h1>
        <div className="h-6 w-px bg-[rgba(242,192,141,0.15)]" aria-hidden="true" />
        <span className="text-[12px] text-[#8a7a6a] flex items-center gap-1.5 font-body">
          <Terminal className="w-4 h-4" />
          {t('posNew.terminalSession')}
        </span>
      </div>
      <div className="flex items-center gap-5">
        <button
          type="button"
          className="text-[#8a7a6a] hover:text-[var(--aura-text-primary, #eae1db)] transition-colors cursor-pointer"
          aria-label={t('posNew.schedule')}
        >
          <Clock className="w-5 h-5" />
        </button>
        <div
          className="flex items-center gap-2 bg-[rgba(28,20,14,0.3)] px-3 py-1.5 rounded-lg border border-[rgba(242,192,141,0.1)] cursor-pointer active:scale-95 transition-transform"
          role="button"
          tabIndex={0}
          aria-label={t('posNew.userProfile')}
        >
          <PersonStanding className="w-4 h-4 text-[var(--aura-primary, #f2c08d)]" />
          <span className="text-[12px] font-body">Julian R.</span>
        </div>
      </div>
    </header>
  );
}
