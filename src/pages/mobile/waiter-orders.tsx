'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { apiFetch } from '@/lib/api-client';
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
  const { token, user } = useMobileAuth();
  const [tab, setTab] = useState<'orders' | 'tables'>('orders');
  const [rawOrders, setRawOrders] = useState<MobileOrder[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [newOrderItems, setNewOrderItems] = useState<OrderItem[]>([{ name: '', quantity: 1, price: 0, note: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const fetchTables = useCallback(async () => {
    try {
      const body = await apiFetch<{ success: boolean; tables: Array<TableInfo & { number?: number }> }>('/mobile/tables');
      if (body.success) {
        setTables(body.tables.map((t) => ({
          ...t,
          table_number: t.table_number ?? t.number ?? 0,
        })));
      }
    } catch { /* silent */ }
  }, [token, user?.id, user?.tenantId]);

  const fetchOrders = useCallback(async () => {
    try {
      const body = (await apiFetch<{ success: boolean; orders: MobileOrder[] }>('/mobile/orders'));
      if (body.success) {
        setRawOrders(body.orders);
      }
    } catch { /* silent */ }
  }, [token, user?.id, user?.tenantId]);

  const orders = useMemo(() => {
    const tableMap = new Map(
      tables.map((t) => [t.id, (t as TableInfo & { number?: number }).number ?? t.table_number])
    );
    return rawOrders.map((o) => ({
      ...o,
      table_number: tableMap.get(o.table_id) ?? o.table_number ?? 0,
    }));
  }, [rawOrders, tables]);

  useEffect(() => {
    setRawOrders([]);
    setTables([]);
    void fetchTables();
    void fetchOrders();
  }, [fetchTables, fetchOrders]);

  const submitOrder = useCallback(async () => {
    if (submittingRef.current) return;
    const newOrderTable = selectedTableId.trim();
    if (!newOrderTable) return;
    const validItems = newOrderItems.filter((i) => i.name.trim());
    if (validItems.length === 0) return;
    const selectedTable = tables.find((t) => String(t.id) === newOrderTable) as (TableInfo & { number?: number }) | undefined;
    const resolvedTableId =
      Number.isFinite(Number(newOrderTable)) &&
      String(parseInt(newOrderTable, 10)) === newOrderTable
        ? parseInt(newOrderTable, 10)
        : newOrderTable;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const idempotencyKey = `waiter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const body = await apiFetch<{ success: boolean; error?: string }>('/mobile/orders', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
          ...(user?.tenantId ? { 'X-Tenant-ID': user.tenantId } : {}),
        },
        body: JSON.stringify({
          table_id: resolvedTableId,
          table_number: selectedTable?.number ?? selectedTable?.table_number,
          items: validItems.map((i) => ({
            name: i.name, quantity: i.quantity, price: i.price, note: i.note || undefined,
          })),
        }),
      });
      if (body.success) {
        setShowNewOrder(false);
        setSelectedTableId('');
        setNewOrderItems([{ name: '', quantity: 1, price: 0, note: '' }]);
        void fetchOrders();
        void fetchTables();
      } else {
        setSubmitError(body.error || 'Failed to submit order');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit order');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [selectedTableId, newOrderItems, tables, fetchOrders, fetchTables]);

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
              {o.items.map((item, idx) => {
                const modStr = Array.isArray((item as any).modifiers)
                  ? (item as any).modifiers
                      .map((m: any) => (typeof m === 'string' ? m : m?.name || ''))
                      .filter(Boolean)
                      .join(', ')
                  : '';
                return (
                  <div key={idx} style={orderItem}>
                    {item.quantity}x {item.name}
                    {modStr ? ` (${modStr})` : ''}
                    {item.note ? ` (${item.note})` : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {tab === 'tables' && (
        <div style={tableGrid}>
          {tables.map((t) => (
            <div key={t.id} style={tableCardStyle(t.status)}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>Bàn {t.table_number}</div>
              <div style={{ fontSize: 11, color: 'var(--md-sys-color-on-surface-variant)', marginTop: 4 }}>
                {TABLE_STATUS_LABELS[t.status]?.vi} / {TABLE_STATUS_LABELS[t.status]?.en}
              </div>
            </div>
          ))}
          {tables.length === 0 && (
            <div style={{ ...empty, gridColumn: '1 / -1' }}>Không có dữ liệu bàn</div>
          )}
        </div>
      )}

      <button style={fab} onClick={() => { setSelectedTableId(''); setNewOrderItems([{ name: '', quantity: 1, price: 0, note: '' }]); setSubmitError(null); setShowNewOrder(true); }} aria-label="New order">+</button>

      {submitError && (
        <div role="alert" style={{ padding: '8px 12px', margin: '8px 16px', borderRadius: 8, background: 'rgba(220,53,69,0.15)', color: '#ff6b6b', fontSize: 12 }}>
          {submitError}
        </div>
      )}

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
