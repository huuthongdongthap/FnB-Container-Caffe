import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   Performance store — fetches /api/admin/metrics?filter= for
   Web Vitals and API Latency data. Matches use-metrics-store pattern.
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

export interface WebVitalData {
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface WebVitalsResponse {
  vitals: Record<string, WebVitalData>;
  targets: Record<string, { good: number; poor: number }>;
}

export interface APILatencyResponse {
  p50: number;
  p95: number;
  p99: number;
  requestCounts: Array<{ date: string; count: number }>;
}

interface PerformanceState {
  webVitals: WebVitalsResponse | null;
  apiLatency: APILatencyResponse | null;
  vitalsLoading: boolean;
  latencyLoading: boolean;
  vitalsError: string | null;
  latencyError: string | null;
  _vitalsRequestId: number;
  _latencyRequestId: number;
  fetchWebVitals: () => Promise<void>;
  fetchAPILatency: () => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  webVitals: null,
  apiLatency: null,
  vitalsLoading: false,
  latencyLoading: false,
  vitalsError: null,
  latencyError: null,
  _vitalsRequestId: 0,
  _latencyRequestId: 0,

  fetchWebVitals: async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ vitalsError: 'Chưa đăng nhập', vitalsLoading: false });
      return;
    }

    const requestId = get()._vitalsRequestId + 1;
    set({ vitalsLoading: true, vitalsError: null, _vitalsRequestId: requestId });
    try {
      const res = await fetch(`${API_BASE}/api/admin/metrics?filter=web_vital_*&range=7d`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (get()._vitalsRequestId !== requestId) return;

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ vitalsLoading: false, vitalsError: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (get()._vitalsRequestId !== requestId) return;
        set({ vitalsLoading: false, vitalsError: body.error || 'Không thể tải Web Vitals' });
        return;
      }

      const json: WebVitalsResponse = await res.json();
      if (get()._vitalsRequestId !== requestId) return;
      set({ webVitals: json, vitalsLoading: false, vitalsError: null });
    } catch (err) {
      if (get()._vitalsRequestId !== requestId) return;
      set({ vitalsLoading: false, vitalsError: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  fetchAPILatency: async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ latencyError: 'Chưa đăng nhập', latencyLoading: false });
      return;
    }

    const requestId = get()._latencyRequestId + 1;
    set({ latencyLoading: true, latencyError: null, _latencyRequestId: requestId });
    try {
      const res = await fetch(`${API_BASE}/api/admin/metrics?filter=request_duration_ms&range=7d`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (get()._latencyRequestId !== requestId) return;

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ latencyLoading: false, latencyError: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (get()._latencyRequestId !== requestId) return;
        set({ latencyLoading: false, latencyError: body.error || 'Không thể tải API Latency' });
        return;
      }

      const json: APILatencyResponse = await res.json();
      if (get()._latencyRequestId !== requestId) return;
      set({ apiLatency: json, latencyLoading: false, latencyError: null });
    } catch (err) {
      if (get()._latencyRequestId !== requestId) return;
      set({ latencyLoading: false, latencyError: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
