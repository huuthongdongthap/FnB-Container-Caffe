/**
 * OrderSummary — list of order items with total
 */

import { useTranslation } from 'react-i18next';
import { Coffee, Receipt } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GLASS_CARD_CLASSES } from './StitchTrackOrderNew-constants';
import type { TrackOrderItem } from './StitchTrackOrderNew-types';

interface OrderSummaryProps {
  items: TrackOrderItem[];
  total: number;
}

export function OrderSummary({ items, total }: OrderSummaryProps) {
  const { t } = useTranslation();

  return (
    <section className={cn(GLASS_CARD_CLASSES, 'rounded-xl p-6')}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] uppercase text-[var(--aura-chrome-soft)]">
          {t('trackOrder.summary', 'Order Summary')}
        </h4>
        <Receipt className="w-5 h-5 text-[var(--aura-chrome-soft)]" />
      </div>

      <ul className="space-y-4">
        {items.map((item) => {
          const ItemIcon = item.icon || Coffee;
          return (
            <li
              key={item.id}
              className="flex justify-between items-center py-3 border-b border-[var(--aura-chrome-bright)]/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--aura-surface-dim)]/60 border border-[var(--aura-chrome-bright)]/10 flex items-center justify-center">
                  <ItemIcon className="w-5 h-5 text-[var(--aura-bronze-shimmer)]" />
                </div>
                <div>
                  <p className="font-['Space_Grotesk'] text-[16px] leading-relaxed text-[var(--aura-chrome-bright)]">
                    {item.name}
                  </p>
                  <p className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] text-[var(--aura-chrome-soft)]">
                    {t('trackOrder.qty', 'Qty')}: {item.quantity}
                  </p>
                </div>
              </div>
              <span className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] text-[var(--aura-chrome-bright)]">
                ${item.price.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-between items-center">
        <span className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] uppercase text-[var(--aura-chrome-soft)]">
          {t('trackOrder.total', 'TOTAL')}
        </span>
        <span className="font-['Space_Grotesk'] text-[20px] font-bold leading-tight text-[var(--aura-bronze-shimmer)]">
          ${total.toFixed(2)}
        </span>
      </div>
    </section>
  );
}
