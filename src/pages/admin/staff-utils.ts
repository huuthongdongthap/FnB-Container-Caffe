export {
  CASH_ASSIGN_ROLES,
  CASH_DRAWER_ROLES,
  NON_CASH_SHIFT_ROLES,
  PAYOUT_ROLES,
  RECONCILIATION_ROLES,
} from '../../../packages/domain/shift/model/shift-types';

export function normalizeUtcTimestamp(iso: string): string {
  const trimmed = iso.trim();
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
}

export function deriveShiftSlotLabel(
  timestamp?: string | null,
  explicitShift?: string | null,
  startTime?: string | null,
): string {
  const normalized = String(explicitShift || '').trim().toLowerCase();
  if (normalized === 'morning' || normalized === 'ca_1' || normalized === 'ca1') return 'Ca sáng (06:00–14:00)';
  if (normalized === 'afternoon' || normalized === 'ca_2' || normalized === 'ca2') return 'Ca chiều (14:00–22:00)';
  if (normalized === 'night' || normalized === 'evening' || normalized === 'ca_3' || normalized === 'ca3') return 'Ca đêm (22:00–06:00)';
  if (typeof startTime === 'string') {
    const startMatch = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(startTime.trim());
    if (startMatch) {
      const startHour = Number.parseInt(startMatch[1] ?? '0', 10);
      if (startHour >= 6 && startHour < 14) return 'Ca sáng (06:00–14:00)';
      if (startHour >= 14 && startHour < 22) return 'Ca chiều (14:00–22:00)';
      return 'Ca đêm (22:00–06:00)';
    }
  }
  let date = new Date();
  if (timestamp && typeof timestamp === 'string') {
    const parsed = new Date(normalizeUtcTimestamp(timestamp));
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    hour12: false,
  }).format(date);
  const hour = Number.parseInt(hourStr, 10);
  if (hour >= 6 && hour < 14) return 'Ca sáng (06:00–14:00)';
  if (hour >= 14 && hour < 22) return 'Ca chiều (14:00–22:00)';
  return 'Ca đêm (22:00–06:00)';
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(iso.trim())) return iso.trim();
  const d = new Date(normalizeUtcTimestamp(iso));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(normalizeUtcTimestamp(iso));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '--';
  return hours.toFixed(1) + 'h';
}
