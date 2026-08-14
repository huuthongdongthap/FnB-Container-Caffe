'use client';

import { useTranslation } from 'react-i18next';

/**
 * Empty state for StitchContainerNew1.
 */
export function ContainerCafeEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'rgba(12, 32, 56, 0.8)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#5a6270" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          color: 'var(--aura-chrome-bright)',
        }}
      >
        {t('common.noData')}
      </h3>
    </div>
  );
}
