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
        border: '1px solid rgba(var(--aura-chrome-light),0.1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="absolute top-4 left-4 z-10 bg-[var(--aura-surface-dim)]/80 p-4 border border-[var(--aura-bronze-shimmer)]/30 backdrop-blur-md rounded">
        <p className="font-body text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)]">
          {t('contact.mapLabel', 'BẢN ĐỒ ĐIỀU HƯỚNG')}
        </p>
        <p className="font-body text-[14px] leading-relaxed text-[var(--aura-chrome-bright)]">
          {t('contact.mapLocation', '29 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp')}
        </p>
      </div>

      <div
        className="w-full h-full grayscale contrast-125 brightness-75 hover:grayscale-0 transition-all duration-700 bg-cover bg-center"
        style={{
          backgroundImage:
            'url("/photos/IMG_6554-frame.webp")',
        }}
      />
    </div>
  );
}
