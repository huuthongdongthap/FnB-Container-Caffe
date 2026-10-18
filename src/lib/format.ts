import i18n from './i18n';

export function formatCurrency(amount: number | null | undefined): string {
  const numeric = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function formatDate(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return typeof date === 'string' ? date : '—';
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  return new Intl.DateTimeFormat(locale, options).format(parsed);
}

export function formatPoints(points: number | null | undefined): string {
  const numeric = typeof points === 'number' && !Number.isNaN(points) ? points : 0;
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  return numeric.toLocaleString(locale);
}

// Backward-compatible alias
export const formatVnd = formatCurrency;
