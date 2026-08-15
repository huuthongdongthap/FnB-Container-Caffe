import type { Ticket, TicketStatus } from '@/components/stitch/StitchKDSNew';

/* ─── Constants ────────────────────────────────────────────────── */

export const OVERDUE_THRESHOLD_MIN = 15;

/* ─── Helpers ──────────────────────────────────────────────────── */

export function calcElapsedSeconds(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  return Math.floor((Date.now() - created) / 1000);
}

/* ─── Re-exported types for backward compatibility ─────────────── */

export type { Ticket, TicketStatus };
