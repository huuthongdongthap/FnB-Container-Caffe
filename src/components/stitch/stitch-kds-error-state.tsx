/**
 * StitchKDSNew — Error state component
 *
 * Displayed when ticket fetching fails. Shows error message with retry button.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="mb-4 h-16 w-16 text-[var(--aura-error)]" aria-hidden="true" />
      <h3
        className="mb-2 text-[32px] leading-[1.2] font-bold text-[#d4e4fa]"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {t('common.error', 'Error')}
      </h3>
      <p className="mb-6 max-w-md text-[16px] leading-[1.5] text-[var(--aura-chrome-soft)]">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-lg bg-[var(--aura-chrome-bright)] px-5 py-2.5 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-noir-deep)] transition-all hover:opacity-90"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          aria-label={t('common.retry', 'Retry')}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.retry', 'Retry')}
        </button>
      )}
    </div>
  );
}
