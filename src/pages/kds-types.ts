import type { Ticket, TicketStatus } from '@/components/stitch/StitchKDSNew';

/* ─── Constants ────────────────────────────────────────────────── */

export const OVERDUE_THRESHOLD_MIN = 15;
export const WARNING_THRESHOLD_MIN = Math.floor(OVERDUE_THRESHOLD_MIN * 0.7);
export const MAX_METRIC_AGE_SECONDS = 24 * 60 * 60;

/* ─── Helpers ──────────────────────────────────────────────────── */

export function parseKdsTimestampMs(raw: string | undefined | null): number {
  if (!raw) return NaN;
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  return Date.parse(iso);
}

export function calcElapsedSeconds(createdAt: string): number {
  const created = parseKdsTimestampMs(createdAt);
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 1000));
}

export function calcDurationSeconds(
  startIso: string | undefined | null,
  endIso: string | undefined | null,
): number | null {
  const start = parseKdsTimestampMs(startIso);
  const end = parseKdsTimestampMs(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/* ─── Re-exported types for backward compatibility ─────────────── */

export type { Ticket, TicketStatus };
