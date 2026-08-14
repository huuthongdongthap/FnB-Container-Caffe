/**
 * useStitchOrderSuccess — Hook for order success screen effects
 *
 * Provides the subtle status badge flash interval and a
 * memoised price formatter bound to the current locale/currency.
 */

import { useEffect } from 'react';
import { formatPrice } from './stitch-order-success-default';

/* ─── Status badge flash effect ──────────────────────────────────────────── */

export function useStitchOrderSuccess(): void {
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        const status = document.querySelector(
          '.text-\\[10px\\].font-bold.uppercase.tracking-widest.text-\\[var\\(--aura-chrome-bright\\)\\]',
        );
        if (status) {
          (status as HTMLElement).style.opacity = '0';
          setTimeout(() => {
            (status as HTMLElement).style.opacity = '1';
          }, 300);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);
}

/* ─── Price format factory ───────────────────────────────────────────────── */

export function createPriceFormatter(
  locale: string,
  currency: 'VND' | 'USD',
) {
  return (amount: number) => formatPrice(amount, locale, currency);
}
