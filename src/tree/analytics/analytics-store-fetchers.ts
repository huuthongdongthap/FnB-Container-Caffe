import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';
import type { AnalyticsState, AnalyticsData, AnalyticsGroupRow } from './analytics-store-types';
import { buildBaseParams } from './analytics-store-utils';

/* ─── Shared auth + fetch helpers ───────────────────────────────────── */

type SetFn = (partial: Partial<AnalyticsState>) => void;
type GetFn = () => AnalyticsState;

function getToken(set: SetFn): string | null {
  const token = useAuthStore.getState().token;
  if (!token) {
    set({ error: 'Chưa đăng nhập', loading: false });
    return null;
  }
  return token;
}

function nextRequestId(get: GetFn, set: SetFn): number {
  const requestId = get()._requestId + 1;
  set({ loading: true, error: null, _requestId: requestId });
  return requestId;
}

function isStale(get: GetFn, requestId: number): boolean {
  return get()._requestId !== requestId;
}

function handleAuthError(set: SetFn): void {
  useAuthStore.getState().logout();
  set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
}

function handleFetchError(
  err: unknown,
  get: GetFn,
  set: SetFn,
  requestId: number,
): void {
  if (isStale(get, requestId)) return;
  set({
    loading: false,
    error: err instanceof Error ? err.message : 'Lỗi kết nối',
  });
}

/* ─── Fetch main sales data ─────────────────────────────────────────── */

export async function fetchSales(get: GetFn, set: SetFn): Promise<void> {
  const token = getToken(set);
  if (!token) return;

  const requestId = nextRequestId(get, set);

  try {
    const params = buildBaseParams(get());
    const res = await fetch(`${API_BASE}/api/admin/metrics?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (isStale(get, requestId)) return;

    if (res.status === 401) {
      handleAuthError(set);
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (isStale(get, requestId)) return;
      set({ loading: false, error: body.error || 'Không thể tải dữ liệu doanh thu' });
      return;
    }

    const json: AnalyticsData = await res.json();
    if (isStale(get, requestId)) return;
    set({ data: json, loading: false, error: null });
  } catch (err) {
    handleFetchError(err, get, set, requestId);
  }
}

/* ─── Fetch comparison period data ───────────────────────────────────── */

export async function fetchComparison(get: GetFn, set: SetFn): Promise<void> {
  if (!get().compareMode) return;

  const token = getToken(set);
  if (!token) return;

  const requestId = nextRequestId(get, set);

  try {
    const params = buildBaseParams(get());
    params.set('compare', 'true');
    const res = await fetch(`${API_BASE}/api/admin/metrics?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (isStale(get, requestId)) return;

    if (res.status === 401) {
      handleAuthError(set);
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (isStale(get, requestId)) return;
      set({ loading: false, error: body.error || 'Không thể tải dữ liệu so sánh' });
      return;
    }

    const json: AnalyticsData = await res.json();
    if (isStale(get, requestId)) return;

    // Merge comparison data into current data
    const prev = get().data;
    set({
      data: prev
        ? { ...prev, previous: json.current }
        : { current: json.current, previous: null, groups: json.groups },
      loading: false,
      error: null,
    });
  } catch (err) {
    handleFetchError(err, get, set, requestId);
  }
}

/* ─── Fetch grouped analytics data ───────────────────────────────────── */

export async function fetchGroups(get: GetFn, set: SetFn): Promise<void> {
  const groupBy = get().groupBy;
  if (!groupBy) return;

  const token = getToken(set);
  if (!token) return;

  const requestId = nextRequestId(get, set);

  try {
    const params = buildBaseParams(get());
    params.set('group', groupBy);
    const res = await fetch(`${API_BASE}/api/admin/metrics?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (isStale(get, requestId)) return;

    if (res.status === 401) {
      handleAuthError(set);
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (isStale(get, requestId)) return;
      set({ loading: false, error: body.error || 'Không thể tải dữ liệu nhóm' });
      return;
    }

    const json: { groups: AnalyticsGroupRow[] } = await res.json();
    if (isStale(get, requestId)) return;

    const prev = get().data;
    const period = get().period;
    set({
      data: prev ? { ...prev, groups: json.groups } : {
        current: {
          revenue: 0,
          orders: 0,
          avg_order_value: 0,
          total_products: 0,
          total_customers: 0,
          period,
          start: '',
          end: '',
        },
        previous: null,
        groups: json.groups,
      },
      loading: false,
      error: null,
    });
  } catch (err) {
    handleFetchError(err, get, set, requestId);
  }
}
