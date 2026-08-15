/**
 * OrderHero — reference card with order ID and ETA
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { GLASS_CARD_CLASSES } from './StitchTrackOrderNew-constants';

interface OrderHeroProps {
  orderId: string;
  estimatedMinutes: number;
}

export function OrderHero({ orderId, estimatedMinutes }: OrderHeroProps) {
  const { t } = useTranslation();

  return (
    <section className={cn(GLASS_CARD_CLASSES, 'rounded-xl p-8 relative overflow-hidden')}>
      <div className="relative z-10 space-y-2">
        <p className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] uppercase text-[var(--aura-chrome-soft)]">
          {t('trackOrder.orderRef', 'Order Reference')}
        </p>
        <h2 className="font-['EB_Garamond'] text-[32px] font-semibold leading-tight tracking-tight text-[var(--aura-bronze-shimmer)]">
          {orderId}
        </h2>

        <div className="pt-6 flex items-baseline gap-2">
          <span className="font-['EB_Garamond'] text-[48px] font-bold leading-none tracking-tight text-[var(--aura-bronze-shimmer)]">
            {estimatedMinutes}
          </span>
          <span className="font-['Space_Grotesk'] text-[20px] font-bold leading-tight text-[var(--aura-bronze-shimmer)]">
            {t('trackOrder.mins', 'MINS')}
          </span>
        </div>
        <p className="font-['Space_Grotesk'] text-[16px] leading-relaxed text-[var(--aura-chrome-bright)]">
          {t('trackOrder.eta', 'Estimated Arrival Time')}
        </p>
      </div>
    </section>
  );
}
