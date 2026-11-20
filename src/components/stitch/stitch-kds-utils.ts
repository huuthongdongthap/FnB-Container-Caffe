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
