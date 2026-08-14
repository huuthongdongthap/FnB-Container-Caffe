/**
 * StitchOrderMgmtNew Order Card
 * Individual order card with status bar, items list, and action buttons.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Clock, UtensilsCrossed, Ban } from 'lucide-react';
import type { OrderData } from './StitchOrderMgmtNew-types';
import { GLASS_CLASSES, STATUS_BAR_CLASSES, getActionForStatus } from './stitch-order-mgmt-default';
import { StatusBadge, OrderActionButton } from './StitchOrderMgmtNew-status-badge';

/* ─── Order Card ─────────────────────────────────────────────────────── */

interface OrderCardProps {
  order: OrderData;
  onAction?: () => void;
}

export function OrderCard({ order, onAction }: Readonly<OrderCardProps>) {
  const { t } = useTranslation();

  const isCancelled = order.status === 'cancelled';
  const isServed = order.status === 'served';
  const actionLabel = getActionForStatus(order.status);

  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <div
      className={cn(
        GLASS_CLASSES,
        'group relative overflow-hidden rounded-xl transition-all duration-500',
        isCancelled && 'opacity-60',
        isServed && 'opacity-80',
      )}
      aria-label={tTerminal('orderCard').replace('{id}', order.id)}
    >
      {/* Status bar */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-0.5',
          STATUS_BAR_CLASSES[order.status],
        )}
        aria-hidden="true"
      />

      <div className="p-6">
        {/* Header: ID + customer + status badge */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
              {order.id}
            </span>
            <h3 className="mt-1 font-sans text-xl font-medium text-[var(--aura-text-primary, #e8e8e8)]">
              {order.customer}
            </h3>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Location / time */}
        <div className="mb-4 space-y-2">
          {order.table && (
            <div className="flex items-center gap-2 text-sm text-[var(--aura-text-secondary, #a0a8b0)]">
              <UtensilsCrossed size={16} className="shrink-0" />
              <span>{order.table}</span>
            </div>
          )}
          {order.timeAgo && (
            <div className="flex items-center gap-2 text-sm text-[var(--aura-text-secondary, #a0a8b0)]">
              <Clock size={16} className="shrink-0" />
              <span>{order.timeAgo}</span>
            </div>
          )}
          {isCancelled && order.cancelledReason && (
            <div className="flex items-center gap-2 text-sm text-[#ffb4ab]/60">
              <Ban size={16} className="shrink-0" />
              <span>{order.cancelledReason}</span>
            </div>
          )}
        </div>

        {/* Items section */}
        <div className="mb-4 border-t border-white/5 pt-4">
          <p className="mb-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
            {tTerminal('items')}
          </p>
          {order.items.length > 0 ? (
            <p className="line-clamp-2 text-sm text-[var(--aura-text-primary, #e8e8e8)]">
              {order.items
                .map((item) => `${item.name} x${item.quantity}`)
                .join(', ')}
            </p>
          ) : (
            <p className="line-clamp-2 text-sm italic text-[var(--aura-text-secondary, #a0a8b0)]">
              {tTerminal('orderVoided')}
            </p>
          )}
        </div>

        {/* Total */}
        <div className="mb-4 flex items-center justify-between">
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
            {tTerminal('total')}
          </span>
          <span
            className={cn(
              'font-sans text-xl font-medium text-[var(--aura-primary, #c6c6c7)]',
              isCancelled && 'text-[var(--aura-text-secondary, #a0a8b0)] line-through',
            )}
          >
            {order.total}
          </span>
        </div>

        {/* Actions */}
        {isCancelled ? (
          <button
            className="w-full rounded-lg border border-white/5 bg-white/5 py-3 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:bg-white/10 active:scale-95"
            aria-label={tTerminal('viewLog')}
          >
            {tTerminal('viewLog')}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <OrderActionButton
              label={tTerminal('details')}
              onClick={onAction}
            />
            <OrderActionButton
              label={tTerminal(actionLabel.toLowerCase()) || actionLabel}
              primary
              disabled={isServed}
              onClick={isServed ? undefined : onAction}
            />
          </div>
        )}
      </div>
    </div>
  );
}
