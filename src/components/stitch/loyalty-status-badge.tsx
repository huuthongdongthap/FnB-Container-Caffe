import { useTranslation } from 'react-i18next';
import type { LoyaltyHistoryEntry } from './stitch-loyalty-types';

const statusConfig: Record<
  LoyaltyHistoryEntry['status'],
  { translationKey: string; classes: string }
> = {
  completed: {
    translationKey: 'loyalty.completed',
    classes: 'border-[var(--aura-chrome-bright)]/40 text-[var(--aura-chrome-bright)]',
  },
  pending: {
    translationKey: 'loyalty.pending',
    classes: 'border-[var(--aura-chrome-soft)]/30 text-[var(--aura-chrome-soft)]',
  },
  expired: {
    translationKey: 'loyalty.expired',
    classes: 'border-[var(--aura-error)]/40 text-[var(--aura-error)]',
  },
};

export function StatusBadge({ status }: { status: LoyaltyHistoryEntry['status'] }) {
  const { t } = useTranslation();
  const c = statusConfig[status];

  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold leading-normal ${c?.classes ?? ''}`}
    >
      {c ? t(c.translationKey) : status}
    </span>
  );
}
