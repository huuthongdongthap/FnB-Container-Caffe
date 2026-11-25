/**
 * StitchKDSNew — Utility functions for KDS timer formatting and SLA priority sorting
 */

import type { Ticket } from './stitch-kds-types';

/** Format seconds into mm:ss (<1h), HH:MM:SS (1h-24h), or localized Xd Yh / Xng Yg (>=24h). */
export function formatTime(seconds: number, lang?: string): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (safe >= 86_400) {
    const days = Math.floor(safe / 86_400);
    const hours = Math.floor((safe % 86_400) / 3_600);
    const isVi = (lang ?? '').toLowerCase().startsWith('vi');
    return isVi ? `${days}ng ${hours}g` : `${days}d ${hours}h`;
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

/**
 * Priority rank for KDS ticket ordering:
 * 0: overdue + pending/confirmed (nobody started yet — highest urgency)
 * 1: overdue + preparing (in progress past SLA)
 * 2: isWarning (10–15m approaching SLA breach)
 * 3: normal active (pending/confirmed/preparing <10m, strictly FIFO by created_at)
 * 4: ready (FIFO by readyWaitSeconds / ready_at oldest waiting pickup first)
 * 5: stale (>24h previous shift zombie tickets)
 */
export function getTicketPriorityRank(ticket: Ticket): number {
  if (ticket.isStale) return 5;
  const opStatus = ticket.rawStatus ?? (ticket.status === 'overdue' ? 'pending' : ticket.status);
  if (opStatus === 'ready') return 4;
  if (ticket.isOverdue || ticket.status === 'overdue') {
    return opStatus === 'preparing' ? 1 : 0;
  }
  if (ticket.isWarning) return 2;
  return 3;
}

/** Sort KDS tickets by SLA urgency, then FIFO (oldest created_at / oldest ready_at first). */
export function sortKdsTickets(tickets: readonly Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const rankA = getTicketPriorityRank(a);
    const rankB = getTicketPriorityRank(b);
    if (rankA !== rankB) return rankA - rankB;
    if (rankA === 4) {
      const waitA = a.readyWaitSeconds ?? a.elapsedSeconds;
      const waitB = b.readyWaitSeconds ?? b.elapsedSeconds;
      return waitB - waitA;
    }
    return b.elapsedSeconds - a.elapsedSeconds;
  });
}
