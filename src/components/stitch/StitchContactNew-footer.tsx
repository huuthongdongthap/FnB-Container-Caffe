/**
 * StitchContactNew — Footer section
 */
'use client';

import { useTranslation } from 'react-i18next';
import { FOOTER_LINKS } from './StitchContactNew-constants';

export function Footer({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { t } = useTranslation();

  return (
    <footer className="w-full py-12 border-t border-white/5 flex flex-col items-center gap-2 px-6 bg-transparent">
      <div className="flex gap-4 mb-4">
        {FOOTER_LINKS.map((link) => (
          <button
            key={link.path}
            onClick={() => onNavigate?.(link.path)}
            className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
          >
            {t(link.i18nKey, link.fallback)}
          </button>
        ))}
      </div>
      <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)]">
        &copy; 2024 AURA CAFE. ALL RIGHTS RESERVED.
      </p>
    </footer>
  );
}
