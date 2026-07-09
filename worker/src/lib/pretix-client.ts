/**
 * pretix API Client — reusable HTTP client for pretix REST API
 *
 * Creates a client with methods for events, orders, checkin, and webhooks.
 * Handles Token auth, 5xx retry (once, configurable delay), and 401 errors.
 *
 * Usage:
 *   import { createPretixClient } from '../lib/pretix-client';
 *   const pretix = createPretixClient(apiUrl, apiToken);
 *   const events = await pretix.listEvents('aura-cafe');
 */

export class PretixApiError extends Error {
  status: number;
  body: string;
  endpoint: string;

  constructor(status: number, body: string, endpoint: string) {
    super(`pretix API error: ${status} on ${endpoint}`);
    this.name = 'PretixApiError';
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

export interface PretixClientOptions {
  retryDelay?: number;
}

export interface PretixClient {
  listEvents(organizer: string): Promise<Record<string, unknown>>;
  getEvent(organizer: string, eventSlug: string): Promise<Record<string, unknown>>;
  createEvent(organizer: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  listItems(organizer: string, eventSlug: string): Promise<Record<string, unknown>>;
  getItem(organizer: string, eventSlug: string, itemId: number): Promise<Record<string, unknown>>;
  listOrders(organizer: string, eventSlug: string): Promise<Record<string, unknown>>;
  getOrder(organizer: string, eventSlug: string, code: string): Promise<Record<string, unknown>>;
  redeemCheckin(organizer: string, eventSlug: string, listId: number, secret: string): Promise<Record<string, unknown>>;
  listWebhooks(organizer: string): Promise<Record<string, unknown>>;
  createWebhook(organizer: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export function createPretixClient(apiUrl: string, apiToken: string, options: PretixClientOptions = {}): PretixClient {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const retryDelay = options.retryDelay || 2000;

  async function request(method: string, endpoint: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = `${baseUrl}${endpoint}`;
    const opts: RequestInit & { headers: Record<string, string> } = {
      method,
      headers: {
        Authorization: `Token ${apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    let res = await fetch(url, opts);

    if (res.status === 401) {
      const text = await res.text();
      throw new PretixApiError(401, text, endpoint);
    }

    if (res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      res = await fetch(url, opts);
      if (res.status >= 500) {
        const text = await res.text();
        throw new PretixApiError(res.status, text, endpoint);
      }
    }

    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new PretixApiError(res.status, text, endpoint);
    }

    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new PretixApiError(res.status, text, endpoint);
    }
  }

  return {
    async listEvents(organizer: string): Promise<Record<string, unknown>> {
      return request('GET', `/api/v1/organizers/${organizer}/events/`);
    },

    async getEvent(organizer: string, eventSlug: string): Promise<Record<string, unknown>> {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/`);
    },

    async createEvent(organizer: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
      return request('POST', `/api/v1/organizers/${organizer}/events/`, data);
    },

    async listItems(organizer: string, eventSlug: string): Promise<Record<string, unknown>> {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/items/`);
    },

    async getItem(organizer: string, eventSlug: string, itemId: number): Promise<Record<string, unknown>> {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/items/${itemId}/`);
    },

    async listOrders(organizer: string, eventSlug: string): Promise<Record<string, unknown>> {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/orders/`);
    },

    async getOrder(organizer: string, eventSlug: string, code: string): Promise<Record<string, unknown>> {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/orders/${code}/`);
    },

    async redeemCheckin(organizer: string, eventSlug: string, listId: number, secret: string): Promise<Record<string, unknown>> {
      return request(
        'POST',
        `/api/v1/organizers/${organizer}/events/${eventSlug}/checkinlists/${listId}/positions/${secret}/redeem/?untrusted_input=true`
      );
    },

    async listWebhooks(organizer: string): Promise<Record<string, unknown>> {
      return request('GET', `/api/v1/organizers/${organizer}/webhooks/`);
    },

    async createWebhook(organizer: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
      return request('POST', `/api/v1/organizers/${organizer}/webhooks/`, data);
    }
  };
}
