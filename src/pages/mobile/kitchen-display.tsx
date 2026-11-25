'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { formatTableWithPrefix } from '@/hooks/kds-order';
import { OVERDUE_THRESHOLD_MIN, WARNING_THRESHOLD_MIN, MAX_METRIC_AGE_SECONDS, parseKdsTimestampMs } from '@/pages/kds-types';
import { isSameSessionSnapshot, readSessionSnapshot, subscribeSessionChange } from '@/lib/client-session';
import { KitchenOrder, KitchenStation } from './kitchen-display-types';
import KitchenOrderCard from './kitchen-display-order-card';
import {
  wrap, header, title, empty, kdsGrid, countRow,
  countBadge, retryBtn,
} from './kitchen-display-styles';

/* ── Station filter config ── */
const DEFAULT_STATIONS: { key: KitchenStation; labelKey: string; defaultLabel: string; emoji: string }[] = [
  { key: 'all', labelKey: 'kds.mobileAll', defaultLabel: 'Tất cả', emoji: '📋' },
  { key: 'espresso', labelKey: 'kds.mobileEspresso', defaultLabel: 'Espresso', emoji: '☕' },
  { key: 'cold', labelKey: 'kds.mobileCold', defaultLabel: 'Đồ lạnh', emoji: '🧊' },
  { key: 'food', labelKey: 'kds.mobileFood', defaultLabel: 'Đồ ăn', emoji: '🍽️' },
  { key: 'pastry', labelKey: 'kds.mobilePastry', defaultLabel: 'Bánh', emoji: '🥐' },
];

const STATION_KEYWORDS: Record<'cold' | 'espresso' | 'food' | 'pastry', string[]> = {
  cold: ['sinh tố', 'smoothie', 'nước ép', 'juice', 'soda', 'frappe', 'cold brew', 'iced', 'đá', 'ice', 'trà', 'tea', 'matcha'],
  espresso: ['cà phê', 'coffee', 'espresso', 'latte', 'cappuccino', 'mocha', 'americano', 'macchiato'],
  food: ['bánh mì', 'sandwich', 'mì', 'phở', 'cơm', 'rice', 'noodle', 'salad', 'snack'],
  pastry: ['bánh', 'pastry', 'croissant', 'cookie', 'cake', 'tiramisu', 'brownie'],
};

export function deriveItemStation(
  item: KitchenOrder['items'][number] & { product_name?: string },
  categoryStationMap?: ReadonlyMap<string, string>,
): KitchenStation | null {
  if (item.station && item.station !== 'all') return item.station;
  const catId = String(item.category_id ?? item.categoryId ?? '').trim();
  if (catId && categoryStationMap?.has(catId)) {
    return categoryStationMap.get(catId)!;
  }
  const itemName = (item.name || item.product_name || '').toLowerCase();
  const isExplicitlyHot = /\b(hot|nóng)\b/i.test(itemName) && !/\b(iced|ice|đá)\b/i.test(itemName);
  if (isExplicitlyHot && (itemName.includes('trà') || itemName.includes('tea') || itemName.includes('matcha'))) {
    return 'espresso';
  }
  // Evaluate cold drinks before espresso so iced tea / iced matcha latte never misroute to espresso
  for (const station of ['cold', 'espresso', 'food', 'pastry'] as const) {
    if (STATION_KEYWORDS[station].some((kw) => itemName.includes(kw))) {
      return station;
    }
  }
  return null;
}

function deriveStation(
  order: KitchenOrder,
  categoryStationMap?: ReadonlyMap<string, string>,
): KitchenStation {
  if (order.station && order.station !== 'all') return order.station;
  for (const rawItem of order.items) {
    const matched = deriveItemStation(rawItem as KitchenOrder['items'][number] & { product_name?: string }, categoryStationMap);
    if (matched) return matched;
  }
  return 'espresso';
}

function orderMatchesStation(
  order: KitchenOrder,
  station: KitchenStation,
  categoryStationMap?: ReadonlyMap<string, string>,
): boolean {
  if (station === 'all') return true;
  if (order.station && order.station !== 'all') return order.station === station;
  const matchedStations = order.items
    .map((raw) => deriveItemStation(raw as KitchenOrder['items'][number] & { product_name?: string }, categoryStationMap))
    .filter((s): s is KitchenStation => s !== null);
  if (matchedStations.length === 0) {
    return categoryStationMap && categoryStationMap.size > 0
      ? false
      : deriveStation(order, categoryStationMap) === station;
  }
  return matchedStations.includes(station);
}

export function sortMobileKdsOrders(orders: readonly KitchenOrder[], nowMs: number = Date.now()): KitchenOrder[] {
  const rankOf = (o: KitchenOrder): number => {
    if (o.status === 'ready') return 4;
    const createdMs = parseKdsTimestampMs(o.created_at);
    const elapsedSec = Number.isFinite(createdMs) ? Math.max(0, Math.floor((nowMs - createdMs) / 1000)) : 0;
    const isOverdue = elapsedSec >= OVERDUE_THRESHOLD_MIN * 60;
    const isWarning = !isOverdue && elapsedSec >= WARNING_THRESHOLD_MIN * 60;
    if (isOverdue) {
      return o.status === 'preparing' ? 1 : 0;
    }
    if (isWarning) return 2;
    return 3;
  };

  return [...orders].sort((a, b) => {
    const rDiff = rankOf(a) - rankOf(b);
    if (rDiff !== 0) return rDiff;
    if (a.status === 'ready' && b.status === 'ready') {
      const aReadyMs = parseKdsTimestampMs(a.ready_at ?? a.updated_at ?? a.created_at);
      const bReadyMs = parseKdsTimestampMs(b.ready_at ?? b.updated_at ?? b.created_at);
      return (Number.isFinite(aReadyMs) ? aReadyMs : 0) - (Number.isFinite(bReadyMs) ? bReadyMs : 0);
    }
    const aCreated = parseKdsTimestampMs(a.created_at);
    const bCreated = parseKdsTimestampMs(b.created_at);
    return (Number.isFinite(aCreated) ? aCreated : 0) - (Number.isFinite(bCreated) ? bCreated : 0);
  });
}

const STATION_COLORS: Record<string, string> = {
  all: '#C9D6DF',
  espresso: '#FBBF24',
  food: '#4ADE80',
  pastry: '#FB923C',
  cold: '#60A5FA',
};

interface ApiStationDto {
  id: string;
  name: string;
  slug?: string;
  active?: number | boolean;
  categories?: string[];
}

export default function KitchenDisplay() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState<Record<string, boolean>>({});
  const [mutationErrors, setMutationErrors] = useState<
    Record<string, { message: string; targetStatus: KitchenOrder['status'] }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [activeStation, setActiveStation] = useState<KitchenStation>('all');
  const [apiStations, setApiStations] = useState<ApiStationDto[]>([]);
  const [categoryStationMap, setCategoryStationMap] = useState<Map<string, string>>(() => new Map());
  const [showStaleGroup, setShowStaleGroup] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftStatusMsg, setShiftStatusMsg] = useState<string | null>(null);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<string | undefined>(() => readSessionSnapshot().role);
  const [dismissedCancelledIds, setDismissedCancelledIds] = useState<Set<string>>(() => new Set());
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(new Set<string>());

  const fetchStations = useCallback(async () => {
    if (!readSessionSnapshot().token) return;
    try {
      const res = await apiFetch<{
        stations?: ApiStationDto[];
        data?: ApiStationDto[];
        category_mappings?: Array<{ category_id?: string; station_id?: string }>;
      }>('/api/kitchen-stations');
      const list = Array.isArray(res?.stations)
        ? res.stations
        : Array.isArray(res?.data)
          ? res.data
          : [];
      const activeList = list.filter((s) => Boolean(s?.id && s?.name) && s.active !== 0 && s.active !== false);
      if (activeList.length > 0) {
        setApiStations(activeList);
      }
      if (Array.isArray(res?.category_mappings)) {
        const nextMap = new Map<string, string>();
        for (const m of res.category_mappings) {
          if (m?.category_id && m?.station_id) {
            nextMap.set(String(m.category_id), String(m.station_id));
          }
        }
        setCategoryStationMap(nextMap);
      }
    } catch {
      // Fall back to built-in stations when unconfigured
    }
  }, []);

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
        setError(t('kds.loadError', 'Không thể tải danh sách đơn hàng'));
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
      setError(t('kds.loadError', 'Không thể tải danh sách đơn hàng'));
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchOrders();
    void fetchStations();
    pollRef.current = setInterval(() => {
      void fetchOrders();
    }, 5000);
    const unsubscribeSession = subscribeSessionChange((next) => {
      abortRef.current?.abort();
      setSessionRole(next.role);
      setOrders([]);
      setError(null);
      inFlightRef.current.clear();
      setPendingOrders({});
      setMutationErrors({});
      setDismissedCancelledIds(new Set());
      setLoading(true);
      void fetchOrders();
      void fetchStations();
    });
    return () => {
      unsubscribeSession();
      if (pollRef.current) clearInterval(pollRef.current);
      abortRef.current?.abort();
    };
  }, [fetchOrders, fetchStations]);

  const updateStatus = useCallback(async (orderId: string, status: KitchenOrder['status']) => {
    if (inFlightRef.current.has(orderId)) return;
    const snap = readSessionSnapshot();
    inFlightRef.current.add(orderId);
    setPendingOrders((prev) => ({ ...prev, [orderId]: true }));
    setMutationErrors((prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    try {
      await apiFetch(`/mobile/kds/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      const nowIso = new Date().toISOString();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status,
                ...(status === 'preparing' ? { started_at: o.started_at ?? nowIso } : {}),
                ...(status === 'ready' ? { ready_at: o.ready_at ?? nowIso } : {}),
              }
            : o,
        ),
      );
      void fetchOrders();
    } catch (err) {
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Không thể cập nhật trạng thái đơn';
      setMutationErrors((prev) => ({
        ...prev,
        [orderId]: { message, targetStatus: status },
      }));
    } finally {
      inFlightRef.current.delete(orderId);
      if (isSameSessionSnapshot(snap, readSessionSnapshot())) {
        setPendingOrders((prev) => ({ ...prev, [orderId]: false }));
      }
    }
  }, [fetchOrders]);

  const handleItemReady = useCallback(async (orderId: string, itemIndex: number) => {
    const snap = readSessionSnapshot();
    try {
      const res = await apiFetch<{ success: boolean; all_items_ready?: boolean; order_status?: KitchenOrder['status'] }>(
        `/mobile/kds/orders/${encodeURIComponent(orderId)}/ready`,
        {
          method: 'POST',
          body: JSON.stringify({ itemIndex }),
        },
      );
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      const nowIso = new Date().toISOString();
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const nextItems = o.items.map((it, idx) =>
            idx === itemIndex ? { ...it, ready: true, status: 'ready', ready_at: nowIso } : it,
          );
          const nextStatus = res?.order_status ?? (res?.all_items_ready ? 'ready' : o.status);
          return {
            ...o,
            items: nextItems,
            status: nextStatus,
            ...(nextStatus === 'ready' ? { ready_at: o.ready_at ?? nowIso } : {}),
          };
        }),
      );
      void fetchOrders();
    } catch {
      // Non-fatal; next poll reconciles
    }
  }, [fetchOrders]);

  const openShiftDialog = useCallback(async () => {
    setShowShiftModal(true);
    setShiftStatusMsg(null);
    const snap = readSessionSnapshot();
    try {
      const res = await apiFetch<{ shifts?: Array<{ id: string; staff_id?: string; status?: string; clock_out?: string | null }> }>('/api/shifts/today');
      const list = Array.isArray(res?.shifts) ? res.shifts : [];
      const mine = list.find(
        (s) => (!snap.userId || s.staff_id === snap.userId) && s.status !== 'closed' && !s.clock_out,
      );
      setActiveShiftId(mine?.id ?? null);
    } catch {
      setActiveShiftId(null);
    }
  }, []);

  const handleClockAction = useCallback(async (mode: 'in' | 'out') => {
    setShiftBusy(true);
    setShiftStatusMsg(null);
    const snap = readSessionSnapshot();
    try {
      if (mode === 'in') {
        const res = await apiFetch<{ shift?: { id?: string } }>('/api/shifts/clock-in', {
          method: 'POST',
          body: JSON.stringify({ ...(snap.userId ? { staff_id: snap.userId } : {}) }),
        });
        setActiveShiftId(res?.shift?.id ?? 'open');
        setShiftStatusMsg(t('kds.clockInSuccess', 'Đã chấm công vào ca'));
      } else {
        await apiFetch('/api/shifts/clock-out', {
          method: 'POST',
          body: JSON.stringify({ ...(snap.userId ? { staff_id: snap.userId } : {}) }),
        });
        setActiveShiftId(null);
        setShiftStatusMsg(t('kds.clockOutSuccess', 'Đã kết ca'));
      }
    } catch (err) {
      setShiftStatusMsg(err instanceof Error ? err.message : t('kds.updateFailed', 'Không thể cập nhật'));
    } finally {
      setShiftBusy(false);
    }
  }, [t]);

  const stations = useMemo(() => {
    if (apiStations.length === 0) return DEFAULT_STATIONS;
    return [
      { key: 'all' as KitchenStation, labelKey: 'kds.mobileAll', defaultLabel: 'Tất cả', emoji: '📋' },
      ...apiStations.map((s) => ({
        key: s.id as KitchenStation,
        labelKey: `kds.stationName.${s.id}`,
        defaultLabel: s.name,
        emoji: '🍳',
      })),
    ];
  }, [apiStations]);

  const cancelledOrders = orders.filter(
    (o) => o.status === 'cancelled' && !dismissedCancelledIds.has(o.id),
  );
  const activeOrders = orders.filter((o) => o.status !== 'served' && o.status !== 'cancelled');
  const stationFiltered = activeStation === 'all'
    ? activeOrders
    : activeOrders.filter((o) => orderMatchesStation(o, activeStation, categoryStationMap));

  const nowMs = Date.now();
  const currentShiftOrders: KitchenOrder[] = [];
  const staleOrders: KitchenOrder[] = [];
  for (const o of stationFiltered) {
    const createdMs = parseKdsTimestampMs(o.created_at);
    const ageSec = Number.isFinite(createdMs) ? Math.max(0, Math.floor((nowMs - createdMs) / 1000)) : 0;
    if (ageSec > MAX_METRIC_AGE_SECONDS) {
      staleOrders.push(o);
    } else {
      currentShiftOrders.push(o);
    }
  }
  const filteredOrders = sortMobileKdsOrders(currentShiftOrders, nowMs);
  const sortedStaleOrders = sortMobileKdsOrders(staleOrders, nowMs);

  const pendingCount = currentShiftOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
  const preparingCount = currentShiftOrders.filter((o) => o.status === 'preparing').length;

  // Count orders per station for badges
  const stationCounts = stations.reduce((acc, s) => {
    acc[s.key] = s.key === 'all'
      ? activeOrders.length
      : activeOrders.filter((o) => orderMatchesStation(o, s.key, categoryStationMap)).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={wrap}>
      <div style={header}>
        <h1 style={title}>{t('kds.kdsScreen', 'KDS Bếp')}</h1>
        <div style={countRow}>
          <span style={{ ...countBadge, background: 'rgba(245, 158, 11, 0.2)', color: '#FCD34D' }}>
            {pendingCount} {t('kds.pendingShort', 'chờ')}
          </span>
          <span style={{ ...countBadge, background: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD' }}>
            {preparingCount} {t('kds.preparingShort', 'làm')}
          </span>
          <button
            type="button"
            onClick={() => { void openShiftDialog(); }}
            style={{
              ...countBadge,
              border: '1px solid rgba(201, 214, 223, 0.3)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#E8EEF3',
              cursor: 'pointer',
            }}
          >
            {t('kds.shiftAttendance', 'Ca trực')}
          </button>
        </div>
      </div>

      {/* Station filter tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', overflowX: 'auto' }}>
        {stations.map((s) => {
          const isActive = activeStation === s.key;
          const count = stationCounts[s.key] ?? 0;
          const tabColor = STATION_COLORS[s.key] ?? '#C9D6DF';
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveStation(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${isActive ? tabColor : 'var(--md-sys-color-outline-variant)'}`,
                background: isActive ? `${tabColor}22` : 'transparent',
                color: isActive ? tabColor : 'var(--md-sys-color-on-surface-variant)',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              <span>{s.emoji}</span>
              <span>{t(s.labelKey, s.defaultLabel)}</span>
              {count > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  background: isActive ? tabColor : 'var(--aura-noir-steel)',
                  color: isActive ? 'var(--aura-noir-void)' : 'var(--md-sys-color-on-surface)',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {cancelledOrders.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            margin: '10px 14px 0',
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.18)',
            border: '2px solid rgba(239, 68, 68, 0.7)',
            borderRadius: 10,
            color: '#FECACA',
            fontSize: 13,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('kds.cancelledBanner', {
                count: cancelledOrders.length,
                defaultValue: `ĐÃ HỦY — DỪNG PHA CHẾ (${cancelledOrders.length})`,
              })}
            </div>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
              {cancelledOrders.map((c) => {
                const label = c.order_type === 'delivery'
                  ? t('kds.delivery', 'Giao hàng')
                  : c.table_name
                    ? formatTableWithPrefix(c.table_name, (clean) =>
                        t('kds.tablePrefix', { table: clean, defaultValue: `Bàn ${clean}` }),
                      )
                    : t('kds.togo', 'Mang đi');
                const displayId = c.order_number ? c.order_number.replace(/^#/, '') : c.id.slice(-4);
                return (
                  <span key={c.id} style={{ textDecoration: 'line-through' }}>
                    #{displayId} ({label}): {c.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setDismissedCancelledIds((prev) => {
                const next = new Set(prev);
                for (const c of cancelledOrders) next.add(c.id);
                return next;
              })
            }
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(254, 202, 202, 0.5)',
              background: 'transparent',
              color: '#FECACA',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            {t('kds.dismiss', 'Đã hiểu')}
          </button>
        </div>
      )}

      {error && (
        <div style={{ margin: '10px 14px 0', padding: '10px 14px', background: 'rgba(239, 83, 80, 0.15)', border: '1px solid rgba(239, 83, 80, 0.4)', borderRadius: 10, color: '#FFB4AB', fontSize: 13 }}>
          {error}
          <button onClick={fetchOrders} style={retryBtn}>{t('common.retry', 'Thử lại')}</button>
        </div>
      )}

      {loading && activeOrders.length === 0 && <div style={empty}>{t('terminal.loading', 'Đang tải...')}</div>}

      {activeOrders.length === 0 && !loading && (
        <div style={empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🍳</div>
          <div>{t('kds.mobileNoOrders', 'Không có đơn hàng nào đang chờ')}</div>
        </div>
      )}

      {activeOrders.length > 0 && stationFiltered.length === 0 && !loading && (
        <div style={empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
          <div>{t('kds.mobileNoOrdersStation', 'Không có đơn nào cho trạm này')}</div>
        </div>
      )}

      <div style={kdsGrid}>
        {filteredOrders.map((order) => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            userRole={sessionRole}
            updatingId={pendingOrders[order.id] ? order.id : null}
            mutationError={mutationErrors[order.id]?.message}
            onRetry={
              mutationErrors[order.id]
                ? () => updateStatus(order.id, mutationErrors[order.id]!.targetStatus)
                : undefined
            }
            onItemReady={handleItemReady}
            onStatusChange={updateStatus}
          />
        ))}
      </div>

      {sortedStaleOrders.length > 0 && (
        <div style={{ margin: '4px 14px 18px' }}>
          <button
            type="button"
            onClick={() => setShowStaleGroup((prev) => !prev)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(251, 191, 36, 0.3)',
              background: 'rgba(251, 191, 36, 0.08)',
              color: '#FCD34D',
              fontSize: 12,
              fontWeight: 700,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {t('kds.staleSectionTitle', {
              count: sortedStaleOrders.length,
              defaultValue: `Đơn tồn ca trước (> 24h) (${sortedStaleOrders.length})`,
            })}{' '}
            {showStaleGroup ? '▲' : '▼'}
          </button>
          {showStaleGroup && (
            <div style={{ ...kdsGrid, padding: '10px 0 0' }}>
              {sortedStaleOrders.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  userRole={sessionRole}
                  updatingId={pendingOrders[order.id] ? order.id : null}
                  mutationError={mutationErrors[order.id]?.message}
                  onRetry={
                    mutationErrors[order.id]
                      ? () => updateStatus(order.id, mutationErrors[order.id]!.targetStatus)
                      : undefined
                  }
                  onItemReady={handleItemReady}
                  onStatusChange={updateStatus}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showShiftModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('kds.shiftAttendance', 'Ca trực')}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ width: '100%', maxWidth: 340, background: '#0A1A2E', borderRadius: 14, border: '1px solid rgba(201,214,223,0.2)', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>{t('kds.shiftAttendance', 'Ca trực & Chấm công')}</strong>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                style={{ background: 'none', border: 'none', color: '#C9D6DF', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            {shiftStatusMsg && (
              <div style={{ marginBottom: 12, fontSize: 12, color: '#93C5FD' }}>{shiftStatusMsg}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={shiftBusy || Boolean(activeShiftId)}
                onClick={() => { void handleClockAction('in'); }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#10B981',
                  color: '#052E16',
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: shiftBusy || activeShiftId ? 0.5 : 1,
                  cursor: shiftBusy || activeShiftId ? 'not-allowed' : 'pointer',
                }}
              >
                {t('kds.clockIn', 'Vào ca')}
              </button>
              <button
                type="button"
                disabled={shiftBusy || !activeShiftId}
                onClick={() => { void handleClockAction('out'); }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(248,113,113,0.5)',
                  background: 'rgba(239,68,68,0.18)',
                  color: '#FCA5A5',
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: shiftBusy || !activeShiftId ? 0.5 : 1,
                  cursor: shiftBusy || !activeShiftId ? 'not-allowed' : 'pointer',
                }}
              >
                {t('kds.clockOut', 'Kết ca')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
