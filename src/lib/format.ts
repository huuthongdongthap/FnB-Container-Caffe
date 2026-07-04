import i18n from './i18n';

export function formatCurrency(amount: number): string {
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  const currency = locale === 'vi-VN' ? 'VND' : 'USD';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

export function formatPoints(points: number): string {
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  return points.toLocaleString(locale);
}

// Backward-compatible alias
export const formatVnd = formatCurrency;
