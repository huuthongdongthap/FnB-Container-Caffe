import React from 'react';
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

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang làm',
  ready: 'Sẵn',
  served: 'Đã phục vụ',
};

export default function KitchenOrderCard({
  order,
  updatingId,
  mutationError,
  onRetry,
  onStatusChange,
}: Props) {
  const isUpdating = updatingId === order.id;

  return (
    <div style={cardBorder(order.status)}>
      <div style={cardHeader}>
        <h3 style={tableName}>Bàn {order.table_name}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={statusBadgeStyle(order.status)}>
            {STATUS_LABEL[order.status] ?? order.status}
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
          <span>Cập nhật thất bại: {mutationError}</span>
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
              Thử lại
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
            Bắt đầu / Start
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
            Sẵn sàng / Ready
          </button>
        </div>
      )}

      {order.status === 'ready' && (
        <>
          <div style={noOrderText}>Đã sẵn sàng / Ready</div>
          <div style={actions}>
            <button
              style={{ ...btnReady, opacity: isUpdating ? 0.6 : 1 }}
              disabled={isUpdating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onStatusChange(order.id, 'served')}
            >
              Đã phục vụ / Served
            </button>
          </div>
        </>
      )}
    </div>
  );
}
