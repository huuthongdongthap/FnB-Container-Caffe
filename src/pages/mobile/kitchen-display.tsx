'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { API_BASE } from '@/lib/api-client';

/* ── Types ────────────────────────────────────────────────────────── */

interface KitchenItem {
  name: string;
  quantity: number;
  modifiers?: string[];
  notes?: string;
}

interface KitchenOrder {
  id: string;
  table_name: string;
  items: KitchenItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served';
  created_at: string;
}

// Props removed in 260712-1200 — via useMobileAuth hook instead

/* ── Static styles (plain objects, CSSProperties-compatible) ─────── */

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Space Grotesk', sans-serif" };
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 };
const badge: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F97316', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' };
const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: 15, textAlign: 'center', padding: 24 };
const card: React.CSSProperties = { margin: '10px 14px 0', background: '#ffffff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' };
const cardHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 };
const tableName: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0 };
const time: React.CSSProperties = { fontSize: 12, color: '#9ca3af' };
const itemRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' };
const itemName: React.CSSProperties = { fontSize: 14, color: '#374151', flex: 1 };
const itemQty: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#F97316', minWidth: 28, textAlign: 'right' };
const itemModifier: React.CSSProperties = { fontSize: 12, color: '#6b7280' };
const actions: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 12 };
const btnStart: React.CSSProperties = { flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#3b82f6', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", transition: 'opacity 0.15s' };
const btnReady: React.CSSProperties = { flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#10b981', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", transition: 'opacity 0.15s' };
const kdsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: '14px 14px' };
const countRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 };
const countBadge: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12 };
const retryBtn: React.CSSProperties = { marginLeft: 10, fontSize: 12, fontWeight: 600, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', textDecoration: 'underline' };
const noOrderText: React.CSSProperties = { marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#10b981' };

/* ── Factory functions ──────────────────────────────────────────────*/

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  preparing: '#3b82f6',
  ready: '#10b981',
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; label: string }> = {
    pending: { bg: '#fef3c7', label: 'Chờ / Pending' },
    preparing: { bg: '#dbeafe', label: 'Đang làm / Preparing' },
    ready: { bg: '#d1fae5', label: 'Sẵn / Ready' },
  };
  const s = map[status] ?? { bg: '#f3f4f6', label: status };
  return { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: s.bg, color: '#374151', display: 'inline-block' };
}

function cardBorder(status: string): React.CSSProperties {
  const map: Record<string, string> = { pending: '#F97316', preparing: '#3b82f6', ready: '#10b981' };
  return { ...card, border: `2px solid ${map[status] ?? '#e5e7eb'}` };
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

/* ── Component ──────────────────────────────────────────────────────*/

export default function KitchenDisplay() {
  const { token, user } = useMobileAuth();
  const effectiveRole = user?.role || 'staff';
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/mobile/kds/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as { success: boolean; orders: KitchenOrder[] };
      if (res.ok && body.success) {
        setOrders(body.orders);
        setLoading(false);
      } else {
        setError('Không thể tải đơn hàng / Failed to load orders');
        setLoading(false);
      }
    } catch {
      setError('Lỗi kết nối / Connection error');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(fetchOrders, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrders]);

  const updateStatus = useCallback(async (orderId: string, status: KitchenOrder['status']) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/mobile/kds/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      }
    } catch { /* silent */ } finally { setUpdatingId(null); }
  }, [token]);

  const activeOrders = orders.filter((o) => o.status !== 'served');
  const pendingCount = activeOrders.filter((o) => o.status === 'pending').length;
  const preparingCount = activeOrders.filter((o) => o.status === 'preparing').length;

  return (
    <div style={wrap}>
      <div style={header}>
        <h1 style={title}>KDS / Bếp</h1>
        <div style={countRow}>
          <span style={{ ...countBadge, background: '#fef3c7', color: '#92400e' }}>{pendingCount} chờ</span>
          <span style={{ ...countBadge, background: '#dbeafe', color: '#1e40af' }}>{preparingCount} làm</span>
        </div>
      </div>

      {error && (
        <div style={{ margin: '10px 14px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>
          {error}
          <button onClick={fetchOrders} style={retryBtn}>Thử lại / Retry</button>
        </div>
      )}

      {loading && activeOrders.length === 0 && <div style={empty}>Đang tải... / Loading...</div>}

      {activeOrders.length === 0 && !loading && (
        <div style={empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🍳</div>
          <div>Không có đơn / No orders</div>
        </div>
      )}

      <div style={kdsGrid}>
        {activeOrders.map((order) => (
          <div key={order.id} style={cardBorder(order.status)}>
            <div style={cardHeader}>
              <h3 style={tableName}>Bàn {order.table_name}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={statusBadgeStyle(order.status)}>
                  {order.status === 'pending' ? 'Chờ' : order.status === 'preparing' ? 'Đang làm' : 'Sẵn'}
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
                  style={{ ...btnStart, opacity: updatingId === order.id ? 0.6 : 1 }}
                  disabled={updatingId === order.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateStatus(order.id, 'preparing')}
                >
                  Bắt đầu / Start
                </button>
              </div>
            )}

            {order.status === 'preparing' && (
              <div style={actions}>
                <button
                  style={{ ...btnReady, opacity: updatingId === order.id ? 0.6 : 1 }}
                  disabled={updatingId === order.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateStatus(order.id, 'ready')}
                >
                  Sẵn sàng / Ready
                </button>
              </div>
            )}

            {order.status === 'ready' && (
              <div style={noOrderText}>Đã sẵn sàng / Ready</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
