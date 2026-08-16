'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { apiFetch } from '@/lib/api-client';
import { KitchenOrder, KitchenStation } from './kitchen-display-types';
import KitchenOrderCard from './kitchen-display-order-card';
import {
  wrap, header, title, empty, kdsGrid, countRow,
  countBadge, retryBtn,
} from './kitchen-display-styles';

/* ── Station filter config ── */
const STATIONS: { key: KitchenStation; label: string; emoji: string }[] = [
  { key: 'all', label: 'Tất cả', emoji: '📋' },
  { key: 'espresso', label: 'Espresso', emoji: '☕' },
  { key: 'food', label: 'Đồ ăn', emoji: '🍽️' },
  { key: 'pastry', label: 'Bánh', emoji: '🥐' },
  { key: 'cold', label: 'Đồ lạnh', emoji: '🧊' },
];

const STATION_KEYWORDS: Record<Exclude<KitchenStation, 'all'>, string[]> = {
  espresso: ['cà phê', 'coffee', 'espresso', 'latte', 'cappuccino', 'mocha', ' americano', 'macchiato', 'matcha', 'trà', 'tea'],
  food: ['bánh mì', 'sandwich', 'mì', 'phở', 'cơm', 'rice', 'noodle', 'salad', 'snack'],
  pastry: ['bánh', 'pastry', 'croissant', 'cookie', 'cake', 'tiramisu', 'brownie'],
  cold: ['sinh tố', 'smoothie', 'nước ép', 'juice', 'soda', 'frappe', 'đá', 'ice', 'cold brew'],
};

function deriveStation(order: KitchenOrder): KitchenStation {
  if (order.station && order.station !== 'all') return order.station;
  const firstItemName = order.items[0]?.name?.toLowerCase() ?? '';
  for (const [station, keywords] of Object.entries(STATION_KEYWORDS)) {
    if (keywords.some((kw) => firstItemName.includes(kw))) return station as KitchenStation;
  }
  return 'espresso'; // default
}

const STATION_COLORS: Record<KitchenStation, string> = {
  all: '#6b7280',
  espresso: '#92400e',
  food: '#166534',
  pastry: '#9a3412',
  cold: '#1e40af',
};

export default function KitchenDisplay() {
  const { token, user } = useMobileAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStation, setActiveStation] = useState<KitchenStation>('all');
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const body = (await apiFetch<{ success: boolean; orders: KitchenOrder[] }>('/mobile/kds/orders'));
      if (body.success) {
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
  }, []);

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(fetchOrders, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrders]);

  const updateStatus = useCallback(async (orderId: string, status: KitchenOrder['status']) => {
    setUpdatingId(orderId);
    try {
      await apiFetch(`/mobile/kds/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch { /* silent */ } finally { setUpdatingId(null); }
  }, []);

  const activeOrders = orders.filter((o) => o.status !== 'served');
  const filteredOrders = activeStation === 'all'
    ? activeOrders
    : activeOrders.filter((o) => deriveStation(o) === activeStation);
  const pendingCount = activeOrders.filter((o) => o.status === 'pending').length;
  const preparingCount = activeOrders.filter((o) => o.status === 'preparing').length;

  // Count orders per station for badges
  const stationCounts = STATIONS.reduce((acc, s) => {
    acc[s.key] = s.key === 'all' ? activeOrders.length : activeOrders.filter((o) => deriveStation(o) === s.key).length;
    return acc;
  }, {} as Record<KitchenStation, number>);

  return (
    <div style={wrap}>
      <div style={header}>
        <h1 style={title}>KDS / Bếp</h1>
        <div style={countRow}>
          <span style={{ ...countBadge, background: '#fef3c7', color: '#92400e' }}>{pendingCount} chờ</span>
          <span style={{ ...countBadge, background: '#dbeafe', color: '#1e40af' }}>{preparingCount} làm</span>
        </div>
      </div>

      {/* Station filter tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', overflowX: 'auto' }}>
        {STATIONS.map((s) => {
          const isActive = activeStation === s.key;
          const count = stationCounts[s.key] ?? 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveStation(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${isActive ? STATION_COLORS[s.key] : '#374151'}`,
                background: isActive ? `${STATION_COLORS[s.key]}22` : 'transparent',
                color: isActive ? STATION_COLORS[s.key] : '#9ca3af',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              {count > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  background: isActive ? STATION_COLORS[s.key] : '#4b5563',
                  color: '#fff',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
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

      {activeOrders.length > 0 && filteredOrders.length === 0 && !loading && (
        <div style={empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
          <div>Không có đơn cho trạm này / No orders for this station</div>
        </div>
      )}

      <div style={kdsGrid}>
        {filteredOrders.map((order) => (
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
