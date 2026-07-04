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
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  preparing: 'bg-purple-100 text-purple-800 border-purple-300',
  ready: 'bg-green-100 text-green-800 border-green-300',
  delivering: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  delivered: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const badgeKey = STATUS_BADGE_KEYS[status];
  const label = badgeKey ? t(badgeKey) : t('tracking.badgeUnknown');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border',
        STATUS_VARIANTS[status] || 'bg-gray-100 text-gray-800',
        className
      )}
    >
      {label}
    </span>
  );
}
