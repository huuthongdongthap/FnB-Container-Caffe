'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { API_BASE } from '@/lib/api-client';

/* ── Types ────────────────────────────────────────────────────────── */

interface TableInfo {
  id: string;
  table_number: number;
  status: 'free' | 'occupied' | 'reserved';
}

interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  note: string;
}

interface MobileOrder {
  id: string;
  table_id: string;
  table_number: number;
  items: OrderItem[];
  status: string;
  created_at: string;
}

/* ── Static styles ──────────────────────────────────────────────────*/

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f8f7f4', fontFamily: "'Space Grotesk', sans-serif", paddingBottom: 72 };
const header: React.CSSProperties = { padding: '14px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 };
const headerTitle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 };
const tabBar: React.CSSProperties = { display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb' };
const tableGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, padding: '12px 14px' };
const orderCard: React.CSSProperties = { margin: '8px 14px 0', background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' };
const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#9ca3af', fontSize: 14 };
const fab: React.CSSProperties = { position: 'fixed', bottom: 88, right: 18, width: 56, height: 56, borderRadius: '50%', background: '#F97316', color: '#fff', border: 'none', fontSize: 28, fontWeight: 300, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 };
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const modal: React.CSSProperties = { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', padding: '20px 16px 24px' };
const modalTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 };
const formLabel: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };
const formInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', color: '#1a1a2e', fontFamily: "'Space Grotesk', sans-serif", outline: 'none' };
const btnAdd: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '6px 12px', border: '1.5px dashed #F97316', borderRadius: 8, background: 'transparent', color: '#F97316', cursor: 'pointer', marginTop: 8, fontFamily: "'Space Grotesk', sans-serif" };
const btnRemove: React.CSSProperties = { fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: "'Space Grotesk', sans-serif" };
const btnSubmit: React.CSSProperties = { width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 12, background: '#F97316', color: '#fff', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", marginTop: 18 };
const select: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', color: '#1a1a2e', fontFamily: "'Space Grotesk', sans-serif", outline: 'none' };
const orderHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
const orderTable: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#F97316' };
const orderTime: React.CSSProperties = { fontSize: 11, color: '#9ca3af' };
const orderItem: React.CSSProperties = { fontSize: 13, color: '#374151', padding: '2px 0' };
const itemRow: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const itemFields: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
const itemNoteRow: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center' };

/* ── Column widths for item form ────────────────────────────────────*/

const COL_NAME: React.CSSProperties = { ...formInput, flex: 2 };
const COL_QTY: React.CSSProperties = { ...formInput, width: 60, textAlign: 'center' };
const COL_PRICE: React.CSSProperties = { ...formInput, width: 80 };

/* ── Factory functions ──────────────────────────────────────────────*/

const TABLE_STATUS_LABELS: Record<string, { vi: string; en: string }> = {
  free: { vi: 'Trống', en: 'Free' },
  occupied: { vi: 'Đang dùng', en: 'Occupied' },
  reserved: { vi: 'Đặt trước', en: 'Reserved' },
};

function tableCardStyle(status: string): React.CSSProperties {
  const bg: Record<string, string> = { free: '#d1fae5', occupied: '#fee2e2', reserved: '#fef3c7' };
  const border: Record<string, string> = { free: '#6ee7b7', occupied: '#fca5a5', reserved: '#fcd34d' };
  return {
    background: bg[status] ?? '#f3f4f6',
    border: `2px solid ${border[status] ?? '#e5e7eb'}`,
    borderRadius: 14, padding: '18px 12px', textAlign: 'center',
  };
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '12px 0', fontSize: 13, fontWeight: active ? 700 : 500,
    textAlign: 'center', cursor: 'pointer', color: active ? '#F97316' : '#6b7280',
    borderBottom: active ? '2px solid #F97316' : '2px solid transparent',
    background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    fontFamily: "'Space Grotesk', sans-serif", transition: 'color 0.15s',
  };
}

function orderStatusColor(status: string): string {
  switch (status) {
    case 'pending': return '#fef3c7';
    case 'preparing': return '#dbeafe';
    case 'ready': return '#d1fae5';
    default: return '#f3f4f6';
  }
}

/* ── Component ──────────────────────────────────────────────────────*/

export default function WaiterOrders() {
  const { token, user } = useMobileAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<'orders' | 'tables'>('orders');
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [newOrderItems, setNewOrderItems] = useState<OrderItem[]>([{ name: '', quantity: 1, price: 0, note: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/mobile/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as { success: boolean; tables: TableInfo[] };
      if (res.ok && body.success) setTables(body.tables);
    } catch { /* silent */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/mobile/orders`);
      const body = (await res.json()) as { success: boolean; orders: MobileOrder[] };
      if (res.ok && body.success) {
        const tableMap = new Map(tables.map((t) => [t.id, t.table_number]));
        setOrders(body.orders.map((o) => ({ ...o, table_number: tableMap.get(o.table_id) ?? o.table_number ?? 0 })));
      }
    } catch { /* silent */ }
  }, [tables]);

  useEffect(() => { fetchTables(); }, [fetchTables]);
  useEffect(() => { if (tables.length > 0) fetchOrders(); }, [tables, fetchOrders]);

  const submitOrder = useCallback(async () => {
    if (!selectedTableId) return;
    const validItems = newOrderItems.filter((i) => i.name.trim());
    if (validItems.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/mobile/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: selectedTableId,
          items: validItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            note: i.note || undefined,
          })),
        }),
      });
      if (res.ok) {
        setShowNewOrder(false);
        setSelectedTableId('');
        setNewOrderItems([{ name: '', quantity: 1, price: 0, note: '' }]);
        fetchOrders();
        fetchTables();
      }
    } catch { /* silent */ } finally { setSubmitting(false); }
  }, [selectedTableId, newOrderItems, fetchOrders, fetchTables]);

  const updateItem = useCallback((idx: number, patch: Partial<OrderItem>) => {
    setNewOrderItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }, []);

  const addItem = useCallback(() => {
    setNewOrderItems((prev) => [...prev, { name: '', quantity: 1, price: 0, note: '' }]);
  }, []);

  const removeItem = useCallback((idx: number) => {
    setNewOrderItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  return (
    <div style={wrap}>
      <div style={header}>
        <h1 style={headerTitle}>Đơn hàng / Orders</h1>
      </div>
      <div style={tabBar}>
        <button style={tabStyle(tab === 'orders')} onClick={() => setTab('orders')}>Đơn hàng / Orders</button>
        <button style={tabStyle(tab === 'tables')} onClick={() => setTab('tables')}>Bàn / Tables</button>
      </div>

      {tab === 'orders' && (
        <>
          {orders.length === 0 && (
            <div style={empty}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div>Chưa có đơn nào hôm nay / No orders today</div>
            </div>
          )}
          {orders.map((o) => (
            <div key={o.id} style={{ ...orderCard, borderLeft: `4px solid ${orderStatusColor(o.status)}` }}>
              <div style={orderHeader}>
                <span style={orderTable}>Bàn {o.table_number ?? '?'}</span>
                <span style={orderTime}>
                  {new Date(o.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {o.items.map((item, idx) => (
                <div key={idx} style={orderItem}>{item.quantity}x {item.name}{item.note ? ` (${item.note})` : ''}</div>
              ))}
            </div>
          ))}
        </>
      )}

      {tab === 'tables' && (
        <div style={tableGrid}>
          {tables.map((t) => (
            <div key={t.id} style={tableCardStyle(t.status)}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Bàn {t.table_number}</div>
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                {TABLE_STATUS_LABELS[t.status]?.vi} / {TABLE_STATUS_LABELS[t.status]?.en}
              </div>
            </div>
          ))}
          {tables.length === 0 && (
            <div style={{ ...empty, gridColumn: '1 / -1' }}>Không có dữ liệu bàn</div>
          )}
        </div>
      )}

      <button style={fab} onClick={() => { setSelectedTableId(''); setNewOrderItems([{ name: '', quantity: 1, price: 0, note: '' }]); setShowNewOrder(true); }} aria-label="New order">+</button>

      {showNewOrder && (
        <div style={modalOverlay} onClick={() => setShowNewOrder(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalTitle}>{t('orders.newOrder', 'Tạo đơn mới / New Order')}</div>

            <label style={formLabel}>{t('orders.table', 'Bàn / Table')} *</label>
            <select style={select} value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}>
              <option value="">-- Chọn bàn --</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>Bàn {t.table_number} ({TABLE_STATUS_LABELS[t.status]?.vi ?? t.status})</option>
              ))}
            </select>

            <label style={formLabel}>{t('orders.items', 'Món / Items')}</label>
            {newOrderItems.map((item, idx) => (
              <div key={idx} style={itemRow}>
                <div style={itemFields}>
                  <input style={COL_NAME} placeholder="Tên món / Item name"
                    value={item.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
                  <input style={COL_QTY} type="number" min={1}
                    value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                  <input style={COL_PRICE} type="number" placeholder="Giá / Price"
                    value={item.price || ''} onChange={(e) => updateItem(idx, { price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div style={itemNoteRow}>
                  <input style={{ ...formInput, flex: 1 }} placeholder="Ghi chú / Note"
                    value={item.note} onChange={(e) => updateItem(idx, { note: e.target.value })} />
                  {newOrderItems.length > 1 && (
                    <button style={btnRemove} onClick={() => removeItem(idx)}>{t('common.remove', 'Xóa')}</button>
                  )}
                </div>
              </div>
            ))}
            <button style={btnAdd} onClick={addItem}>+ {t('orders.addItem', 'Thêm món / Add item')}</button>

            <button style={{ ...btnSubmit, opacity: submitting || !selectedTableId ? 0.6 : 1 }}
              disabled={submitting || !selectedTableId} onClick={submitOrder}>
              {submitting ? t('common.saving', 'Đang gửi...') : t('orders.submit', 'Gửi / Submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
