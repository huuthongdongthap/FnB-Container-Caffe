'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { API_BASE } from '@/lib/api-client';
import { KitchenOrder } from './kitchen-display-types';
import KitchenOrderCard from './kitchen-display-order-card';
import {
  wrap, header, title, empty, kdsGrid, countRow,
  countBadge, retryBtn,
} from './kitchen-display-styles';

export default function KitchenDisplay() {
  const { token, user } = useMobileAuth();
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
          <KitchenOrderCard
            key={order.id}
            order={order}
            updatingId={updatingId}
            onStatusChange={updateStatus}
          />
        ))}
      </div>
    </div>
  );
}
