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
  onStatusChange: (orderId: string, status: KitchenOrder['status']) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ',
  preparing: 'Đang làm',
  ready: 'Sẵn',
};

export default function KitchenOrderCard({ order, updatingId, onStatusChange }: Props) {
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

      {order.items.map((item, idx) => (
        <div key={idx} style={itemRow}>
          <span style={itemQty}>{item.quantity}x</span>
          <div style={{ flex: 1 }}>
            <div style={itemName}>{item.name}</div>
            {item.notes && <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</div>}
            {item.modifiers && item.modifiers.length > 0 && (
              <div style={itemModifier}>{item.modifiers.join(', ')}</div>
            )}
          </div>
        </div>
      ))}

      {order.status === 'pending' && (
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
        <div style={noOrderText}>Đã sẵn sàng / Ready</div>
      )}
    </div>
  );
}
