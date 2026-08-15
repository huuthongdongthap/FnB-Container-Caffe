/**
 * Order status badge component for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Clock } from 'lucide-react';
import type { OrderItemStatus } from './StitchAccountNew-types';

/* ─── Status Badge ────────────────────────────────────────────── */

export function OrderNewStatusBadge({ status }: { status: OrderItemStatus }) {
  const { t } = useTranslation();
  const config = {
    preparing: {
      label: t('stitch.accountDashboard.statusPreparing'),
      class:
        'bg-[rgba(212,165,116,0.1)] text-[#d4a574] border-[rgba(212,165,116,0.2)]',
    },
    delivered: {
      label: t('stitch.accountDashboard.statusDelivered'),
      class:
        'bg-[rgba(198,198,199,0.08)] text-[var(--aura-primary, #c6c6c7)] border-[rgba(198,198,199,0.15)]',
    },
  };
  const c = config[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase border whitespace-nowrap',
        c.class,
      )}
    >
      {status === 'preparing' && <Clock className="w-3 h-3" />}
      {c.label}
    </span>
  );
}
