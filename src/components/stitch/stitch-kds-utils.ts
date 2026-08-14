/**
 * StitchKDSNew — Utility functions and status badge configuration
 *
 * Format helpers and visual config for ticket status badges.
 */

import type { TicketStatus, StatusBadgeConfig } from './stitch-kds-types';

/** Format seconds into mm:ss display string */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Status badge visual configuration.
 * Matches original HTML status badges:
 *  PREPARING: bg-[#64421a] text-[#dfaf7e] with pulse dot
 *  PENDING:   bg-[#273647] text-[var(--aura-chrome-soft)]
 *  READY:     bg-[#001a38] text-[#6984ad]
 *  OVERDUE:   bg-[var(--aura-surface-dim)] text-[var(--aura-error)]
 */
export const STATUS_BADGE_CONFIG: Record<TicketStatus, StatusBadgeConfig> = {
  preparing: {
    tKey: 'kds.preparing',
    bg: 'bg-[#64421a]',
    text: 'text-[#dfaf7e]',
    pulse: true,
  },
  pending: {
    tKey: 'kds.pending',
    bg: 'bg-[#273647]',
    text: 'text-[var(--aura-chrome-soft)]',
  },
  ready: {
    tKey: 'kds.ready',
    bg: 'bg-[#001a38]',
    text: 'text-[#6984ad]',
  },
  overdue: {
    tKey: 'kds.overdue',
    bg: 'bg-[var(--aura-surface-dim)]',
    text: 'text-[var(--aura-error)]',
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
