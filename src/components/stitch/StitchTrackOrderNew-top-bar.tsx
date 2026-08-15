/**
 * TopBar — sticky top app bar with back button
 */

import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

interface TopBarProps {
  onBack?: () => void;
}

export function TopBar({ onBack }: TopBarProps) {
  const { t } = useTranslation();

  return (
    <header className="w-full top-0 sticky bg-[var(--aura-surface-dim)] dark:bg-[var(--aura-surface-dim)] border-b border-[var(--aura-chrome-soft)]/10 z-50 h-16 flex items-center px-5">
      <div className="flex items-center w-full">
        <button
          onClick={onBack}
          className="mr-4 text-[var(--aura-bronze-shimmer)] hover:opacity-80 transition-opacity"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-['Space_Grotesk'] text-[20px] font-bold leading-tight uppercase tracking-tight text-[var(--aura-bronze-shimmer)]">
          {t('trackOrder.title', 'ORDER STATUS')}
        </h1>
      </div>
    </header>
  );
}
