import { DollarSign, Landmark, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  'dollar-sign': DollarSign,
  landmark: Landmark,
  wallet: Wallet,
};
import type { PaymentMethod } from '@/lib/validators';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

const PAYMENT_OPTIONS: Array<{
  value: PaymentMethod;
  labelKey: string;
  descKey: string;
  icon: string;
}> = [
  {
    value: 'cod',
    labelKey: 'order.cod',
    descKey: 'order.codDesc',
    icon: 'dollar-sign',
  },
  {
    value: 'payos',
    labelKey: 'order.payos',
    descKey: 'order.payosDesc',
    icon: 'landmark',
  },
];

export function PaymentMethodSelector({
  selected,
  onChange,
  disabled,
}: PaymentMethodSelectorProps) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="font-display text-lg font-semibold text-foreground">
        {t('order.paymentMethod')}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('order.paymentMethod')}>
        {PAYMENT_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isSelected
                  ? 'border-accent-warm bg-accent-warm/5 shadow-md'
                  : 'border-border/30 bg-background/50 hover:border-border/60 hover:bg-background/80',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="text-2xl" aria-hidden="true">{option.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-foreground">{t(option.labelKey)}</div>
                <div className="mt-0.5 text-xs text-muted">{t(option.descKey)}</div>
              </div>
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected
                    ? 'border-accent-warm bg-accent-warm text-white'
                    : 'border-border',
                )}
                aria-hidden="true"
              >
                {isSelected && (
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M10.28 2.22a.75.75 0 010 1.06l-6 6a.75.75 0 01-1.06 0l-3-3a.75.75 0 011.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 011.06 0z" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
