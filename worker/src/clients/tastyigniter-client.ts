/**
 * TastyIgniterClient — REST client for TastyIgniter POS
 *
 * Feature-flag gated: activation is controlled by TASTYIGNITER_SYNC_ENABLED env var.
 * When disabled or credentials missing, returns mock responses.
 *
 * @example
 * const client = createTastyIgniterClient(env);
 * if (!client) return mockResponse;
 */

import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'tastyigniter-client' });

export interface TIEnv {
  TASTYIGNITER_URL?: string;
  TASTYIGNITER_API_KEY?: string;
  TASTYIGNITER_SYNC_ENABLED?: string;
}

export interface TIConfig {
  url: string;
  apiKey: string;
  isMock: boolean;
}

export class TastyIgniterClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isMock: boolean;

  constructor(config: TIConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.isMock = config.isMock;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  // ── Menu ───────────────────────────────────────────────────────────────────

  async getMenu(): Promise<{ mock?: boolean; menu: unknown[] }> {
    if (this.isMock) {
      return { mock: true, menu: [] };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/menus`, { headers: this.headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: unknown[] };
      return { menu: data.data ?? [] };
    } catch (err) {
      log.warn('ti_getMenu_failed', { error: (err as Error).message });
      // Return stub rather than throw — caller handles partial data
      return { menu: [] };
    }
  }

  async getMenuItem(itemId: string): Promise<{ mock?: boolean; item: unknown }> {
    if (this.isMock) {
      return { mock: true, item: { id: itemId, name: '', price: 0 } };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/menus/${encodeURIComponent(itemId)}`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: unknown };
      return { item: data.data ?? {} };
    } catch (err) {
      log.warn('ti_getMenuItem_failed', { itemId, error: (err as Error).message });
      return { item: {} };
    }
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  async createOrder(orderData: Record<string, unknown>): Promise<{ mock?: boolean; order: unknown }> {
    if (this.isMock) {
      const orderId = `mock-ti-${Date.now()}`;
      return { mock: true, order: { id: orderId, ...orderData } };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/orders`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(orderData),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: unknown };
      return { order: data.data ?? {} };
    } catch (err) {
      log.error('ti_createOrder_failed', { error: (err as Error).message });
      throw err;
    }
  }

  async getOrder(orderId: string): Promise<{ mock?: boolean; order: unknown }> {
    if (this.isMock) {
      return { mock: true, order: { id: orderId, status: 'pending' } };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/orders/${encodeURIComponent(orderId)}`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: unknown };
      return { order: data.data ?? {} };
    } catch (err) {
      log.warn('ti_getOrder_failed', { orderId, error: (err as Error).message });
      return { order: {} };
    }
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createTastyIgniterClient(env: TIEnv): TastyIgniterClient | null {
  const enabled = env.TASTYIGNITER_SYNC_ENABLED === 'true';
  if (!enabled) return null;

  const url = env.TASTYIGNITER_URL;
  const apiKey = env.TASTYIGNITER_API_KEY;
  if (!url || !apiKey) {
    log.warn('ti_client_skipped', { reason: 'missing-credentials' });
    return null;
  }

  return new TastyIgniterClient({
    url,
    apiKey,
    isMock: false,
  });
}

export default TastyIgniterClient;
