/**
 * StitchOrderMgmtNew Status Badge & Action Button
 * Status badge with color coding and reusable action button.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { OrderStatus } from './StitchOrderMgmtNew-types';
import { STATUS_BADGE_CONFIG } from './stitch-order-mgmt-default';

/* ─── Status Badge ───────────────────────────────────────────────────── */

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  const c = STATUS_BADGE_CONFIG[status];

  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.1em] border',
        c.bg,
        c.text,
        c.border,
      )}
      aria-label={t(c.tKey)}
    >
      {t(c.tKey)}
    </span>
  );
}

/* ─── Order Action Button ────────────────────────────────────────────── */

interface OrderActionButtonProps {
  label: string;
  disabled?: boolean;
  primary?: boolean;
  onClick?: () => void;
}

export function OrderActionButton({
  label,
  disabled,
  primary,
  onClick,
}: Readonly<OrderActionButtonProps>) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'font-sans text-[12px] font-bold uppercase tracking-[0.1em] py-3 transition-all rounded-lg',
        disabled &&
          'cursor-not-allowed bg-[#343536] text-[var(--aura-text-secondary, #a0a8b0)]/50',
        !disabled && primary
          ? 'bg-[var(--aura-primary, #c6c6c7)] text-[#0c1c30] hover:brightness-110 active:scale-[0.97]'
          : '',
        !disabled &&
          !primary &&
          'border border-white/10 bg-white/5 text-[var(--aura-text-primary, #e8e8e8)] hover:bg-white/10 active:scale-[0.97]',
      )}
      aria-label={label}
    >
      {label}
    </button>
  );
}
