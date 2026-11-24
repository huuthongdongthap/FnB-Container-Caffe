import { useTranslation } from 'react-i18next';
import type { TableInfo, OrderItem, WaiterMenuItem } from './waiter-orders-types';
import {
  TABLE_STATUS_LABELS, modalOverlay, modal, modalTitle,
  formLabel, select, formInput, itemRow, itemFields,
  COL_NAME, COL_QTY, COL_PRICE, itemNoteRow, btnRemove,
  btnAdd, btnSubmit,
} from './waiter-orders-constants';

interface Props {
  tables: TableInfo[];
  menuItems?: WaiterMenuItem[];
  selectedTableId: string;
  setSelectedTableId: (v: string) => void;
  newOrderItems: OrderItem[];
  updateItem: (idx: number, patch: Partial<OrderItem>) => void;
  addItem: () => void;
  removeItem: (idx: number) => void;
  submitting: boolean;
  submitError?: string | null;
  submitOrder: () => void;
  onClose: () => void;
}

export function NewOrderModal({
  tables, menuItems = [], selectedTableId, setSelectedTableId,
  newOrderItems, updateItem, addItem, removeItem,
  submitting, submitError, submitOrder, onClose,
}: Props) {
  const { t } = useTranslation();

  return (
    <div style={modalOverlay} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div style={modal} role="dialog" aria-label="New order" onClick={(e) => e.stopPropagation()}>
        <div style={modalTitle}>{t('orders.newOrder', 'Tạo đơn mới / New Order')}</div>

        {submitError && (
          <div role="alert" style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 8, background: 'rgba(220,53,69,0.18)', color: '#ff6b6b', fontSize: 12 }}>
            {submitError}
          </div>
        )}

        <label style={formLabel}>{t('orders.table', 'Bàn / Table')} *</label>
        <select style={select} value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}>
          <option value="">-- Chọn bàn --</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>Bàn {t.table_number} ({TABLE_STATUS_LABELS[t.status]?.vi ?? t.status})</option>
          ))}
        </select>

        <label style={formLabel}>{t('orders.items', 'Món / Items')}</label>
        {menuItems.length > 0 && (
          <datalist id="waiter-menu-items-list">
            {menuItems.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        )}
        {newOrderItems.map((item, idx) => (
          <div key={idx} style={itemRow}>
            <div style={itemFields}>
              <input
                style={COL_NAME}
                list={menuItems.length > 0 ? 'waiter-menu-items-list' : undefined}
                placeholder="Tên món / Item name"
                value={item.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const matched = menuItems.find((m) => m.name.toLowerCase() === val.trim().toLowerCase());
                  updateItem(idx, matched
                    ? { name: val, product_id: matched.id, price: matched.price }
                    : { name: val, product_id: undefined });
                }}
              />
              <input style={COL_QTY} type="number" min={1}
                value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
              <input style={COL_PRICE} type="number" placeholder="Giá / Price"
                value={item.price || ''} onChange={(e) => updateItem(idx, { price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div style={itemNoteRow}>
              <input style={{ ...formInput, flex: 1 }} placeholder="Ghi chú / Note"
                value={item.note} onChange={(e) => updateItem(idx, { note: e.target.value })} />
              {newOrderItems.length > 1 && (
                <button type="button" style={btnRemove} onClick={() => removeItem(idx)}>{t('common.remove', 'Xóa')}</button>
              )}
            </div>
          </div>
        ))}
        <button type="button" style={btnAdd} onClick={addItem}>+ {t('orders.addItem', 'Thêm món / Add item')}</button>

        <button type="button" style={{ ...btnSubmit, opacity: submitting || !selectedTableId ? 0.6 : 1 }}
          disabled={submitting || !selectedTableId} onClick={submitOrder}>
          {submitting ? t('common.saving', 'Đang gửi...') : t('orders.submit', 'Gửi / Submit')}
        </button>
      </div>
    </div>
  );
}
