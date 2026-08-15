'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { API_BASE } from '@/lib/api-client';
import type { TableInfo, MobileOrder, OrderItem } from './waiter-orders-types';
import {
  wrap, header, headerTitle, tabBar, tableGrid, orderCard,
  empty, fab, orderHeader, orderTable, orderTime, orderItem,
  TABLE_STATUS_LABELS, tableCardStyle, tabStyle, orderStatusColor,
} from './waiter-orders-constants';
import { NewOrderModal } from './waiter-orders-new-order-modal';

/* ── Re-exports for backward compatibility ─────────────────────────── */
export type { TableInfo, MobileOrder, OrderItem } from './waiter-orders-types';
export { TABLE_STATUS_LABELS, tableCardStyle, tabStyle, orderStatusColor } from './waiter-orders-constants';

/* ── Component ────────────────────────────────────────────────────── */

export default function WaiterOrders() {
  const { token } = useMobileAuth();
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
            name: i.name, quantity: i.quantity, price: i.price, note: i.note || undefined,
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
        <NewOrderModal
          tables={tables} selectedTableId={selectedTableId} setSelectedTableId={setSelectedTableId}
          newOrderItems={newOrderItems} updateItem={updateItem} addItem={addItem} removeItem={removeItem}
          submitting={submitting} submitOrder={submitOrder} onClose={() => setShowNewOrder(false)}
        />
      )}
    </div>
  );
}
