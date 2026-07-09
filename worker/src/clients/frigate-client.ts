/**
 * FrigateClient — REST client for Frigate NVR
 *
 * Feature-flag gated: activation is controlled by FRIGATE_SYNC_ENABLED env var.
 * When disabled or credentials missing, returns mock responses.
 *
 * @example
 * const client = createFrigateClient(env);
 * if (!client) return mockResponse;
 */

import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'frigate-client' });

export interface FrigateEnv {
  FRIGATE_URL?: string;
  FRIGATE_API_KEY?: string;
  FRIGATE_SYNC_ENABLED?: string;
}

export interface FrigateConfig {
  url: string;
  apiKey: string;
  isMock: boolean;
}

export interface FrigateEvent {
  id: string;
  camera: string;
  label: string;
  start_time: number;
  end_time?: number;
  score?: number;
  thumbnail?: string;
  data?: Record<string, unknown>;
}

export class FrigateClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isMock: boolean;

  constructor(config: FrigateConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.isMock = config.isMock;
  }

  getHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (this.apiKey) {
      h.Authorization = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  async getRecentEvents(camera?: string, limit = 10): Promise<{ mock?: boolean; events: FrigateEvent[] }> {
    if (this.isMock) {
      return this.mockEvents(camera, limit);
    }

    try {
      const qs = new URLSearchParams({ limit: String(limit), after: '0', before: String(Math.floor(Date.now() / 1000)) });
      if (camera) {
        qs.set('camera', camera);
      }

      const res = await fetch(`${this.baseUrl}/api/events?${qs.toString()}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as FrigateEvent[];
      return { events: Array.isArray(data) ? data : [] };
    } catch (err) {
      log.warn('frigate_getRecentEvents_failed', { error: (err as Error).message, camera });
      return this.mockEvents(camera, limit);
    }
  }

  async getEvent(eventId: string): Promise<{ mock?: boolean; event: FrigateEvent }> {
    if (this.isMock) {
      return { mock: true, event: { id: eventId, camera: 'mock', label: 'motion', start_time: Date.now() / 1000 } };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/events/${encodeURIComponent(eventId)}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as FrigateEvent;
      return { event: data };
    } catch (err) {
      log.warn('frigate_getEvent_failed', { eventId, error: (err as Error).message });
      return { event: { id: eventId, camera: '', label: '', start_time: 0 } };
    }
  }

  async getCameraSnap(camera: string): Promise<{ mock?: boolean; snapshotUrl: string }> {
    if (this.isMock) {
      return { mock: true, snapshotUrl: '' };
    }

    try {
      const snapshotUrl = `${this.baseUrl}/api/${encodeURIComponent(camera)}/latest.jpg`;
      // HEAD only to verify accessibility; the caller fetches the blob
      const res = await fetch(snapshotUrl, {
        method: 'HEAD',
        headers: this.getHeaders()
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return { snapshotUrl };
    } catch (err) {
      log.warn('frigate_getCameraSnap_failed', { camera, error: (err as Error).message });
      return { snapshotUrl: '' };
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private mockEvents(camera?: string, limit = 10): { mock: true; events: FrigateEvent[] } {
    const events: FrigateEvent[] = Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      id: `mock-frigate-${Date.now()}-${i}`,
      camera: camera ?? 'mock_camera',
      label: 'motion',
      start_time: Math.floor(Date.now() / 1000) - i * 60,
      score: 0.9
    }));
    return { mock: true, events };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createFrigateClient(env: FrigateEnv): FrigateClient | null {
  const enabled = env.FRIGATE_SYNC_ENABLED === 'true';
  if (!enabled) {
    return null;
  }

  const url = env.FRIGATE_URL;
  const apiKey = env.FRIGATE_API_KEY;
  if (!url) {
    log.warn('frigate_client_skipped', { reason: 'missing-credentials' });
    return null;
  }

  return new FrigateClient({
    url,
    apiKey: apiKey ?? '',
    isMock: false
  });
}

export default FrigateClient;
