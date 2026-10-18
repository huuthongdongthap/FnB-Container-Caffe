import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   Performance store — fetches /api/admin/metrics?filter= for
   Web Vitals and API Latency data. Matches use-metrics-store pattern.
   Auth via httpOnly cookie (no manual token injection).
   ═══════════════════════════════════════════════════════════════════ */


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

export type PerformanceRange = '24h' | '7d' | '30d';

interface PerformanceState {
  range: PerformanceRange;
  webVitals: WebVitalsResponse | null;
  apiLatency: APILatencyResponse | null;
  vitalsLoading: boolean;
  latencyLoading: boolean;
  vitalsError: string | null;
  latencyError: string | null;
  _vitalsRequestId: number;
  _latencyRequestId: number;
  setRange: (range: PerformanceRange) => void;
  fetchWebVitals: (range?: PerformanceRange) => Promise<void>;
  fetchAPILatency: (range?: PerformanceRange) => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  range: '7d',
  webVitals: null,
  apiLatency: null,
  vitalsLoading: false,
  latencyLoading: false,
  vitalsError: null,
  latencyError: null,
  _vitalsRequestId: 0,
  _latencyRequestId: 0,

  setRange: (range) => set({ range }),

  fetchWebVitals: async (range) => {
    const activeRange = range ?? get().range;
    const requestId = get()._vitalsRequestId + 1;
    set({ vitalsLoading: true, vitalsError: null, _vitalsRequestId: requestId, ...(range ? { range } : {}) });
    try {
      const json = await apiFetch<Partial<WebVitalsResponse> & { metrics?: Array<{ name?: string; count?: number }> }>(
        `/api/admin/metrics?filter=web_vital_*&range=${encodeURIComponent(activeRange)}`,
      );
      if (get()._vitalsRequestId !== requestId) return;
      const fallbackVitals: Record<string, WebVitalData> = {};
      if (!json.vitals && Array.isArray(json.metrics)) {
        for (const m of json.metrics) {
          const metricName = String(m.name || '').replace(/^web_vital_/, '');
          if (metricName) {
            fallbackVitals[metricName] = { good: Number(m.count ?? 0), needsImprovement: 0, poor: 0 };
          }
        }
      }
      set({
        webVitals: {
          vitals: json.vitals ?? fallbackVitals,
          targets: json.targets ?? {},
        },
        vitalsLoading: false,
        vitalsError: null,
      });
    } catch (err) {
      if (get()._vitalsRequestId !== requestId) return;
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      if (message.includes('Session expired')) {
        useAuthStore.getState().logout();
      }
      set({ vitalsLoading: false, vitalsError: message });
    }
  },

  fetchAPILatency: async (range) => {
    const activeRange = range ?? get().range;
    const requestId = get()._latencyRequestId + 1;
    set({ latencyLoading: true, latencyError: null, _latencyRequestId: requestId, ...(range ? { range } : {}) });
    try {
      const json = await apiFetch<Partial<APILatencyResponse> & { latency?: { p50?: number; p95?: number; p99?: number } }>(
        `/api/admin/metrics?filter=request_duration_ms&range=${encodeURIComponent(activeRange)}`,
      );
      if (get()._latencyRequestId !== requestId) return;
      set({
        apiLatency: {
          p50: Number(json.p50 ?? json.latency?.p50 ?? 0),
          p95: Number(json.p95 ?? json.latency?.p95 ?? 0),
          p99: Number(json.p99 ?? json.latency?.p99 ?? json.p95 ?? json.latency?.p95 ?? 0),
          requestCounts: Array.isArray(json.requestCounts) ? json.requestCounts : [],
        },
        latencyLoading: false,
        latencyError: null,
      });
    } catch (err) {
      if (get()._latencyRequestId !== requestId) return;
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      if (message.includes('Session expired')) {
        useAuthStore.getState().logout();
      }
      set({ latencyLoading: false, latencyError: message });
    }
  },
}));
