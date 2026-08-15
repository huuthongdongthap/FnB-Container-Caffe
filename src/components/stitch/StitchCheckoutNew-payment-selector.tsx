import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { glassPanelBg, PAYMENT_OPTIONS } from './StitchCheckoutNew-utils';
import type { PaymentMethod } from './StitchCheckoutNew-types';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({
  selected,
  onSelect,
}: Readonly<PaymentMethodSelectorProps>) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[#c6c6c7] mb-6 flex items-center gap-3">
        <span className="w-8 h-8 inline-flex items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        </span>
        {t('stitch.paymentMethod', 'Payment Method')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PAYMENT_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          const isPayos = option.value === 'payos';
          const IconComp = option.icon;

          return (
            <label key={option.value} className="relative cursor-pointer group">
              <input
                type="radio"
                name="payment"
                value={option.value}
                checked={isSelected}
                onChange={() => onSelect(option.value)}
                className="sr-only peer"
              />
              <div
                className={cn(
                  glassPanelBg,
                  'p-6 rounded-xl flex items-center justify-between border border-[rgba(198,198,199,0.1)] transition-all',
                  isSelected && isPayos && 'border-[var(--aura-chrome-bright)] bg-[color-mix(in_srgb,var(--aura-chrome-bright)_5%,transparent)] shadow-[0_0_15px_rgba(212,165,116,0.2)]',
                  isSelected && !isPayos && 'border-[#c6c6c7] bg-[rgba(198,198,199,0.05)]',
                  isPayos && !isSelected && 'shadow-[0_0_15px_rgba(212,165,116,0.2)]',
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      isPayos
                        ? 'bg-[color-mix(in_srgb,var(--aura-chrome-bright)_20%,transparent)] text-[var(--aura-chrome-bright)]'
                        : 'bg-[rgba(198,198,199,0.2)] text-[#c6c6c7]',
                    )}
                  >
                    <IconComp className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] uppercase text-[#e5e2e1]">
                      {option.label}
                    </div>
                    <div className="text-xs text-[var(--aura-chrome-soft)]">
                      {t(option.descriptionKey)}
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? isPayos
                        ? 'border-[var(--aura-chrome-bright)]'
                        : 'border-[#c6c6c7]'
                      : 'border-[var(--aura-chrome-dim)] group-hover:border-[var(--aura-chrome-bright)]',
                  )}
                >
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full transition-opacity',
                      isPayos ? 'bg-[var(--aura-chrome-bright)]' : 'bg-[#c6c6c7]',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
