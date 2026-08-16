import { Wallet, Banknote, Smartphone } from 'lucide-react';
import type { PaymentOption } from './StitchCheckoutNew-types';

export const formatPrice = (amount: number, localeStr: string): string => {
  const isVietnamese = localeStr === 'vi' || localeStr.startsWith('vi');
  return new Intl.NumberFormat(isVietnamese ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: isVietnamese ? 'VND' : 'USD',
    minimumFractionDigits: isVietnamese ? 0 : 2,
  }).format(amount);
};

export const glassPanelBg =
  'bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px]';

export const inputClasses =
  'bg-[var(--aura-surface-container)] border-b border-[color-mix(in_srgb,var(--aura-chrome-dim)_30%,transparent)] focus:border-[var(--aura-chrome-bright)] px-4 py-3 text-[#e5e2e1] transition-all rounded-t-sm placeholder:text-[color-mix(in_srgb,var(--aura-chrome-soft)_50%,transparent)]';

export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    value: 'payos',
    label: 'PayOS',
    descriptionKey: 'stitch.payosDesc',
    icon: Wallet,
  },
  {
    value: 'cod',
    label: 'Cash on Delivery',
    descriptionKey: 'stitch.codDesc',
    icon: Banknote,
  },
  {
    value: 'apple_pay',
    label: 'Apple Pay',
    descriptionKey: 'stitch.applePayDesc',
    icon: Smartphone,
  },
  {
    value: 'google_pay',
    label: 'Google Pay',
    descriptionKey: 'stitch.googlePayDesc',
    icon: Smartphone,
  },
];
