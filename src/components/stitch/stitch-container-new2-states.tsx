/**
 * Error and Empty state components for StitchContainerNew2.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from './stitch-container-new2-types';

export function ContainerCafeNew2Error({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-surface-container) 60%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
        borderLeft: '1px solid color-mix(in srgb, var(--aura-chrome-soft) 10%, transparent)',
      }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke={COLORS.error} strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-[32px]/[40px] font-medium"
        style={{ fontFamily: FONTS.display, color: COLORS.onSurface }}
      >
        {t('common.error')}
      </h3>
      <p
        className="text-base"
        style={{ fontFamily: FONTS.body, color: COLORS.secondary }}
      >
        {message}
      </p>
    </div>
  );
}

export function ContainerCafeNew2Empty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-surface-container) 60%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
        borderLeft: '1px solid color-mix(in srgb, var(--aura-chrome-soft) 10%, transparent)',
      }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="var(--aura-bronze-shimmer)" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
      <h3
        className="text-[32px]/[40px] font-medium"
        style={{ fontFamily: FONTS.display, color: COLORS.onSurface }}
      >
        {t('common.noData')}
      </h3>
    </div>
  );
}
