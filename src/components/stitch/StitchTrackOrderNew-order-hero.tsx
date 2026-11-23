/**
 * OrderHero — reference card with order ID and ETA
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { GLASS_CARD_CLASSES } from './StitchTrackOrderNew-constants';

interface OrderHeroProps {
  orderId: string;
  estimatedMinutes?: number | null;
  status?: string;
}

const HIDE_ETA_STATUSES = new Set([
  'ready',
  'served',
  'delivered',
  'completed',
  'cancelled',
  'failed',
  'expired',
]);

export function OrderHero({ orderId, estimatedMinutes, status }: OrderHeroProps) {
  const { t } = useTranslation();
  const normalizedStatus = status?.trim().toLowerCase() ?? '';
  const showEta =
    typeof estimatedMinutes === 'number' &&
    estimatedMinutes > 0 &&
    !HIDE_ETA_STATUSES.has(normalizedStatus);

  return (
    <section className={cn(GLASS_CARD_CLASSES, 'rounded-xl p-8 relative overflow-hidden')}>
      <div className="relative z-10 space-y-2">
        <p className="font-body text-[12px] font-medium tracking-[0.08em] uppercase text-[var(--aura-chrome-soft)]">
          {t('trackOrder.orderRef', 'Mã đơn hàng')}
        </p>
        <h2 className="font-display text-[32px] font-semibold leading-tight tracking-tight text-[var(--aura-bronze-shimmer)]">
          {orderId}
        </h2>

        {showEta && (
          <>
            <div className="pt-6 flex items-baseline gap-2">
              <span className="font-display text-[48px] font-bold leading-none tracking-tight text-[var(--aura-bronze-shimmer)]">
                {estimatedMinutes}
              </span>
              <span className="font-body text-[20px] font-bold leading-tight text-[var(--aura-bronze-shimmer)]">
                {t('trackOrder.mins', 'PHÚT')}
              </span>
            </div>
            <p className="font-body text-[16px] leading-relaxed text-[var(--aura-chrome-bright)]">
              {t('trackOrder.eta', 'Thời gian dự kiến')}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
