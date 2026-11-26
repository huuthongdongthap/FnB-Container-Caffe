'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { formatTableWithPrefix, stripInternalOrderTags } from '@/hooks/kds-order';
import { parseKdsTimestampMs } from '@/pages/kds-types';
import { apiFetch } from '@/lib/api-client';
import type { TableInfo, MobileOrder, OrderItem, WaiterMenuItem } from './waiter-orders-types';
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

export const WAITER_ORDER_CREATE_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'waiter',
  'cashier',
]);

const WAITER_SERVE_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'waiter',
  'cashier',
  'staff',
  'kitchen',
  'barista',
  'chef',
]);

const WAITER_POLL_INTERVAL_MS = 10_000;

export default function WaiterOrders() {
  const { t } = useTranslation();
  const { token, user } = useMobileAuth();
  const [tab, setTab] = useState<'orders' | 'tables'>('orders');
  const [rawOrders, setRawOrders] = useState<MobileOrder[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [menuItems, setMenuItems] = useState<WaiterMenuItem[]>([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [newOrderItems, setNewOrderItems] = useState<OrderItem[]>([{ name: '', quantity: 1, price: 0, note: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [servingId, setServingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const normalizedUserRole = String(user?.role ?? '').trim().toLowerCase();
  const canCreateMobileOrder = WAITER_ORDER_CREATE_ROLES.has(normalizedUserRole);
  const canServeReadyOrder = !normalizedUserRole || WAITER_SERVE_ROLES.has(normalizedUserRole);

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

  const fetchMenu = useCallback(async () => {
    try {
      const body = await apiFetch<{
        success?: boolean;
        products?: Array<{ id?: string; name?: string; price?: number }>;
        data?: Array<{ id?: string; name?: string; price?: number }>;
      }>('/api/products');
      const list = Array.isArray(body.products) ? body.products : Array.isArray(body.data) ? body.data : [];
      setMenuItems(
        list
          .filter((p): p is { id: string; name: string; price?: number } => Boolean(p?.id && p?.name))
          .map((p) => ({ id: String(p.id), name: String(p.name), price: Number(p.price ?? 0) }))
      );
    } catch { /* silent */ }
  }, [token, user?.id, user?.tenantId]);

  useEffect(() => {
    setRawOrders([]);
    setTables([]);
    void fetchTables();
    void fetchOrders();
    void fetchMenu();
  }, [fetchTables, fetchOrders, fetchMenu]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchOrders();
      void fetchTables();
    }, WAITER_POLL_INTERVAL_MS);
    const handleSync = () => {
      void fetchOrders();
      void fetchTables();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('aura:orders-changed', handleSync);
    }
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('aura:orders-changed', handleSync);
      }
    };
  }, [fetchOrders, fetchTables]);

  const handleMarkServed = useCallback(async (order: MobileOrder) => {
    if (servingId) return;
    const method = String(order.payment_method ?? '').trim().toLowerCase();
    const payStatus = String(order.payment_status ?? '').trim().toLowerCase();
    const isCod = method === 'cod' || method === 'cash' || Number(order.is_cod ?? 0) === 1;
    const isPaid = payStatus === 'paid' || payStatus === 'completed' || payStatus === 'partially_refunded';
    if (isCod && !isPaid) {
      setSubmitError(t('orderMgmt.codUnpaidServeError', 'Đơn COD/tiền mặt chưa thu tiền — vui lòng thu tiền trước khi xác nhận đã phục vụ.'));
      return;
    }
    setServingId(order.id);
    setSubmitError(null);
    try {
      await apiFetch(`/mobile/kds/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'served' }),
      });
      await fetchOrders();
      await fetchTables();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setServingId(null);
    }
  }, [servingId, fetchOrders, fetchTables, t]);

  const submitOrder = useCallback(async () => {
    if (submittingRef.current) return;
    const newOrderTable = selectedTableId.trim();
    if (!newOrderTable) return;
    const validItems = newOrderItems.filter((i) => i.name.trim());
    if (validItems.length === 0) return;
    const selectedTable = tables.find((t) => String(t.id) === newOrderTable) as (TableInfo & { number?: number }) | undefined;
    const resolvedTableId = String(selectedTable?.id ?? newOrderTable);
    const menuByName = new Map(menuItems.map((m) => [m.name.trim().toLowerCase(), m]));
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
          items: validItems.map((i) => {
            const matched = menuByName.get(i.name.trim().toLowerCase());
            const resolvedProductId = i.product_id || i.id || matched?.id || i.name.trim().toLowerCase().replace(/\s+/g, '-');
            return {
              product_id: resolvedProductId,
              name: i.name.trim(),
              quantity: i.quantity,
              price: i.price || matched?.price || 0,
              note: i.note || undefined,
            };
          }),
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
      <div style={{ ...header, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={headerTitle}>{t('orderMgmt.all', 'Đơn hàng')}</h1>
        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            void fetchOrders();
            void fetchTables();
          }}
          aria-label={t('terminal.refresh', 'Làm mới')}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid rgba(201, 214, 223, 0.25)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--md-sys-color-on-surface, #E8EEF3)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('terminal.refresh', 'Làm mới')}
        </button>
      </div>
      <div style={tabBar}>
        <button style={tabStyle(tab === 'orders')} onClick={() => setTab('orders')}>{t('terminal.nav.orders', 'Đơn hàng')}</button>
        <button style={tabStyle(tab === 'tables')} onClick={() => setTab('tables')}>{t('orderMgmt.searchField.table', 'Bàn')}</button>
      </div>

      {tab === 'orders' && (
        <>
          {orders.length === 0 && (
            <div style={empty}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div>{t('terminal.noOrders', 'Chưa có đơn nào hôm nay')}</div>
            </div>
          )}
          {orders.map((o) => {
            const displayCode = o.order_number ? `#${o.order_number.replace(/^#/, '')}` : `#${o.id.slice(-4)}`;
            const orderType = String(o.order_type ?? '').trim().toLowerCase();
            const hasRealTable = Boolean(o.table_id && Number(o.table_number) > 0) || Boolean(o.table_id && String(o.table_id).trim());
            const originLabel =
              orderType === 'delivery'
                ? t('kds.delivery', 'Giao hàng')
                : orderType === 'takeaway'
                  ? t('kds.togo', 'Mang đi')
                  : Number(o.table_number) > 0
                    ? formatTableWithPrefix(String(o.table_number), (clean) => t('kds.tablePrefix', { table: clean, defaultValue: `Bàn ${clean}` }))
                    : hasRealTable
                      ? formatTableWithPrefix(String(o.table_id), (clean) => t('kds.tablePrefix', { table: clean, defaultValue: `Bàn ${clean}` }))
                      : t('kds.togo', 'Mang đi');
            const createdMs = parseKdsTimestampMs(o.created_at);
            const timeLabel = Number.isFinite(createdMs)
              ? new Date(createdMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
              : o.created_at;
            const cleanNotes = stripInternalOrderTags(o.notes);
            const statusLabel = t(`orderMgmt.${o.status}`, { defaultValue: o.status });
            return (
              <div key={o.id} style={{ ...orderCard, borderLeft: `4px solid ${orderStatusColor(o.status)}` }}>
                <div style={orderHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#93C5FD' }}>
                      {displayCode}
                    </span>
                    <span style={orderTable}>{originLabel}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.08)',
                        color: orderStatusColor(o.status),
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <span style={orderTime}>{timeLabel}</span>
                </div>
                {(o.customer_name || o.payment_status) && (
                  <div style={{ fontSize: 12, color: 'var(--md-sys-color-on-surface-variant, #9CA3AF)', marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {o.customer_name && <span>{o.customer_name}</span>}
                    {o.payment_method && (
                      <span>
                        · {t(`orderMgmt.paymentMethod.${o.payment_method}`, { defaultValue: o.payment_method.toUpperCase() })}
                        {o.payment_status ? ` (${t(`orderMgmt.paymentStatus.${o.payment_status}`, { defaultValue: o.payment_status })})` : ''}
                      </span>
                    )}
                  </div>
                )}
                {o.items.map((item, idx) => {
                  const rawMods = (item as unknown as { modifiers?: Array<string | { name?: string }> }).modifiers;
                  const modStr = Array.isArray(rawMods)
                    ? rawMods
                        .map((m) => (typeof m === 'string' ? m : m?.name || ''))
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
                {cleanNotes && (
                  <div style={{ marginTop: 6, fontSize: 12, fontStyle: 'italic', color: '#FCD34D' }}>
                    {t('kds.orderNotes', 'Ghi chú đơn')}: {cleanNotes}
                  </div>
                )}
                {o.status === 'ready' && orderType !== 'delivery' && canServeReadyOrder && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      disabled={servingId === o.id}
                      onClick={() => { void handleMarkServed(o); }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#10B981',
                        color: '#052E16',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: servingId === o.id ? 'not-allowed' : 'pointer',
                        opacity: servingId === o.id ? 0.6 : 1,
                      }}
                    >
                      {servingId === o.id
                        ? t('kds.updating', 'Đang cập nhật…')
                        : t('kds.served', 'Đã phục vụ')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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

      {canCreateMobileOrder && (
        <button
          style={fab}
          onClick={() => {
            setSelectedTableId('');
            setNewOrderItems([{ name: '', quantity: 1, price: 0, note: '' }]);
            setSubmitError(null);
            setShowNewOrder(true);
          }}
          aria-label="New order"
        >
          +
        </button>
      )}

      {submitError && (
        <div role="alert" style={{ padding: '8px 12px', margin: '8px 16px', borderRadius: 8, background: 'rgba(220,53,69,0.15)', color: '#ff6b6b', fontSize: 12 }}>
          {submitError}
        </div>
      )}

      {showNewOrder && (
        <NewOrderModal
          tables={tables}
          menuItems={menuItems}
          selectedTableId={selectedTableId}
          setSelectedTableId={setSelectedTableId}
          newOrderItems={newOrderItems}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
          submitting={submitting}
          submitError={submitError}
          submitOrder={submitOrder}
          onClose={() => setShowNewOrder(false)}
        />
      )}
    </div>
  );
}
