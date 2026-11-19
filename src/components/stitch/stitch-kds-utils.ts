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
 *  PREPARING: bg-[var(--aura-chrome-mid)] text-[var(--aura-chrome-light)] with pulse dot
 *  PENDING:   bg-[var(--st-surface-container-highest)] text-[var(--aura-chrome-soft)]
 *  READY:     bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-mid)]
 *  OVERDUE:   bg-[var(--aura-surface-dim)] text-[var(--aura-error)]
 */
export const STATUS_BADGE_CONFIG: Record<TicketStatus, StatusBadgeConfig> = {
  preparing: {
    tKey: 'kds.preparing',
    bg: 'bg-[#efbd8a]/20 border border-[#efbd8a]/40',
    text: 'text-[#f8d7b2]',
    pulse: true,
  },
  pending: {
    tKey: 'kds.pending',
    bg: 'bg-[#1d2c3f] border border-[#b8c7e2]/20',
    text: 'text-[#d4e4fa]',
  },
  ready: {
    tKey: 'kds.ready',
    bg: 'bg-emerald-500/15 border border-emerald-400/35',
    text: 'text-emerald-300',
  },
  overdue: {
    tKey: 'kds.overdue',
    bg: 'bg-red-500/20 border border-red-400/40',
    text: 'text-red-200',
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
