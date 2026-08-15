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
    const requestId = get()._vitalsRequestId + 1;
    set({ vitalsLoading: true, vitalsError: null, _vitalsRequestId: requestId });
    try {
      const json: WebVitalsResponse = await apiFetch('/api/admin/metrics?filter=web_vital_*&range=7d');
      if (get()._vitalsRequestId !== requestId) return;
      set({ webVitals: json, vitalsLoading: false, vitalsError: null });
    } catch (err) {
      if (get()._vitalsRequestId !== requestId) return;
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      if (message.includes('Session expired')) {
        useAuthStore.getState().logout();
      }
      set({ vitalsLoading: false, vitalsError: message });
    }
  },

  fetchAPILatency: async () => {
    const requestId = get()._latencyRequestId + 1;
    set({ latencyLoading: true, latencyError: null, _latencyRequestId: requestId });
    try {
      const json: APILatencyResponse = await apiFetch('/api/admin/metrics?filter=request_duration_ms&range=7d');
      if (get()._latencyRequestId !== requestId) return;
      set({ apiLatency: json, latencyLoading: false, latencyError: null });
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
