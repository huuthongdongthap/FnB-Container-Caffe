/**
 * StitchKDSNew — Status badge component
 *
 * Renders a status label with optional pulse indicator for each ticket status
 * category (preparing, pending, ready, overdue).
 */

'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { TicketStatus } from './stitch-kds-types';
import { STATUS_BADGE_CONFIG, STATUS_FALLBACK_TEXT } from './stitch-kds-utils';

export function StatusBadge({ status, count }: { status: TicketStatus; count: number }) {
  const { t } = useTranslation();
  const c = STATUS_BADGE_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded px-3 py-1',
        'text-[12px] leading-none tracking-[0.1em] font-bold uppercase',
        c.bg,
        c.text,
      )}
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      aria-label={`${t(c.tKey)}: ${count}`}
    >
      {c.pulse && <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />}
      {t(c.tKey, STATUS_FALLBACK_TEXT[status])} ({count})
    </span>
  );
}
