import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTableWithPrefix, stripInternalOrderTags } from '@/hooks/kds-order';
import { OVERDUE_THRESHOLD_MIN, WARNING_THRESHOLD_MIN, parseKdsTimestampMs } from '@/pages/kds-types';
import { KitchenOrder } from './kitchen-display-types';
import {
  cardHeader, tableName, time, itemRow, itemName,
  itemQty, itemModifier, actions, btnStart, btnReady,
  noOrderText, statusBadgeStyle, cardBorder, timeAgo,
} from './kitchen-display-styles';

interface Props {
  order: KitchenOrder;
  userRole?: string;
  updatingId: string | null;
  mutationError?: string;
  onRetry?: () => void;
  onItemReady?: (orderId: string, itemIndex: number) => void;
  onStatusChange: (orderId: string, status: KitchenOrder['status']) => void;
}

const STATUS_TKEY: Record<string, string> = {
  pending: 'kds.pending',
  confirmed: 'kds.confirmed',
  preparing: 'kds.preparing',
  ready: 'kds.ready',
  served: 'kds.served',
};

const NON_PREP_ROLES = new Set(['waiter', 'cashier', 'rider', 'shipper', 'customer']);

export default function KitchenOrderCard({
  order,
  userRole,
  updatingId,
  mutationError,
  onRetry,
  onItemReady,
  onStatusChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isUpdating = updatingId === order.id;
  const normalizedOrderType = String(order.order_type ?? '').trim().toLowerCase();
  const isDelivery = normalizedOrderType === 'delivery';
  const isTakeaway = normalizedOrderType === 'takeaway';
  const normalizedRole = String(userRole ?? '').trim().toLowerCase();
  const canPrep = !normalizedRole || !NON_PREP_ROLES.has(normalizedRole);
  const canServe = !normalizedRole || (normalizedRole !== 'cashier' && normalizedRole !== 'customer');

  const method = String(order.payment_method ?? '').trim().toLowerCase();
  const payStatus = String(order.payment_status ?? '').trim().toLowerCase();
  const isCod = method === 'cod' || method === 'cash' || Number(order.is_cod ?? 0) === 1;
  const isPaid = payStatus === 'paid' || payStatus === 'completed' || payStatus === 'partially_refunded';
  const blockServeUnpaidCod = Boolean(method) && isCod && !isPaid;

  useEffect(() => {
    if (order.status === 'ready' || order.status === 'served' || order.status === 'cancelled') {
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [order.status]);

  const createdMs = parseKdsTimestampMs(order.created_at);
  const elapsedSec = Number.isFinite(createdMs) ? Math.max(0, Math.floor((nowMs - createdMs) / 1000)) : 0;
  const isActivePrep = order.status === 'pending' || order.status === 'confirmed' || order.status === 'preparing';
  const isOverdue = isActivePrep && elapsedSec >= OVERDUE_THRESHOLD_MIN * 60;
  const isWarning = isActivePrep && !isOverdue && elapsedSec >= WARNING_THRESHOLD_MIN * 60;
  const slaState: 'overdue' | 'warning' | 'normal' = isOverdue ? 'overdue' : isWarning ? 'warning' : 'normal';

  const displayCode = order.order_number ? `#${order.order_number.replace(/^#/, '')}` : `#${order.id.slice(-4)}`;
  const channelTitle = isDelivery
    ? t('kds.delivery', 'Giao hàng')
    : isTakeaway
      ? t('kds.togo', 'Mang đi')
      : order.table_name
        ? formatTableWithPrefix(order.table_name, (clean) =>
            t('kds.tablePrefix', { table: clean, defaultValue: `Bàn ${clean}` }),
          )
        : t('kds.togo', 'Mang đi');
  const cleanOrderNotes = stripInternalOrderTags(order.notes);

  return (
    <div style={cardBorder(order.status, slaState)}>
      <div style={cardHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#93C5FD' }}>
              {displayCode}
            </span>
            <h3 style={tableName}>{channelTitle}</h3>
          </div>
          {order.customer_name && (
            <div style={{ fontSize: 12, color: '#A8B8C4', marginTop: 2 }}>
              {order.customer_name}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={statusBadgeStyle(order.status)}>
            {(() => {
              const statusKey = STATUS_TKEY[order.status];
              return statusKey ? t(statusKey, order.status) : order.status;
            })()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isOverdue && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.25)', color: '#FCA5A5', textTransform: 'uppercase' }}>
                {t('kds.overdue', 'Quá hạn')}
              </span>
            )}
            {isWarning && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.25)', color: '#FCD34D', textTransform: 'uppercase' }}>
                {t('kds.warningSoon', 'Sắp trễ')}
              </span>
            )}
            <span style={{ ...time, color: isOverdue ? '#FCA5A5' : isWarning ? '#FCD34D' : time.color }}>
              {timeAgo(order.created_at, {
                freezeEndIso: order.status === 'ready' ? order.ready_at : undefined,
                lang: i18n?.language,
                nowMs,
              })}
            </span>
          </div>
        </div>
      </div>

      {order.items.map((item, idx) => {
        const rawItem = item as KitchenOrder['items'][number] & { qty?: number; product_name?: string; note?: string; notes?: string };
        const qty = rawItem.quantity ?? rawItem.qty ?? 1;
        const name = rawItem.name || rawItem.product_name || '';
        const itemNote = item.note ?? (item as { notes?: string }).notes;
        const isItemDone = Boolean(rawItem.ready || rawItem.status === 'ready' || rawItem.ready_at);
        return (
          <div key={idx} style={itemRow}>
            {onItemReady && canPrep && isActivePrep && (
              <button
                type="button"
                aria-label={`${t('kds.markItemReady', 'Hoàn tất món')}: ${name}`}
                onClick={() => !isItemDone && onItemReady(order.id, idx)}
                disabled={isItemDone || isUpdating}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `1.5px solid ${isItemDone ? '#10B981' : 'rgba(201,214,223,0.4)'}`,
                  background: isItemDone ? 'rgba(16,185,129,0.25)' : 'transparent',
                  color: '#6EE7B7',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isItemDone ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {isItemDone ? '✓' : ''}
              </button>
            )}
            <span style={{ ...itemQty, ...(isItemDone ? { textDecoration: 'line-through', opacity: 0.55 } : {}) }}>{qty}x</span>
            <div style={{ flex: 1, ...(isItemDone ? { textDecoration: 'line-through', opacity: 0.55 } : {}) }}>
              <div style={itemName}>{name}</div>
              {itemNote && <div style={{ fontSize: 12, color: 'var(--md-sys-color-on-surface-variant)', fontStyle: 'italic', marginTop: 2 }}>{itemNote}</div>}
              {item.modifiers && item.modifiers.length > 0 && (
                <div style={itemModifier}>
                  {item.modifiers
                    .map((m: string | { name?: string }) => (typeof m === 'string' ? m : m?.name || ''))
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {cleanOrderNotes && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(251, 191, 36, 0.12)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            color: '#FDE68A',
            fontSize: 12,
            fontStyle: 'italic',
          }}
        >
          {t('kds.orderNotes', 'Ghi chú đơn')}: {cleanOrderNotes}
        </div>
      )}

      {mutationError && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(239, 83, 80, 0.15)',
            border: '1px solid rgba(239, 83, 80, 0.4)',
            color: '#FFB4AB',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>{t('kds.updateFailed', 'Không thể cập nhật')}: {mutationError}</span>
          {onRetry && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={onRetry}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(255, 180, 171, 0.5)',
                background: 'transparent',
                color: '#FFB4AB',
                fontSize: 12,
                fontWeight: 600,
                cursor: isUpdating ? 'not-allowed' : 'pointer',
              }}
            >
              {t('common.retry', 'Thử lại')}
            </button>
          )}
        </div>
      )}

      {canPrep && (order.status === 'pending' || order.status === 'confirmed') && (
        <div style={actions}>
          <button
            style={{ ...btnStart, opacity: isUpdating ? 0.6 : 1 }}
            disabled={isUpdating}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onStatusChange(order.id, 'preparing')}
          >
            {t('kds.startPrep', 'Bắt đầu chế biến')}
          </button>
        </div>
      )}

      {canPrep && order.status === 'preparing' && (
        <div style={actions}>
          <button
            style={{ ...btnReady, opacity: isUpdating ? 0.6 : 1 }}
            disabled={isUpdating}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onStatusChange(order.id, 'ready')}
          >
            {t('kds.ready', 'Sẵn sàng')}
          </button>
        </div>
      )}

      {order.status === 'ready' && (
        <>
          <div style={noOrderText}>
            {isDelivery
              ? t('kds.awaitingRider', 'Chờ shipper nhận')
              : blockServeUnpaidCod
                ? t('orderMgmt.codUnpaidWarning', 'COD chưa thu tiền')
                : t('kds.mobileReadyBanner', 'Đã sẵn sàng')}
          </div>
          {!isDelivery && canServe && (
            <div style={actions}>
              <button
                style={{ ...btnReady, opacity: isUpdating || blockServeUnpaidCod ? 0.5 : 1 }}
                disabled={isUpdating || blockServeUnpaidCod}
                title={blockServeUnpaidCod ? t('orderMgmt.codUnpaidServeError', 'Vui lòng thu tiền COD trước khi phục vụ') : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => !blockServeUnpaidCod && onStatusChange(order.id, 'served')}
              >
                {t('kds.served', 'Đã phục vụ')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
