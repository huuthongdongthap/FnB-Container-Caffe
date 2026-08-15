/**
 * StitchContactNew — Map section
 */
'use client';

import { useTranslation } from 'react-i18next';

export function MapSection() {
  const { t } = useTranslation();

  return (
    <div
      className="md:col-span-12 h-64 md:h-96 relative overflow-hidden rounded-lg"
      style={{
        border: '1px solid rgba(198,198,199,0.1)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="absolute top-4 left-4 z-10 bg-[var(--aura-surface-dim)]/80 p-4 border border-[var(--aura-bronze-shimmer)]/30 backdrop-blur-md rounded">
        <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)]">
          {t('contact.mapLabel', 'LIVE MAP NAVIGATION')}
        </p>
        <p className="font-['Space_Grotesk'] text-[14px] leading-relaxed text-[var(--aura-chrome-bright)]">
          {t('contact.mapLocation', 'Sa Dec Industrial Park Hub')}
        </p>
      </div>

      <div
        className="w-full h-full grayscale contrast-125 brightness-75 hover:grayscale-0 transition-all duration-700 bg-cover bg-center"
        style={{
          backgroundImage:
            'url("https://lh3.googleusercontent.com/aida-public/AB6AXuArekfgKcIZ2coS8KnTt30hWty6mPozaUNYOTXOLlu8VafNmk3Vp1cGS7pJst5AVzb2zN8LpH2AwYr6-s7d5j0AWkW64Pkq7UL80MynMT3nBk_oiDhXVE-6wKvxdFRmvdyZbzj19-HsiWc0GJS-LmD4-hX6tULQVd5INxGG2r8MwHwAH2e6WHkANKQnFQCgoHvkhWb2uxow3gB9ocsAndB5r36ruC7jC6ndrojr14roOFcyxAJiNJssBnbcMhwVskGOaakRdsC0AUI")',
        }}
      />
    </div>
  );
}
