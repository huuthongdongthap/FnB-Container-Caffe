import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';
import type { LoyaltyHistoryEntry } from './stitch-loyalty-types';
import { PointsHistoryTable } from './loyalty-points-history';

export function PointsHistorySection({ history }: { history: LoyaltyHistoryEntry[] }) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl p-[24px] overflow-hidden"
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex justify-between items-center mb-[24px]">
        <h3
          className="text-[24px] leading-[1.4] font-normal"
          style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)' }}
        >
          {t('loyalty.pointsHistory')}
        </h3>
        <button
          type="button"
          className="cursor-pointer hover:text-[var(--aura-chrome-bright)] transition-colors"
          style={{ color: 'var(--aura-chrome-soft)' }}
          aria-label={t('loyalty.filterHistoryAria')}
        >
          <Filter className="h-5 w-5" />
        </button>
      </div>
      <PointsHistoryTable history={history} />
    </section>
  );
}
