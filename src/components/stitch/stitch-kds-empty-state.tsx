/**
 * StitchKDSNew — Empty state component
 *
 * Displayed when no tickets match the current filter or no tickets exist.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { CheckCircle2, RefreshCw } from 'lucide-react';

export function EmptyState({ onRefresh }: { onRefresh?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <CheckCircle2 className="mb-4 h-16 w-16 text-[var(--aura-chrome-soft)] opacity-30" aria-hidden="true" />
      <h3
        className="mb-2 text-[32px] leading-[1.2] font-bold text-[#d4e4fa]"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {t('kds.allClear', 'All Clear!')}
      </h3>
      <p className="mb-6 max-w-xs text-[16px] leading-[1.5] text-[var(--aura-chrome-soft)]">
        {t('kds.emptyDescription', 'No tickets to display. New orders will appear here.')}
      </p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg bg-[#273647] px-4 py-2 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[#d4e4fa] transition-colors hover:bg-[#39475e]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          aria-label={t('common.refresh', 'Refresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.refresh', 'Refresh')}
        </button>
      )}
    </div>
  );
}
