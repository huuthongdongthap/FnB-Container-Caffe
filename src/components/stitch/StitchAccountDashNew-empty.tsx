/**
 * DashError — error state for StitchAccountDashNew
 */
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { BODY_FONT, DISPLAY_FONT } from './StitchAccountDashNew-constants';

export function DashError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[var(--aura-surface-dim)] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'rgba(30,41,59,0.4)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <RefreshCw className="w-7 h-7 text-[var(--aura-chrome-bright)]" />
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--aura-chrome-bright)', fontFamily: DISPLAY_FONT }}
        >
          {t('stitch.accountDashboard.failedToLoad', 'Failed to Load')}
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--aura-chrome-soft)', fontFamily: BODY_FONT }}>
          {t('stitch.accountDashboard.errorDescription', 'Something went wrong. Please try again.')}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-3 rounded-xl font-semibold text-sm tracking-wider uppercase transition-all active:scale-95 min-h-[48px] bg-gradient-to-br from-[#CD7F32] to-[#A0522D] text-[var(--aura-noir-deep)]"
            style={{ fontFamily: BODY_FONT }}
            aria-label={t('stitch.accountDashboard.retry', 'Retry')}
          >
            {t('stitch.accountDashboard.retry', 'Retry')}
          </button>
        )}
      </div>
    </div>
  );
}
