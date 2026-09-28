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

function formatAmount(val: number): string {
  if (val >= 1000) {
    return new Intl.NumberFormat('vi-VN').format(val) + '₫';
  }
  return `$${val.toFixed(2)}`;
}

export function OrderSummary({ items, total }: OrderSummaryProps) {
  const { t } = useTranslation();

  return (
    <section className={cn(GLASS_CARD_CLASSES, 'rounded-xl p-6')}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display text-[15px] font-bold tracking-[0.05em] uppercase text-white">
          {t('trackOrder.summary', 'Chi Tiết Đơn Hàng')}
        </h4>
        <Receipt className="w-5 h-5 text-[var(--aura-chrome-mid)]" />
      </div>

      <ul className="space-y-4">
        {items.map((item) => {
          const ItemIcon = item.icon || Coffee;
          return (
            <li
              key={item.id}
              className="flex justify-between items-center py-3 border-b border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--aura-surface-dim)]/80 border border-white/10 flex items-center justify-center">
                  <ItemIcon className="w-5 h-5 text-[var(--aura-chrome-mid)]" />
                </div>
                <div>
                  <p className="font-body text-[15px] font-medium leading-relaxed text-white">
                    {item.name}
                  </p>
                  <p className="font-body text-[12px] font-medium tracking-[0.08em] text-[var(--aura-chrome-soft)]">
                    {t('trackOrder.qty', 'Số lượng')}: {item.quantity}
                  </p>
                </div>
              </div>
              <span className="font-body text-[14px] font-semibold text-[var(--aura-chrome-bright)]">
                {formatAmount(item.price)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-between items-center pt-2">
        <span className="font-body text-[14px] font-bold tracking-wider uppercase text-[var(--aura-chrome-soft)]">
          {t('trackOrder.total', 'TỔNG CỘNG')}
        </span>
        <span className="font-display text-[22px] font-bold text-[var(--aura-chrome-bright)]">
          {formatAmount(total)}
        </span>
      </div>
    </section>
  );
}
