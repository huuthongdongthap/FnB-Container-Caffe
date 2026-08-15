import type { CartItem } from './premium-checkout-types';
import { TAX_RATE } from './premium-checkout-constants';

export function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function subtotal(items: readonly CartItem[]): number {
  return items.reduce((s, i) => s + i.price, 0);
}

export function tax(amount: number): number {
  return Math.round(amount * TAX_RATE * 100) / 100;
}
