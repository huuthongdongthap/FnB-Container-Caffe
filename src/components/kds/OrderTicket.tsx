import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import type { KDSOrder } from '@/hooks/use-kds';
import { AlertTriangle, Check, CheckCircle2, Clock } from 'lucide-react';

interface OrderTicketProps {
  order: KDSOrder;
  onComplete?: (orderId: string) => void;
}

export function OrderTicket({ order, onComplete }: OrderTicketProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(() => calcElapsedMinutes(order.createdAt));
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes(calcElapsedMinutes(order.createdAt));
    }, 60_000);

    return () => clearInterval(interval);
  }, [order.createdAt]);

  const isCancelled = order.status === 'cancelled';
  const isOverdue = !isCancelled && elapsedMinutes >= 15;
  const isWarning = !isCancelled && !isOverdue && elapsedMinutes >= 5;
  const urgencyLabel = isCancelled
    ? 'ĐÃ HỦY'
    : isOverdue
      ? 'QUÁ HẠN'
      : isWarning
        ? 'CHÚ Ý'
        : 'BÌNH THƯỜNG';

  return (
    <div
      data-testid="order-ticket"
      aria-label={`Đơn #${order.id}, Bàn ${order.table}, ${urgencyLabel}, ${elapsedMinutes} phút`}
      className={cn(
        'rounded-[var(--md-sys-shape-corner-medium)] border p-4 mb-3 shadow-sm transition-colors text-[var(--md-sys-color-on-surface)]',
        isCancelled
          ? 'bg-[var(--md-sys-color-error-container)] border-[var(--md-sys-color-error)]'
          : isOverdue
            ? 'bg-[var(--md-sys-color-error)]/10 border-[var(--md-sys-color-error)]/40'
            : 'bg-[var(--md-sys-color-surface)] border-[var(--md-sys-color-outline-variant)]'
      )}
    >
      {isCancelled && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-2 flex items-center gap-1.5 rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-error)] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[var(--md-sys-color-on-error)]"
        >
          <AlertTriangle size={14} aria-hidden="true" />
          <span>ĐÃ HỦY — DỪNG PHA CHẾ</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-display">
            Bàn {order.table}
          </span>
          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">
            #{order.id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="sla-urgency-badge"
            className={cn(
              'inline-flex items-center gap-1 rounded-[var(--md-sys-shape-corner-extra-small)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-tight',
              isCancelled || isOverdue
                ? 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]'
                : isWarning
                  ? 'bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]'
                  : 'bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]'
            )}
          >
            {isCancelled || isOverdue ? (
              <AlertTriangle size={12} aria-hidden="true" />
            ) : isWarning ? (
              <Clock size={12} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={12} aria-hidden="true" />
            )}
            <span>{urgencyLabel}</span>
          </span>
          <span
            className={cn(
              'text-sm font-mono font-bold',
              isOverdue ? 'text-[var(--md-sys-color-error)]' : 'text-[var(--md-sys-color-on-surface-variant)]'
            )}
          >
            {elapsedMinutes}m
          </span>
          {order.status === 'preparing' && (
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--md-sys-color-primary)]">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang xử lý...
            </span>
          )}
          {order.station && (
            <span className="text-xs px-2 py-0.5 rounded-[var(--md-sys-shape-corner-extra-small)] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] uppercase">
              {order.station}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-start justify-between">
            <div className="flex-1">
              <span className="text-sm font-medium">
                {item.name}
              </span>
              {item.quantity > 1 && (
                <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] ml-1">
                  x{item.quantity}
                </span>
              )}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] ml-2">
                  {item.modifiers.map((m, mi) => (
                    <span key={mi} className="mr-1">
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="text-xs text-[var(--aura-warning)] ml-2 mt-0.5">
                  Ghi chú: {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {onComplete &&
        (order.status === 'pending' ||
          order.status === 'confirmed' ||
          order.status === 'preparing') && (
        <div className="mt-3 pt-3 border-t border-[var(--md-sys-color-outline-variant)]">
          {showConfirm ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onComplete(order.id);
                  setShowConfirm(false);
                }}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-[var(--md-sys-shape-corner-extra-small)] bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:opacity-90 transition-opacity"
              >
                <Check size={16} className="inline" /> Xác nhận
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-[var(--md-sys-shape-corner-extra-small)] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:opacity-90 transition-opacity"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full px-3 py-1.5 text-xs font-medium rounded-[var(--md-sys-shape-corner-extra-small)] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:opacity-90 transition-opacity"
            >
              Hoàn thành
            </button>
          )}
        </div>
      )}

      {/* Prep time indicator bar */}
      <div className="-mx-4 -mb-4 mt-3">
        <div
          role="progressbar"
          aria-label={`Thời gian chờ: ${elapsedMinutes} phút (${urgencyLabel})`}
          aria-valuenow={Math.min(elapsedMinutes, 15)}
          aria-valuemin={0}
          aria-valuemax={15}
          className={cn(
            'h-1.5 rounded-b-[var(--md-sys-shape-corner-medium)]',
            elapsedMinutes < 5
              ? 'bg-[var(--aura-success)]'
              : elapsedMinutes < 10
                ? 'bg-[var(--aura-warning)]'
                : 'bg-[var(--md-sys-color-error)]'
          )}
        />
      </div>
    </div>
  );
}

function calcElapsedMinutes(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / 60_000);
}
