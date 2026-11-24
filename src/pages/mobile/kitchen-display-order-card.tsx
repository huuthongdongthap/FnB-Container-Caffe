import React from 'react';
import { useTranslation } from 'react-i18next';
import { KitchenOrder } from './kitchen-display-types';
import {
  cardHeader, tableName, time, itemRow, itemName,
  itemQty, itemModifier, actions, btnStart, btnReady,
  noOrderText, statusBadgeStyle, cardBorder, timeAgo,
} from './kitchen-display-styles';

interface Props {
  order: KitchenOrder;
  updatingId: string | null;
  mutationError?: string;
  onRetry?: () => void;
  onStatusChange: (orderId: string, status: KitchenOrder['status']) => void;
}

const STATUS_TKEY: Record<string, string> = {
  pending: 'kds.pending',
  confirmed: 'kds.confirmed',
  preparing: 'kds.preparing',
  ready: 'kds.ready',
  served: 'kds.served',
};

export default function KitchenOrderCard({
  order,
  updatingId,
  mutationError,
  onRetry,
  onStatusChange,
}: Props) {
  const { t } = useTranslation();
  const isUpdating = updatingId === order.id;
  const isDelivery = order.order_type === 'delivery';

  return (
    <div style={cardBorder(order.status)}>
      <div style={cardHeader}>
        <h3 style={tableName}>
          {order.table_name
            ? t('kds.tablePrefix', { table: order.table_name, defaultValue: `Bàn ${order.table_name}` })
            : isDelivery
              ? t('kds.delivery', 'Giao hàng')
              : t('kds.togo', 'Mang đi')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={statusBadgeStyle(order.status)}>
            {(() => {
              const statusKey = STATUS_TKEY[order.status];
              return statusKey ? t(statusKey, order.status) : order.status;
            })()}
          </span>
          <span style={time}>{timeAgo(order.created_at)}</span>
        </div>
      </div>

      {order.items.map((item, idx) => {
        const rawItem = item as KitchenOrder['items'][number] & { qty?: number; product_name?: string; note?: string; notes?: string };
        const qty = rawItem.quantity ?? rawItem.qty ?? 1;
        const name = rawItem.name || rawItem.product_name || '';
        const itemNote = item.note ?? (item as { notes?: string }).notes;
        return (
          <div key={idx} style={itemRow}>
            <span style={itemQty}>{qty}x</span>
            <div style={{ flex: 1 }}>
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

      {(order.status === 'pending' || order.status === 'confirmed') && (
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

      {order.status === 'preparing' && (
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
              : t('kds.mobileReadyBanner', 'Đã sẵn sàng')}
          </div>
          {!isDelivery && (
            <div style={actions}>
              <button
                style={{ ...btnReady, opacity: isUpdating ? 0.6 : 1 }}
                disabled={isUpdating}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onStatusChange(order.id, 'served')}
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
