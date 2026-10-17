import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

const STATUS_BADGE_KEYS: Record<OrderStatus, string> = {
  pending: 'tracking.badgePending',
  confirmed: 'tracking.badgeConfirmed',
  preparing: 'tracking.badgePreparing',
  ready: 'tracking.badgeReady',
  delivering: 'tracking.badgeDelivering',
  delivered: 'tracking.badgeDelivered',
  cancelled: 'tracking.badgeCancelled',
};

const STATUS_VARIANTS: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  confirmed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  preparing: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  ready: 'bg-green-500/15 text-green-300 border-green-500/30',
  delivering: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  delivered: 'bg-green-500/15 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const badgeKey = STATUS_BADGE_KEYS[status];
  const label = badgeKey ? t(badgeKey) : t('tracking.badgeUnknown');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border',
        STATUS_VARIANTS[status] || 'bg-surface text-foreground border-border',
        className
      )}
    >
      {label}
    </span>
  );
}
