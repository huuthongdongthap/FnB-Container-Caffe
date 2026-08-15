/**
 * Error state component for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

/* ─── Error State ─────────────────────────────────────────────── */

export function AccountNewError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <RefreshCw className="w-7 h-7 text-[#d4a574]" />
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ fontFamily: "var(--aura-font-display)" }}
        >
          {t('stitch.accountDashboard.failedToLoad')}
        </h2>
        <p className="text-sm mb-6 text-[var(--aura-text-secondary, #a0a8b0)]">
          {t('stitch.accountDashboard.errorDescription')}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-3 rounded-xl font-semibold text-sm tracking-wider uppercase transition-all active:scale-95 min-h-[48px]"
            style={{
              background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
              color: '#1a1a2e',
            }}
            aria-label={t('stitch.accountDashboard.retry')}
          >
            {t('stitch.accountDashboard.retry')}
          </button>
        )}
      </div>
    </div>
  );
}
