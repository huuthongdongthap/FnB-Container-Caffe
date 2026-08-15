import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { glassPanelBg, formatPrice } from './StitchCheckoutNew-utils';
import type { CheckoutNewSummary } from './StitchCheckoutNew-types';

interface OrderSummaryPanelProps {
  summary: CheckoutNewSummary;
  locale: string;
}

export function OrderSummaryPanel({
  summary,
  locale,
}: Readonly<OrderSummaryPanelProps>) {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-5">
      <div
        className={cn(
          glassPanelBg,
          'rounded-xl p-8 sticky top-28 border border-[rgba(198,198,199,0.2)] shadow-2xl',
        )}
      >
        <h3 className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[var(--aura-noir-void)] mb-8 border-b border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)] pb-4">
          {t('stitch.orderSummary', 'Order Summary')}
        </h3>

        <div className="space-y-6 mb-10 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
          {summary.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center group">
              <div className="flex gap-4">
                <div
                  className="w-16 h-16 shrink-0 rounded bg-cover bg-center"
                  style={{ backgroundImage: `url(${item.imageUrl})` }}
                  role="img"
                  aria-label={item.name}
                />
                <div className="flex flex-col justify-center">
                  <span className="font-['Space_Grotesk'] text-[18px] leading-[1.6] text-[#e5e2e1]">
                    {item.name}
                  </span>
                  <span className="text-xs text-[var(--aura-chrome-soft)] uppercase tracking-widest font-['Space_Grotesk']">
                    {item.variant}
                    {' • '}
                    {item.quantity}x
                  </span>
                </div>
              </div>
              <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] text-[#efbd8a] whitespace-nowrap">
                {formatPrice(item.price, locale)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-6 border-t border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)]">
          <div className="flex justify-between text-[var(--aura-chrome-soft)]">
            <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
              {t('stitch.subtotal', 'Subtotal')}
            </span>
            <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
              {formatPrice(summary.subtotal, locale)}
            </span>
          </div>
          <div className="flex justify-between text-[var(--aura-chrome-soft)]">
            <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
              {summary.taxLabel ?? t('stitch.tax', 'Luxury Tax (5%)')}
            </span>
            <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
              {formatPrice(summary.tax, locale)}
            </span>
          </div>
          <div className="flex justify-between text-[var(--aura-chrome-soft)]">
            <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
              {summary.deliveryLabel ?? t('stitch.deliveryFee', 'Delivery Fee')}
            </span>
            <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
              {summary.deliveryFee === 0
                ? '$0.00'
                : formatPrice(summary.deliveryFee, locale)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
