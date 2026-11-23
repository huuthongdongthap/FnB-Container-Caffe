import type { Ticket, TicketStatus } from '@/components/stitch/StitchKDSNew';

/* ─── Constants ────────────────────────────────────────────────── */

export const OVERDUE_THRESHOLD_MIN = 15;

/* ─── Helpers ──────────────────────────────────────────────────── */

export function calcElapsedSeconds(createdAt: string): number {
  const trimmed = createdAt.trim();
  if (!trimmed) return 0;
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  const created = Date.parse(iso);
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 1000));
}

/* ─── Re-exported types for backward compatibility ─────────────── */

export type { Ticket, TicketStatus };
