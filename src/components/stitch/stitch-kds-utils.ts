/**
 * StitchKDSNew — Utility functions and status badge configuration
 *
 * Format helpers and visual config for ticket status badges.
 */

import type { Ticket, TicketStatus, StatusBadgeConfig } from './stitch-kds-types';

/** Format seconds into mm:ss (<1h), HH:MM:SS (1h-24h), or Xd Yh (>=24h). */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (safe >= 86_400) {
    const days = Math.floor(safe / 86_400);
    const hours = Math.floor((safe % 86_400) / 3_600);
    return `${days}d ${hours}h`;
  }
  if (safe >= 3_600) {
    const h = Math.floor(safe / 3_600);
    const m = Math.floor((safe % 3_600) / 60);
    const s = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Priority rank for KDS ticket ordering: overdue -> preparing -> pending -> ready. */
function getTicketPriorityRank(ticket: Ticket): number {
  const opStatus = ticket.rawStatus ?? ticket.status;
  if (opStatus === 'ready') return 3;
  if (ticket.isOverdue || ticket.status === 'overdue') return 0;
  if (opStatus === 'preparing') return 1;
  return 2;
}

/** Sort KDS tickets by operational urgency, then FIFO (longest elapsed first). */
export function sortKdsTickets(tickets: readonly Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const rankDiff = getTicketPriorityRank(a) - getTicketPriorityRank(b);
    if (rankDiff !== 0) return rankDiff;
    return b.elapsedSeconds - a.elapsedSeconds;
  });
}

/** Status badge visual configuration. */
export const STATUS_BADGE_CONFIG: Record<TicketStatus, StatusBadgeConfig> = {
  preparing: {
    tKey: 'kds.preparing',
    bg: 'bg-[var(--md-sys-color-primary-container)] border border-[var(--aura-border-chrome)]',
    text: 'text-[var(--md-sys-color-on-primary-container)]',
    pulse: true,
  },
  pending: {
    tKey: 'kds.pending',
    bg: 'bg-[var(--st-surface-container-highest)] border border-[var(--aura-chrome-dim)]',
    text: 'text-[var(--aura-chrome-bright)]',
  },
  ready: {
    tKey: 'kds.ready',
    bg: 'bg-[var(--aura-noir-deep)] border border-[var(--aura-success)]/40',
    text: 'text-[var(--aura-success)]',
  },
  overdue: {
    tKey: 'kds.overdue',
    bg: 'bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)]',
    text: 'text-[var(--md-sys-color-on-error-container)]',
    pulse: true,
  },
};

/** Fallback text for each status badge label */
export const STATUS_FALLBACK_TEXT: Record<TicketStatus, string> = {
  preparing: 'PREPARING',
  pending: 'PENDING',
  ready: 'READY',
  overdue: 'OVERDUE',
};
