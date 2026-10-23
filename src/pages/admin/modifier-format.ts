/**
 * Formatting helpers for modifier price deltas.
 *
 * Deltas are integer VND and may be zero, positive, or negative, so the sign is
 * shown explicitly — "+5.000₫" reads as a surcharge while "0₫" reads as a free
 * choice, which is the distinction staff actually care about when pricing.
 */

const viFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatVndDelta(delta: number): string {
  const value = Number(delta) || 0;
  if (value === 0) return `0${'₫'}`;
  const sign = value > 0 ? '+' : '−';
  return `${sign}${viFormatter.format(Math.abs(value))}₫`;
}
