/**
 * StitchOrderMgmtNew Order Card
 * Individual order card with status bar, items list, and action buttons.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  Clock,
  UtensilsCrossed,
  Ban,
  Phone,
  MapPin,
  CreditCard,
  AlertTriangle,
  Printer,
  Edit3,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import type { OrderData } from './StitchOrderMgmtNew-types';
import { GLASS_CLASSES, STATUS_BAR_CLASSES, getActionForStatus } from './stitch-order-mgmt-default';
import { StatusBadge, OrderActionButton } from './StitchOrderMgmtNew-status-badge';

/* ─── Channel Badge Styles ───────────────────────────────────────────── */

const CHANNEL_BADGE_CLASSES: Record<string, string> = {
  dine_in: 'bg-sky-500/15 text-sky-300 border-sky-400/40',
  takeaway: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
  delivery: 'bg-purple-500/15 text-purple-300 border-purple-400/40',
};

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

/* ─── Order Card ─────────────────────────────────────────────────────── */

interface OrderCardProps {
  order: OrderData;
  onAction?: (targetStatus?: string) => void;
  onViewDetails?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
}

export function OrderCard({
  order,
  onAction,
  onViewDetails,
  onCancel,
  onEdit,
  onPrint,
}: Readonly<OrderCardProps>) {
  const { t } = useTranslation();

  const isTerminal =
    order.status === 'cancelled' ||
    order.status === 'completed' ||
    order.status === 'failed' ||
    order.status === 'expired';
  const isCancelled = order.status === 'cancelled';
  const fallbackActionKey = getActionForStatus(order.status, order.orderType);
  const actionLabel = order.nextActionLabel || t(`terminal.${fallbackActionKey.toLowerCase()}`, { defaultValue: fallbackActionKey });
  const actionDisabled = order.nextActionDisabled ?? isTerminal;

  const tTerminal = (key: string) => t(`terminal.${key}`);
  const channelKey = order.orderType || (order.table ? 'dine_in' : 'takeaway');
  const displayTable = order.tableName || order.table;
  const paymentMethodLabel = order.paymentMethod
    ? t(`orderMgmt.paymentMethod.${order.paymentMethod}`, { defaultValue: order.paymentMethod.toUpperCase() })
    : '';
  const paymentStatusLabel = order.paymentStatus
    ? t(`orderMgmt.paymentStatus.${order.paymentStatus}`, { defaultValue: order.paymentStatus })
    : '';

  return (
    <div
      className={cn(
        GLASS_CLASSES,
        'group relative flex h-full flex-col overflow-hidden rounded-xl transition-all duration-300',
        isCancelled && 'opacity-70',
        order.status === 'completed' && 'opacity-85',
      )}
      aria-label={tTerminal('orderCard').replace('{id}', order.id)}
    >
      {/* Status bar */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-1',
          STATUS_BAR_CLASSES[order.status],
        )}
        aria-hidden="true"
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Header: ID + status badge on row 1, customer + channel badge on row 2 */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--aura-text-secondary,#a0a8b0)]">
              {order.displayId || order.id}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate font-sans text-lg font-medium text-[var(--aura-text-primary,#e8e8e8)]">
              {order.customer}
            </h3>
            <span
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                CHANNEL_BADGE_CLASSES[channelKey] ?? CHANNEL_BADGE_CLASSES.takeaway,
              )}
            >
              {t(`orderMgmt.channel.${channelKey}`, { defaultValue: channelKey })}
            </span>
          </div>
        </div>

        {/* Location / Contact / Payment / Time */}
        <div className="mb-3 space-y-1.5 text-xs text-[var(--aura-text-secondary,#a0a8b0)]">
          {displayTable && (
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={14} className="shrink-0" />
              <span>{displayTable}</span>
            </div>
          )}
          {order.customerPhone && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="shrink-0" />
              <span>{order.customerPhone}</span>
            </div>
          )}
          {order.customerAddress && channelKey === 'delivery' && (
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2">{order.customerAddress}</span>
            </div>
          )}
          {(paymentMethodLabel || paymentStatusLabel) && (
            <div className="flex flex-wrap items-center gap-2">
              <CreditCard size={14} className="shrink-0" />
              {paymentMethodLabel && <span>{paymentMethodLabel}</span>}
              {paymentStatusLabel && (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    order.paymentStatus === 'paid' ||
                      order.paymentStatus === 'completed' ||
                      order.paymentStatus === 'partially_refunded'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : order.paymentStatus === 'refunded'
                        ? 'bg-slate-500/20 text-slate-300'
                        : 'bg-amber-500/15 text-amber-300',
                  )}
                >
                  {paymentStatusLabel}
                </span>
              )}
            </div>
          )}
          {order.isHeldOutOfKds && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
              <AlertTriangle size={12} className="shrink-0" />
              <span>{t('orderMgmt.heldOutOfKds', { defaultValue: 'Đang giữ khỏi KDS (chờ thanh toán)' })}</span>
            </div>
          )}
          {order.deliveryTime && order.deliveryTime !== 'now' && (
            <div className="flex items-center gap-2 text-amber-200/90">
              <Clock size={14} className="shrink-0" />
              <span>{t('orderMgmt.deliveryTimeLabel', { defaultValue: 'Giờ giao' })}: {order.deliveryTime}</span>
            </div>
          )}
          {(order.timeAgo || order.createdTimeLabel) && (
            <div className="flex items-center gap-2">
              <Clock size={14} className="shrink-0" />
              <span>
                {order.timeAgo}
                {order.createdTimeLabel ? ` · ${order.createdTimeLabel}` : ''}
              </span>
            </div>
          )}
          {order.notes && (
            <p className="rounded bg-white/5 px-2 py-1 text-xs italic text-amber-200/90">
              {order.notes}
            </p>
          )}
          {(isCancelled || order.status === 'failed') && (order.cancelledReason || order.failureReason) && (
            <div className="flex items-center gap-2 text-xs text-[var(--aura-error,#FFB4AB)]/80">
              <Ban size={14} className="shrink-0" />
              <span>{order.cancelledReason || order.failureReason}</span>
            </div>
          )}
        </div>

        {/* Unpaid online/delivery warning */}
        {order.unpaidWarning && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{order.unpaidWarning}</span>
          </div>
        )}

        {/* Items section (line-by-line FnB format) */}
        <div className="mb-4 border-t border-white/5 pt-3">
          <p className="mb-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary,#a0a8b0)]">
            {tTerminal('items')}
          </p>
          {order.items.length > 0 ? (
            <ul className="space-y-1 text-sm text-[var(--aura-text-primary,#e8e8e8)]">
              {order.items.map((item, idx) => (
                <li key={`${item.name}-${idx}`} className="flex flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      <span className="mr-1.5 text-amber-300">x{item.quantity}</span>
                      {item.name}
                    </span>
                    {typeof item.price === 'number' && Number.isFinite(item.price) && (
                      <span className="shrink-0 font-mono text-xs text-[var(--aura-text-secondary,#a0a8b0)]">
                        {formatVnd(item.price * item.quantity)}
                      </span>
                    )}
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <span className="pl-5 text-xs text-[var(--aura-text-secondary,#a0a8b0)]">
                      + {item.modifiers.join(', ')}
                    </span>
                  )}
                  {item.notes && (
                    <span className="pl-5 text-xs italic text-amber-200/80">
                      {item.notes}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-[var(--aura-text-secondary,#a0a8b0)]">
              {tTerminal('orderVoided')}
            </p>
          )}
        </div>

        {/* Bottom footer pinned with mt-auto so totals & buttons align across columns */}
        <div className="mt-auto">
          {/* Fee / Discount breakdown when applicable */}
          {((order.shippingFee ?? 0) > 0 || (order.serviceFee ?? 0) > 0 || (order.discount ?? 0) > 0) && (
            <div className="mb-2 space-y-0.5 border-t border-white/5 pt-2 text-xs text-[var(--aura-text-secondary,#a0a8b0)]">
              {(order.shippingFee ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span>{t('orderMgmt.shippingFee', { defaultValue: 'Phí giao hàng' })}</span>
                  <span className="font-mono">+{formatVnd(order.shippingFee!)}</span>
                </div>
              )}
              {(order.serviceFee ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span>{t('orderMgmt.serviceFee', { defaultValue: 'Phí dịch vụ' })}</span>
                  <span className="font-mono">+{formatVnd(order.serviceFee!)}</span>
                </div>
              )}
              {(order.discount ?? 0) > 0 && (
                <div className="flex items-center justify-between text-emerald-300">
                  <span>{t('orderMgmt.discount', { defaultValue: 'Giảm giá' })}</span>
                  <span className="font-mono">-{formatVnd(order.discount!)}</span>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="mb-3 flex items-center justify-between">
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary,#a0a8b0)]">
              {tTerminal('total')}
            </span>
            <span
              className={cn(
                'font-sans text-lg font-semibold text-[var(--aura-primary,#c6c6c7)]',
                isCancelled && 'text-[var(--aura-text-secondary,#a0a8b0)] line-through',
              )}
            >
              {order.total}
            </span>
          </div>

          {order.additionalActions}

          {/* Quick utility icons row */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {order.canConfirm && onAction && (
              <button
                type="button"
                onClick={() => onAction('confirmed')}
                className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
              >
                <CheckCircle2 size={13} />
                {tTerminal('confirm')}
              </button>
            )}
            {onEdit && !isTerminal && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[var(--aura-text-secondary,#a0a8b0)] hover:bg-white/10 hover:text-white"
                aria-label={t('orderMgmt.editNotes')}
              >
                <Edit3 size={13} />
                {t('orderMgmt.editNotes')}
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[var(--aura-text-secondary,#a0a8b0)] hover:bg-white/10 hover:text-white"
                aria-label={t('orderMgmt.printTicket')}
              >
                <Printer size={13} />
                {t('orderMgmt.printTicket')}
              </button>
            )}
            {order.canCancel && onCancel && !isTerminal && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/20"
                aria-label={tTerminal('cancel')}
              >
                <XCircle size={13} />
                {tTerminal('cancel')}
              </button>
            )}
          </div>

          {/* Primary Actions */}
          {isCancelled ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="flex min-h-[42px] w-full items-center justify-center rounded-lg border border-white/5 bg-white/5 px-3 py-2.5 font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--aura-text-secondary,#a0a8b0)] transition-all hover:bg-white/10 active:scale-95"
              aria-label={tTerminal('viewLog')}
            >
              {tTerminal('viewLog')}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <OrderActionButton
                label={tTerminal('details')}
                onClick={onViewDetails}
              />
              <div className="flex" title={order.nextActionTooltip || undefined}>
                <OrderActionButton
                  label={actionLabel}
                  primary
                  disabled={actionDisabled}
                  onClick={actionDisabled ? undefined : () => onAction?.(order.nextActionStatus)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
