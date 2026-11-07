'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import { isSameSessionSnapshot, readSessionSnapshot, subscribeSessionChange } from '@/lib/client-session';
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
  espresso: ['cà phê', 'coffee', 'espresso', 'latte', 'cappuccino', 'mocha', 'americano', 'macchiato', 'matcha', 'trà', 'tea'],
  food: ['bánh mì', 'sandwich', 'mì', 'phở', 'cơm', 'rice', 'noodle', 'salad', 'snack'],
  pastry: ['bánh', 'pastry', 'croissant', 'cookie', 'cake', 'tiramisu', 'brownie'],
  cold: ['sinh tố', 'smoothie', 'nước ép', 'juice', 'soda', 'frappe', 'đá', 'ice', 'cold brew'],
};

function deriveItemStation(item: KitchenOrder['items'][number] & { product_name?: string }): KitchenStation | null {
  if (item.station && item.station !== 'all') return item.station;
  const itemName = (item.name || item.product_name || '').toLowerCase();
  for (const [station, keywords] of Object.entries(STATION_KEYWORDS)) {
    if (keywords.some((kw) => itemName.includes(kw))) return station as KitchenStation;
  }
  return null;
}

function deriveStation(order: KitchenOrder): KitchenStation {
  if (order.station && order.station !== 'all') return order.station;
  for (const rawItem of order.items) {
    const matched = deriveItemStation(rawItem as KitchenOrder['items'][number] & { product_name?: string });
    if (matched) return matched;
  }
  return 'espresso'; // default
}

function orderMatchesStation(order: KitchenOrder, station: KitchenStation): boolean {
  if (station === 'all') return true;
  if (order.station && order.station !== 'all') return order.station === station;
  const matchedStations = order.items
    .map((raw) => deriveItemStation(raw as KitchenOrder['items'][number] & { product_name?: string }))
    .filter((s): s is KitchenStation => s !== null);
  if (matchedStations.length === 0) return deriveStation(order) === station;
  return matchedStations.includes(station);
}

const STATION_COLORS: Record<KitchenStation, string> = {
  all: '#C9D6DF',
  espresso: '#FBBF24',
  food: '#4ADE80',
  pastry: '#FB923C',
  cold: '#60A5FA',
};

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStation, setActiveStation] = useState<KitchenStation>('all');
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const fetchOrders = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++requestSeqRef.current;
    const snap = readSessionSnapshot();

    try {
      setError(null);
      const body = await apiFetch<{ success: boolean; orders: KitchenOrder[] }>(
        '/mobile/kds/orders',
        { signal: controller.signal },
      );
      if (controller.signal.aborted || seq !== requestSeqRef.current || !isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      if (body.success) {
        setError(null);
        setOrders(body.orders);
        setLoading(false);
      } else {
        setError('Không thể tải đơn hàng / Failed to load orders');
        setLoading(false);
      }
    } catch (err) {
      if (
        controller.signal.aborted ||
        seq !== requestSeqRef.current ||
        !isSameSessionSnapshot(snap, readSessionSnapshot()) ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return;
      }
      setError('Không thể tải đơn hàng / Failed to load orders');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    pollRef.current = setInterval(() => {
      void fetchOrders();
    }, 10000);
    const unsubscribeSession = subscribeSessionChange(() => {
      abortRef.current?.abort();
      setOrders([]);
      setError(null);
      setUpdatingId(null);
      setLoading(true);
      void fetchOrders();
    });
    return () => {
      unsubscribeSession();
      if (pollRef.current) clearInterval(pollRef.current);
      abortRef.current?.abort();
    };
  }, [fetchOrders]);

  const updateStatus = useCallback(async (orderId: string, status: KitchenOrder['status']) => {
    const snap = readSessionSnapshot();
    setUpdatingId(orderId);
    try {
      await apiFetch(`/mobile/kds/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch { /* silent */ } finally { setUpdatingId(null); }
  }, []);

  const activeOrders = orders.filter((o) => o.status !== 'served');
  const filteredOrders = activeStation === 'all'
    ? activeOrders
    : activeOrders.filter((o) => orderMatchesStation(o, activeStation));
  const pendingCount = activeOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
  const preparingCount = activeOrders.filter((o) => o.status === 'preparing').length;

  // Count orders per station for badges
  const stationCounts = STATIONS.reduce((acc, s) => {
    acc[s.key] = s.key === 'all' ? activeOrders.length : activeOrders.filter((o) => orderMatchesStation(o, s.key)).length;
    return acc;
  }, {} as Record<KitchenStation, number>);

  return (
    <div style={wrap}>
      <div style={header}>
        <h1 style={title}>KDS / Bếp</h1>
        <div style={countRow}>
          <span style={{ ...countBadge, background: 'rgba(245, 158, 11, 0.2)', color: '#FCD34D' }}>{pendingCount} chờ</span>
          <span style={{ ...countBadge, background: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD' }}>{preparingCount} làm</span>
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
                border: `1.5px solid ${isActive ? STATION_COLORS[s.key] : 'var(--md-sys-color-outline-variant)'}`,
                background: isActive ? `${STATION_COLORS[s.key]}22` : 'transparent',
                color: isActive ? STATION_COLORS[s.key] : 'var(--md-sys-color-on-surface-variant)',
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
                  background: isActive ? STATION_COLORS[s.key] : 'var(--aura-noir-steel)',
                  color: isActive ? 'var(--aura-noir-void)' : 'var(--md-sys-color-on-surface)',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ margin: '10px 14px 0', padding: '10px 14px', background: 'rgba(239, 83, 80, 0.15)', border: '1px solid rgba(239, 83, 80, 0.4)', borderRadius: 10, color: '#FFB4AB', fontSize: 13 }}>
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
