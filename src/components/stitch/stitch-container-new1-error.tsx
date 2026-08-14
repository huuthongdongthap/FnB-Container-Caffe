'use client';

import { useTranslation } from 'react-i18next';

/**
 * Error state for StitchContainerNew1.
 */
export function ContainerCafeError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'rgba(12, 32, 56, 0.8)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="var(--aura-error)" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          color: 'var(--aura-chrome-bright)',
        }}
      >
        {t('common.error')}
      </h3>
      <p style={{ color: 'var(--aura-chrome-soft)' }}>{message}</p>
    </div>
  );
}
